import {
  appointments, barbers, services as servicesTable, sessions, shopManagers, users,
  clearUserLockout, hashPassword, isLocked, minutesToTime, nowInBusinessTz, type UserRole,
} from '@marqueaqui/database';
import { and, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { writeAudit } from '../repositories/audit.repository.ts';
import { insertNotifications } from '../repositories/notifications.repository.ts';
import * as shopsRepo from '../repositories/shops.repository.ts';
import * as repo from '../repositories/users.repository.ts';
import type { AppContext } from '../types/context.ts';
import { buildWordDoc, toCsv } from '../utils/documents.ts';
import { conflict, notFound, unprocessable } from '../utils/errors.ts';
import * as admins from './admins.service.ts';
import { findUserByEmail, futureConfirmedCount, insertUser, linkManager, linkProfessional } from './accounts.ts';

type Tx = Parameters<Parameters<AppContext['db']['transaction']>[0]>[0];

const ROLE_PT: Record<string, string> = { CLIENT: 'Cliente', PROFESSIONAL: 'Profissional', MANAGER: 'Gestor' };

export const list = async (ctx: AppContext, f: repo.UserFilters, page: number, pageSize: number) => {
  const { items, total } = await repo.list(ctx.db, f, page, pageSize);
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
};

const EXPORT_LIMIT = 5000;

/** Exporta TODAS as linhas do filtro (até 5.000), não apenas a página visível. */
export async function exportUsers(ctx: AppContext, f: repo.UserFilters, format: 'csv' | 'doc') {
  const rows = await repo.exportRows(ctx.db, f, EXPORT_LIMIT);
  const headers = ['Nome', 'E-mail', 'Perfil', 'Status', 'Empresas', 'Cadastro', 'Último acesso'];
  const data = rows.map((r) => [
    r.name, r.email, ROLE_PT[r.role] ?? r.role, r.active ? 'Ativo' : 'Inativo',
    r.shops.map((s) => s.name).join('; '), r.createdAt.toISOString().slice(0, 10), r.lastLoginAt ? r.lastLoginAt.toISOString().slice(0, 10) : '',
  ]);
  const truncated = rows.length === EXPORT_LIMIT;
  if (format === 'csv') return { filename: 'usuarios.csv', contentType: 'text/csv; charset=utf-8', body: '﻿' + toCsv(headers, data), truncated };
  return {
    filename: 'usuarios.doc', contentType: 'application/msword; charset=utf-8', truncated,
    body: buildWordDoc({ title: 'Usuários', subtitle: `${rows.length} registro(s)`, headers, rows: data, ...(truncated ? { footer: `Limite de ${EXPORT_LIMIT} registros atingido.` } : {}) }),
  };
}

export async function detail(ctx: AppContext, id: number) {
  const u = await repo.findById(ctx.db, id);
  if (!u) throw notFound('Usuário não encontrado.');
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, active: u.active,
    createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, mustChangePassword: u.mustChangePassword,
    shops: await repo.userShops(ctx.db, id),
    // Estado de segurança: nunca expõe hash de senha nem hash/valor de token de sessão
    security: {
      failedLoginAttempts: u.failedLoginAttempts, locked: isLocked(u), lockedUntil: u.lockedUntil,
      sessions: await ctx.db
        .select({ id: sessions.id, createdAt: sessions.createdAt, expiresAt: sessions.expiresAt, ip: sessions.ip, userAgent: sessions.userAgent })
        .from(sessions)
        .where(and(eq(sessions.userId, id), isNull(sessions.revokedAt), isNull(sessions.rotatedAt), gt(sessions.expiresAt, new Date())))
        .orderBy(desc(sessions.createdAt))
        .limit(50),
    },
  };
}

/** Encerra todas as sessões do usuário no APP. O access token vale no máximo até a próxima conferência no banco (já a cada requisição). */
export async function revokeSessions(ctx: AppContext, actor: number, id: number) {
  if (!(await repo.findById(ctx.db, id))) throw notFound('Usuário não encontrado.');
  const rows = await ctx.db.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, id), isNull(sessions.revokedAt))).returning({ id: sessions.id });
  await writeAudit(ctx.db, { actorType: 'ADMIN', actorId: actor, action: 'user.revoke_sessions', entityType: 'user', entityId: id, metadata: { count: rows.length } });
  return { revoked: rows.length };
}

export async function unlock(ctx: AppContext, actor: number, id: number) {
  if (!(await repo.findById(ctx.db, id))) throw notFound('Usuário não encontrado.');
  await clearUserLockout(ctx.db, id);
  await writeAudit(ctx.db, { actorType: 'ADMIN', actorId: actor, action: 'user.unlock', entityType: 'user', entityId: id });
}

async function assertShops(tx: Tx, ids: number[]) {
  for (const id of ids) if (!(await shopsRepo.find(tx, id))) throw unprocessable(`Empresa ${id} não existe.`, 'SHOP_NOT_FOUND');
}

/** Para cada empresa, garante que sobra outro gestor ativo ao remover este usuário. */
async function assertNotLastManager(tx: Tx, userId: number, onlyShopId?: number) {
  const links = await tx.select({ shopId: shopManagers.shopId }).from(shopManagers)
    .where(and(eq(shopManagers.userId, userId), eq(shopManagers.active, true), ...(onlyShopId ? [eq(shopManagers.shopId, onlyShopId)] : [])));
  for (const l of links) {
    if ((await shopsRepo.countActiveManagers(tx, l.shopId, userId)) === 0) {
      const shop = await shopsRepo.find(tx, l.shopId);
      throw unprocessable(`A empresa "${shop?.name}" ficaria sem gestor ativo.`, 'LAST_MANAGER');
    }
  }
}

export async function create(ctx: AppContext, actor: number, input: {
  role: UserRole | 'ADMIN'; name: string; email: string; phone?: string | undefined; password?: string | undefined; shopIds: number[];
}) {
  if (input.role === 'ADMIN') {
    if (!input.password) throw unprocessable('Informe a senha do administrador.', 'PASSWORD_REQUIRED');
    return { kind: 'ADMIN' as const, ...(await admins.create(ctx, actor, { name: input.name, email: input.email, password: input.password })) };
  }
  const role = input.role;
  if ((role === 'PROFESSIONAL' || role === 'MANAGER') && input.shopIds.length === 0) {
    throw unprocessable('Informe ao menos uma empresa para este perfil.', 'SHOP_REQUIRED');
  }
  if (role === 'CLIENT' && input.shopIds.length) throw unprocessable('Cliente não possui vínculo com empresas.', 'SHOP_NOT_ALLOWED');

  return ctx.db.transaction(async (tx) => {
    if (await findUserByEmail(tx, input.email)) throw conflict('Já existe uma conta com este e-mail.', 'EMAIL_EXISTS');
    await assertShops(tx, input.shopIds);
    const password = input.password ?? ctx.env.DEFAULT_PASSWORD;
    // Staff sem senha informada recebe a padrão e é obrigado a trocar; senha explícita igual à padrão também força troca
    const must = role !== 'CLIENT' && (!input.password || input.password === ctx.env.DEFAULT_PASSWORD);
    const u = await insertUser(tx, { name: input.name, email: input.email, phone: input.phone, role, password, mustChangePassword: must });
    for (const sid of input.shopIds) {
      if (role === 'MANAGER') await linkManager(tx, sid, u.id);
      else await linkProfessional(tx, sid, u.id);
    }
    await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: 'user.create', entityType: 'user', entityId: u.id, metadata: { role } });
    return { kind: 'USER' as const, id: u.id, name: u.name, email: u.email, role: u.role, mustChangePassword: must };
  });
}

async function deactivateProfessionalRows(tx: Tx, userId: number) {
  const rows = await tx.select({ id: barbers.id }).from(barbers).where(and(eq(barbers.userId, userId), eq(barbers.active, true)));
  for (const b of rows) {
    if ((await futureConfirmedCount(tx, { barberId: b.id })) > 0) {
      throw conflict('O profissional possui agendamentos futuros. Cancele-os ou aguarde antes de remover o vínculo.', 'HAS_FUTURE_APPOINTMENTS');
    }
  }
  if (rows.length) await tx.update(barbers).set({ active: false, deactivatedAt: new Date() }).where(inArray(barbers.id, rows.map((r) => r.id)));
}

export async function update(ctx: AppContext, actor: number, id: number, input: { name?: string | undefined; phone?: string | undefined; role?: UserRole | undefined; shopIds?: number[] | undefined }) {
  return ctx.db.transaction(async (tx) => {
    const u = await repo.findById(tx, id);
    if (!u) throw notFound('Usuário não encontrado.');
    const patch: Partial<{ name: string; phone: string }> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.phone !== undefined) patch.phone = input.phone;

    if (input.role && input.role !== u.role) {
      const target = input.role;
      const shopIds = input.shopIds ?? [];
      await assertShops(tx, shopIds);
      const activeBarberShops = (await tx.select({ s: barbers.shopId }).from(barbers).where(and(eq(barbers.userId, id), eq(barbers.active, true)))).map((r) => r.s);
      const activeManagerShops = (await tx.select({ s: shopManagers.shopId }).from(shopManagers).where(and(eq(shopManagers.userId, id), eq(shopManagers.active, true)))).map((r) => r.s);

      if (target === 'CLIENT') {
        if (shopIds.length) throw unprocessable('Cliente não possui vínculo com empresas.', 'SHOP_NOT_ALLOWED');
        await assertNotLastManager(tx, id);
        await deactivateProfessionalRows(tx, id);
        await tx.update(shopManagers).set({ active: false }).where(eq(shopManagers.userId, id));
      } else if (target === 'PROFESSIONAL') {
        await assertNotLastManager(tx, id);
        const wanted = shopIds.length ? shopIds : activeBarberShops.length ? activeBarberShops : activeManagerShops;
        if (!wanted.length) throw unprocessable('Informe ao menos uma empresa para este perfil.', 'SHOP_REQUIRED');
        await tx.update(shopManagers).set({ active: false }).where(eq(shopManagers.userId, id));
        for (const sid of wanted) await linkProfessional(tx, sid, id);
      } else {
        const wanted = shopIds.length ? shopIds : activeManagerShops.length ? activeManagerShops : activeBarberShops;
        if (!wanted.length) throw unprocessable('Informe ao menos uma empresa para este perfil.', 'SHOP_REQUIRED');
        for (const sid of wanted) await linkManager(tx, sid, id); // vínculos de profissional existentes são mantidos ("atender também")
      }
      await tx.update(users).set({ ...patch, role: target }).where(eq(users.id, id));
      // Sessões antigas carregam o perfil anterior; a autorização já reconsulta o banco, mas encerramos por segurança
      await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, id), isNull(sessions.revokedAt)));
    } else if (Object.keys(patch).length) {
      await tx.update(users).set(patch).where(eq(users.id, id));
    }
    await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: 'user.update', entityType: 'user', entityId: id, metadata: { fields: Object.keys(input) } });
    return { id };
  });
}

export async function addShopLink(ctx: AppContext, actor: number, userId: number, shopId: number) {
  return ctx.db.transaction(async (tx) => {
    const u = await repo.findById(tx, userId);
    if (!u) throw notFound('Usuário não encontrado.');
    if (u.role === 'CLIENT') throw unprocessable('Clientes não possuem vínculo com empresas.', 'SHOP_NOT_ALLOWED');
    if (!(await shopsRepo.find(tx, shopId))) throw notFound('Empresa não encontrada.');
    if (u.role === 'MANAGER') await linkManager(tx, shopId, userId); else await linkProfessional(tx, shopId, userId);
    await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: 'user.link_shop', entityType: 'user', entityId: userId, metadata: { shopId } });
  });
}

export async function removeShopLink(ctx: AppContext, actor: number, userId: number, shopId: number) {
  return ctx.db.transaction(async (tx) => {
    const u = await repo.findById(tx, userId);
    if (!u) throw notFound('Usuário não encontrado.');
    const shops = await repo.userShops(tx, userId);
    const here = shops.filter((s) => s.id === shopId);
    if (!here.length) throw notFound('Vínculo não encontrado.');
    // Mantém ao menos um vínculo quando o perfil exige empresa
    const remaining = new Set(shops.filter((s) => s.id !== shopId).map((s) => s.id));
    if (remaining.size === 0) throw unprocessable('Este perfil exige ao menos uma empresa vinculada.', 'LAST_LINK');
    if (here.some((s) => s.as === 'MANAGER')) {
      await assertNotLastManager(tx, userId, shopId);
      await tx.update(shopManagers).set({ active: false }).where(and(eq(shopManagers.userId, userId), eq(shopManagers.shopId, shopId)));
    }
    if (here.some((s) => s.as === 'PROFESSIONAL')) {
      const [b] = await tx.select({ id: barbers.id }).from(barbers).where(and(eq(barbers.userId, userId), eq(barbers.shopId, shopId)));
      if (b && (await futureConfirmedCount(tx, { barberId: b.id })) > 0) {
        throw conflict('O profissional possui agendamentos futuros nesta empresa.', 'HAS_FUTURE_APPOINTMENTS');
      }
      await tx.update(barbers).set({ active: false, deactivatedAt: new Date() }).where(and(eq(barbers.userId, userId), eq(barbers.shopId, shopId)));
    }
    await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: 'user.unlink_shop', entityType: 'user', entityId: userId, metadata: { shopId } });
  });
}

/** O administrador digita o e-mail da conta (conferência) e a própria senha (validada no controller). */
export async function resetPassword(ctx: AppContext, actor: number, id: number, email: string) {
  const u = await repo.findById(ctx.db, id);
  if (!u) throw notFound('Usuário não encontrado.');
  if (u.email !== email.trim().toLowerCase()) throw unprocessable('O e-mail informado não confere com a conta.', 'EMAIL_MISMATCH');
  await ctx.db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: await hashPassword(ctx.env.DEFAULT_PASSWORD), mustChangePassword: true }).where(eq(users.id, id));
    await tx.update(sessions).set({ revokedAt: new Date() }).where(and(eq(sessions.userId, id), isNull(sessions.revokedAt)));
    await clearUserLockout(tx, id);
    await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: 'user.reset_password', entityType: 'user', entityId: id });
  });
}

export async function setActive(ctx: AppContext, actor: number, id: number, active: boolean) {
  return ctx.db.transaction(async (tx) => {
    const u = await repo.findById(tx, id);
    if (!u) throw notFound('Usuário não encontrado.');
    if (u.active === active) throw conflict(active ? 'Usuário já está ativo.' : 'Usuário já está inativo.', 'NO_CHANGE');

    if (active) {
      // Reativar zera o contador de inatividade
      await tx.update(users).set({ active: true, deactivatedAt: null, deactivationReason: null, lastLoginAt: new Date() }).where(eq(users.id, id));
      await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: 'user.activate', entityType: 'user', entityId: id });
      return { cancelledAppointments: 0 };
    }

    await assertNotLastManager(tx, id);
    const now = new Date();
    const today = nowInBusinessTz(now);
    const future = await tx
      .select({
        id: appointments.id, shopId: appointments.shopId, clientId: appointments.clientId, barberId: appointments.barberId,
        date: appointments.date, startTime: appointments.startTime, serviceName: servicesTable.name,
      })
      .from(appointments)
      .innerJoin(servicesTable, eq(servicesTable.id, appointments.serviceId))
      .leftJoin(barbers, eq(barbers.id, appointments.barberId))
      .where(and(
        eq(appointments.status, 'CONFIRMED'),
        sql`(${appointments.date}, ${appointments.startTime}) > (${today.date}, ${minutesToTime(today.minutes)})`,
        sql`(${appointments.clientId} = ${id} OR ${barbers.userId} = ${id})`,
      ));

    if (future.length) {
      await tx.update(appointments).set({ status: 'CANCELLED', cancelReason: 'USER_DEACTIVATED', cancelledAt: now })
        .where(and(inArray(appointments.id, future.map((f) => f.id)), eq(appointments.status, 'CONFIRMED')));
    }
    await tx.update(users).set({ active: false, deactivatedAt: now, deactivationReason: 'ADMIN' }).where(eq(users.id, id));
    await tx.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.userId, id), isNull(sessions.revokedAt)));

    // Clientes dos atendimentos do profissional e gestores das empresas afetadas são avisados
    const asProfessional = future.filter((f) => f.clientId !== id);
    const key = `user-deact:${id}:${now.getTime()}`;
    const notes: Parameters<typeof insertNotifications>[1] = [];
    const byClient = new Map<number, typeof future>();
    for (const f of asProfessional) if (f.clientId !== null) byClient.set(f.clientId, [...(byClient.get(f.clientId) ?? []), f]);
    for (const [userId, list] of byClient) {
      notes.push({ userId, type: 'ACCOUNT_DEACTIVATED', title: 'Agendamento cancelado',
        message: `${list.length} agendamento(s) seu(s) foi(ram) cancelado(s) porque o profissional deixou de atender.`,
        data: { affected: list.map((f) => ({ appointmentId: f.id, date: f.date, startTime: f.startTime, serviceName: f.serviceName })) }, requiresAck: true, sourceKey: key });
    }
    const shopIds = [...new Set(asProfessional.map((f) => f.shopId))];
    if (shopIds.length) {
      const mgrs = await tx.select({ userId: shopManagers.userId }).from(shopManagers).innerJoin(users, eq(users.id, shopManagers.userId))
        .where(and(inArray(shopManagers.shopId, shopIds), eq(shopManagers.active, true), eq(users.active, true)));
      for (const m of new Set(mgrs.map((x) => x.userId))) {
        notes.push({ userId: m, type: 'ACCOUNT_DEACTIVATED', title: 'Profissional desativado pela administração',
          message: `${u.name} foi desativado(a). ${asProfessional.length} agendamento(s) futuro(s) cancelado(s).`, data: { userId: id }, requiresAck: true, sourceKey: key });
      }
    }
    await insertNotifications(tx, notes);
    await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: 'user.deactivate', entityType: 'user', entityId: id, metadata: { cancelled: future.length } });
    return { cancelledAppointments: future.length };
  });
}
