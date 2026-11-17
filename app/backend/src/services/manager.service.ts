import {
  LOCK_NS,
  currentMonth,
  hashPassword,
  minutesToTime,
  monthRange,
  nowInBusinessTz,
  validateWorkingIntervals,
  timeToMinutes,
} from '@marqueaqui/database';
import { sql } from 'drizzle-orm';
import type { z } from 'zod';
import * as authRepo from '../repositories/auth.repository.ts';
import { writeAudit } from '../repositories/audit.repository.ts';
import * as repo from '../repositories/manager.repository.ts';
import * as notificationsRepo from '../repositories/notifications.repository.ts';
import type * as m from '../schemas/manager.schemas.ts';
import type { AppContext, AuthContext } from '../types/app-context.ts';
import { buildWordDoc, toCsv } from '../utils/documents.ts';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../utils/errors.ts';
import { toMoney } from './scheduling.service.ts';

const DEFAULT_HOURS = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '09:00', endTime: '18:00' }));

const shopOf = (auth: AuthContext): number => {
  if (auth.shopId === null) throw forbidden('Nenhuma empresa ativa vinculada à sua conta.', 'NO_ACTIVE_SHOP');
  return auth.shopId;
};

/** Todo barberId vindo do cliente é conferido contra a empresa da sessão. */
async function ownBarber(ctx: AppContext, auth: AuthContext, barberId: number) {
  const team = await repo.listTeam(ctx.db, shopOf(auth));
  const found = team.find((b) => b.barberId === barberId);
  if (!found) throw notFound('Profissional não encontrado nesta empresa.', 'BARBER_NOT_FOUND');
  return found;
}

/* ------------------------------------------------------------------ equipe */

export async function team(ctx: AppContext, auth: AuthContext) {
  return repo.listTeam(ctx.db, shopOf(auth));
}

export async function createProfessional(ctx: AppContext, auth: AuthContext, input: z.infer<typeof m.createProfessionalBody>) {
  const shopId = shopOf(auth);
  return ctx.db.transaction(async (tx) => {
    let user = await authRepo.findUserByEmail(tx, input.email);
    let temporaryPassword = false;
    const linkedExisting = user !== undefined;
    if (user) {
      // Só reaproveita conta existente de profissional; nunca promove cliente/gestor por aqui
      if (user.role !== 'PROFESSIONAL' || !user.active) {
        throw conflict('Este e-mail pertence a outra conta e não pode ser vinculado.', 'EMAIL_UNAVAILABLE');
      }
    } else {
      if (!input.name) throw unprocessable('Este e-mail ainda não tem cadastro. Informe o nome para criar a conta.', 'NAME_REQUIRED');
      user = await authRepo.insertUser(tx, {
        name: input.name,
        email: input.email,
        phone: input.phone ?? null,
        passwordHash: await hashPassword(ctx.env.DEFAULT_PASSWORD),
        role: 'PROFESSIONAL',
        mustChangePassword: true,
      });
      temporaryPassword = true;
    }
    const existing = await repo.findBarberLink(tx, user.id, shopId);
    if (existing?.active) throw conflict('Este profissional já faz parte da equipe.', 'ALREADY_IN_TEAM');
    const validIds = await repo.validServiceIds(tx, shopId, input.serviceIds);
    if (validIds.length !== input.serviceIds.length) {
      throw unprocessable('Um ou mais serviços não pertencem a esta empresa.', 'INVALID_SERVICES');
    }
    const barber = existing ?? (await repo.insertBarber(tx, user.id, shopId));
    if (existing) await repo.setBarberActive(tx, existing.id, true);
    await repo.replaceBarberServices(tx, barber.id, validIds);
    // Expediente padrão: segunda a sexta, 09:00 às 18:00 (só na criação; reativação preserva o expediente)
    if (!existing) await repo.replaceWorkingHours(tx, barber.id, DEFAULT_HOURS);
    await writeAudit(tx, { actorType: 'USER', actorId: auth.userId, action: 'barber.create', entityType: 'barber', entityId: barber.id });
    return { barberId: barber.id, userId: user.id, name: user.name, email: user.email, mustChangePassword: temporaryPassword, linkedExisting };
  });
}

export async function setServices(ctx: AppContext, auth: AuthContext, barberId: number, input: z.infer<typeof m.barberServicesBody>) {
  await ownBarber(ctx, auth, barberId);
  const valid = await repo.validServiceIds(ctx.db, shopOf(auth), input.serviceIds);
  if (valid.length !== input.serviceIds.length) {
    throw unprocessable('Um ou mais serviços não pertencem a esta empresa.', 'INVALID_SERVICES');
  }
  await repo.replaceBarberServices(ctx.db, barberId, valid);
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'barber.set_services', entityType: 'barber', entityId: barberId });
}

export async function setWorkingHours(ctx: AppContext, auth: AuthContext, barberId: number, input: z.infer<typeof m.workingHoursBody>) {
  await ownBarber(ctx, auth, barberId);
  const byDay = new Map<number, Array<{ startTime: string; endTime: string }>>();
  for (const h of input.hours) byDay.set(h.weekday, [...(byDay.get(h.weekday) ?? []), { startTime: h.startTime, endTime: h.endTime }]);
  const rows: Array<{ weekday: number; startTime: string; endTime: string }> = [];
  for (const [weekday, list] of byDay) {
    const v = validateWorkingIntervals(list);
    if (v.ok === false) throw unprocessable(v.message, 'INVALID_WORKING_HOURS');
    for (const it of v.sorted) rows.push({ weekday, ...it });
  }
  // Mesma trava das reservas: a grade não muda no meio de uma criação de agendamento
  await ctx.db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_NS.barberBooking}::int, ${barberId}::int)`);
    await repo.replaceWorkingHours(tx, barberId, rows);
  });
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'barber.set_hours', entityType: 'barber', entityId: barberId });
}

export async function deactivateProfessional(ctx: AppContext, auth: AuthContext, barberId: number, opts: { allowSelf?: boolean } = {}) {
  const shopId = shopOf(auth);
  const target = await ownBarber(ctx, auth, barberId);
  if (!target.active) throw conflict('Profissional já está inativo.', 'ALREADY_INACTIVE');
  if (target.userId === auth.userId && !opts.allowSelf) throw unprocessable('Você não pode desativar o próprio perfil.', 'SELF_DEACTIVATION');

  const now = nowInBusinessTz();
  const cancelled = await ctx.db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_NS.barberBooking}::int, ${barberId}::int)`);
    await repo.setBarberActive(tx, barberId, false);
    const future = await repo.futureConfirmedOfBarber(tx, barberId, now.date, minutesToTime(now.minutes));
    await repo.cancelAppointmentsByIds(tx, future.map((a) => a.id), 'PROFESSIONAL_DEACTIVATED');
    await notificationsRepo.insertNotifications(
      tx,
      future
        .filter((a) => a.clientId !== null)
        .map((a) => ({
          userId: a.clientId!,
          type: 'APPOINTMENT_CANCELLED' as const,
          title: 'Agendamento cancelado',
          message: `Seu agendamento de ${a.date} às ${a.startTime} foi cancelado porque o profissional deixou de atender na empresa.`,
          data: { appointmentId: a.id },
          requiresAck: true,
          sourceKey: `appt-cancel:${a.id}`,
        })),
    );
    // Quem desativou não precisa ser avisado de uma ação que acabou de fazer
    const managerIds = (await repo.managerUserIds(tx, shopId)).filter((id) => id !== auth.userId);
    await notificationsRepo.insertNotifications(
      tx,
      managerIds.map((userId) => ({
        userId,
        type: 'PROFESSIONAL_DEACTIVATED' as const,
        title: 'Profissional desativado',
        message: `${target.name} foi desativado(a). ${future.length} agendamento(s) futuro(s) cancelado(s).`,
        data: { barberId },
        requiresAck: true,
        sourceKey: `barber-deactivated:${barberId}:${Date.now()}`,
      })),
    );
    await writeAudit(tx, { actorType: 'USER', actorId: auth.userId, action: 'barber.deactivate', entityType: 'barber', entityId: barberId, metadata: { cancelled: future.length } });
    return future.length;
  });
  return { cancelledAppointments: cancelled };
}

export async function reactivateProfessional(ctx: AppContext, auth: AuthContext, barberId: number) {
  const target = await ownBarber(ctx, auth, barberId);
  if (target.active) throw conflict('Profissional já está ativo.', 'ALREADY_ACTIVE');
  await repo.setBarberActive(ctx.db, barberId, true);
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'barber.reactivate', entityType: 'barber', entityId: barberId });
}

/* ---------------------------------------------------------------- serviços */

const serviceView = (s: Awaited<ReturnType<typeof repo.listServices>>[number]) => ({
  id: s.id, name: s.name, description: s.description, durationMinutes: s.durationMinutes,
  priceCents: s.priceCents, price: toMoney(s.priceCents), active: s.active,
});

export async function listServices(ctx: AppContext, auth: AuthContext) {
  return (await repo.listServices(ctx.db, shopOf(auth))).map(serviceView);
}

export async function createService(ctx: AppContext, auth: AuthContext, input: z.infer<typeof m.createServiceBody>) {
  const row = await repo.insertService(ctx.db, { shopId: shopOf(auth), name: input.name, description: input.description, durationMinutes: input.durationMinutes, priceCents: input.priceCents });
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'service.create', entityType: 'service', entityId: row.id });
  return serviceView(row);
}

export async function updateService(ctx: AppContext, auth: AuthContext, id: number, input: z.infer<typeof m.updateServiceBody>) {
  if (!Object.keys(input).length) throw badRequest('Nenhum campo para atualizar.', 'EMPTY_UPDATE');
  const row = await repo.updateService(ctx.db, id, shopOf(auth), input);
  if (!row) throw notFound('Serviço não encontrado.', 'SERVICE_NOT_FOUND');
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'service.update', entityType: 'service', entityId: id });
  return serviceView(row);
}

/* ----------------------------------------------------------------- empresa */

export async function updateShop(ctx: AppContext, auth: AuthContext, input: z.infer<typeof m.updateShopBody>) {
  if (!Object.keys(input).length) throw badRequest('Nenhum campo para atualizar.', 'EMPTY_UPDATE');
  // Campos de plano e status da empresa são do ADM e nunca passam por aqui (schema strict)
  const row = await repo.updateShop(ctx.db, shopOf(auth), input as Parameters<typeof repo.updateShop>[2]);
  if (!row) throw notFound('Empresa não encontrada.');
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'shop.update', entityType: 'shop', entityId: row.id });
  return { id: row.id, name: row.name, description: row.description, address: row.address, phone: row.phone, logoUrl: row.logoUrl };
}

/* -------------------------------------------------------------- relatórios */

export async function report(ctx: AppContext, auth: AuthContext, month?: string) {
  const mo = month ?? currentMonth();
  const { start, end } = monthRange(mo);
  const rows = await repo.countByStatus(ctx.db, shopOf(auth), start, end);
  const n = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
  return {
    month: mo,
    confirmed: n('CONFIRMED'),
    completed: n('COMPLETED'),
    noShow: n('NO_SHOW'),
    // Receita considera apenas atendimentos concluídos
    revenueCents: rows.find((r) => r.status === 'COMPLETED')?.revenue ?? 0,
    revenue: toMoney(rows.find((r) => r.status === 'COMPLETED')?.revenue ?? 0),
  };
}

const STATUS_PT: Record<string, string> = { CONFIRMED: 'Confirmado', COMPLETED: 'Concluído', CANCELLED: 'Cancelado', NO_SHOW: 'Faltou' };

export async function exportMonth(ctx: AppContext, auth: AuthContext, month: string | undefined, format: 'csv' | 'doc') {
  const mo = month ?? currentMonth();
  const { start, end } = monthRange(mo);
  const rows = await repo.monthAppointments(ctx.db, shopOf(auth), start, end);
  const headers = ['Data', 'Início', 'Fim', 'Cliente', 'Serviço', 'Profissional', 'Status', 'Valor (R$)'];
  const data = rows.map((r) => [r.date, r.startTime, r.endTime, r.clientName, r.serviceName, r.barberName, STATUS_PT[r.status] ?? r.status, toMoney(r.priceCents).toFixed(2)]);
  if (format === 'csv') {
    return { filename: `agendamentos-${mo}.csv`, contentType: 'text/csv; charset=utf-8', body: '﻿' + toCsv(headers, data) };
  }
  return {
    filename: `agendamentos-${mo}.doc`,
    contentType: 'application/msword; charset=utf-8',
    body: buildWordDoc({ title: `Agendamentos ${mo}`, headers, rows: data }),
  };
}

/* ------------------------------------------------------------------ perfil */

export async function updateProfile(ctx: AppContext, auth: AuthContext, input: z.infer<typeof m.updateProfileBody>) {
  if (!Object.keys(input).length) throw badRequest('Nenhum campo para atualizar.', 'EMPTY_UPDATE');
  await authRepo.updateProfile(ctx.db, auth.userId, input);
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'user.update_profile', entityType: 'user', entityId: auth.userId, metadata: { fields: Object.keys(input) } });
  const user = await authRepo.findUserById(ctx.db, auth.userId);
  if (!user) throw notFound('Usuário não encontrado.');
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, photoUrl: user.photoUrl, description: user.description };
}


/* ---------------------------------------------------------- atender também */

/** O gestor ganha (ou reativa) o próprio perfil de profissional na empresa ativa. */
export async function enableSelfAsProfessional(ctx: AppContext, auth: AuthContext) {
  const shopId = shopOf(auth);
  return ctx.db.transaction(async (tx) => {
    const existing = await repo.findBarberLink(tx, auth.userId, shopId);
    if (existing?.active) throw conflict('Você já atende nesta empresa.', 'ALREADY_IN_TEAM');
    const barber = existing ?? (await repo.insertBarber(tx, auth.userId, shopId));
    if (existing) await repo.setBarberActive(tx, existing.id, true);
    else await repo.replaceWorkingHours(tx, barber.id, DEFAULT_HOURS);
    await writeAudit(tx, { actorType: 'USER', actorId: auth.userId, action: 'manager.enable_self_barber', entityType: 'barber', entityId: barber.id });
    return { barberId: barber.id };
  });
}

/** O gestor deixa de atender: o perfil de profissional fica inativo e os agendamentos futuros dele são cancelados com aviso aos clientes. */
export async function disableSelfAsProfessional(ctx: AppContext, auth: AuthContext) {
  const own = await repo.findBarberLink(ctx.db, auth.userId, shopOf(auth));
  if (!own?.active) throw conflict('Você não atende nesta empresa.', 'NOT_A_BARBER');
  return deactivateProfessional(ctx, auth, own.id, { allowSelf: true });
}

/** Quantos agendamentos futuros seriam cancelados se o gestor deixasse de atender (mostrado antes de confirmar). */
export async function selfDisableImpact(ctx: AppContext, auth: AuthContext) {
  const own = await repo.findBarberLink(ctx.db, auth.userId, shopOf(auth));
  if (!own?.active) return { affected: 0 };
  const now = nowInBusinessTz();
  const future = await repo.futureConfirmedOfBarber(ctx.db, own.id, now.date, minutesToTime(now.minutes));
  return { affected: future.length };
}

/* ----------------------------------------------------------------- gestores */

export async function listManagers(ctx: AppContext, auth: AuthContext) {
  return repo.listManagers(ctx.db, shopOf(auth));
}

export async function addManager(ctx: AppContext, auth: AuthContext, input: z.infer<typeof m.createManagerBody>) {
  const shopId = shopOf(auth);
  return ctx.db.transaction(async (tx) => {
    let user = await authRepo.findUserByEmail(tx, input.email);
    let temporaryPassword = false;
    if (user) {
      if (user.role !== 'MANAGER' || !user.active) {
        throw conflict('Este e-mail pertence a outra conta e não pode ser vinculado.', 'EMAIL_UNAVAILABLE');
      }
    } else {
      user = await authRepo.insertUser(tx, {
        name: input.name, email: input.email, phone: input.phone ?? null,
        passwordHash: await hashPassword(ctx.env.DEFAULT_PASSWORD), role: 'MANAGER', mustChangePassword: true,
      });
      temporaryPassword = true;
    }
    await repo.insertManagerLink(tx, shopId, user.id);
    await writeAudit(tx, { actorType: 'USER', actorId: auth.userId, action: 'shop.add_manager', entityType: 'user', entityId: user.id });
    return { userId: user.id, name: user.name, email: user.email, mustChangePassword: temporaryPassword };
  });
}

/* ------------------------------------------------------------ serviço: remover */

/** Serviço com histórico nunca é apagado: é desativado. */
export async function removeService(ctx: AppContext, auth: AuthContext, id: number) {
  const shopId = shopOf(auth);
  const current = (await repo.listServices(ctx.db, shopId)).find((s) => s.id === id);
  if (!current) throw notFound('Serviço não encontrado.', 'SERVICE_NOT_FOUND');
  if (await repo.serviceHasAppointments(ctx.db, id)) {
    await repo.updateService(ctx.db, id, shopId, { active: false });
    await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'service.deactivate', entityType: 'service', entityId: id });
    return { deleted: false, deactivated: true };
  }
  await repo.deleteService(ctx.db, id, shopId);
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'service.delete', entityType: 'service', entityId: id });
  return { deleted: true, deactivated: false };
}

/* ------------------------------------------------- documento de desativação */

export async function affectedClientsDoc(ctx: AppContext, auth: AuthContext, barberId: number) {
  const target = await ownBarber(ctx, auth, barberId);
  const rows = await repo.cancelledByDeactivation(ctx.db, barberId);
  return {
    filename: `clientes-afetados-${barberId}.doc`,
    contentType: 'application/msword; charset=utf-8',
    body: buildWordDoc({
      title: `Clientes afetados — desativação de ${target.name}`,
      headers: ['Data', 'Horário', 'Cliente', 'Telefone', 'Serviço'],
      rows: rows.map((r) => [r.date, r.startTime, r.clientName, r.clientPhone ?? '', r.serviceName]),
    }),
  };
}

/* ----------------------------------------------------------------- dashboards */

type Row = Awaited<ReturnType<typeof repo.monthAppointments>>[number];
const isAfterNow = (r: Row, now = nowInBusinessTz()) => r.date > now.date || (r.date === now.date && timeToMinutes(r.startTime) > now.minutes);
const view = (r: Row) => ({
  id: r.id, date: r.date, startTime: r.startTime, endTime: r.endTime, status: r.status,
  clientName: r.clientName, clientPhone: r.clientPhone, serviceName: r.serviceName, professionalName: r.barberName, price: toMoney(r.priceCents),
});

export async function managerDashboard(ctx: AppContext, auth: AuthContext) {
  const shopId = shopOf(auth);
  const now = nowInBusinessTz();
  const { start, end } = monthRange(currentMonth(now));
  const [rows, team, svcs] = await Promise.all([
    repo.monthAppointments(ctx.db, shopId, start, end),
    repo.listTeam(ctx.db, shopId),
    repo.listServices(ctx.db, shopId),
  ]);
  const sum = (list: Row[]) => list.reduce((a, r) => a + r.priceCents, 0);
  const today = rows.filter((r) => r.date === now.date);
  return {
    month: currentMonth(now),
    todayAppointments: today.filter((r) => r.status !== 'CANCELLED').length,
    upcoming: rows.filter((r) => r.status === 'CONFIRMED' && isAfterNow(r, now)).slice(0, 6).map(view),
    professionals: team.filter((t) => t.active).length,
    services: svcs.filter((s) => s.active).length,
    revenueRealized: toMoney(sum(rows.filter((r) => r.status === 'COMPLETED'))),
    revenueForecast: toMoney(sum(rows.filter((r) => r.status === 'CONFIRMED'))),
    cancellations: rows.filter((r) => r.status === 'CANCELLED').length,
    todayAgenda: today.filter((r) => r.status !== 'CANCELLED').map(view),
  };
}

export async function staffDashboard(ctx: AppContext, auth: AuthContext) {
  const shopId = shopOf(auth);
  if (auth.barberId === null) throw forbidden('Você não atende nesta empresa.', 'NOT_A_BARBER');
  const now = nowInBusinessTz();
  const { start, end } = monthRange(currentMonth(now));
  const mine = (await repo.monthAppointments(ctx.db, shopId, start, end)).filter((r) => r.barberId === auth.barberId);
  return {
    todayAppointments: mine.filter((r) => r.date === now.date && r.status !== 'CANCELLED').length,
    completedThisMonth: mine.filter((r) => r.status === 'COMPLETED').length,
    // Já começaram e ainda não foram concluídos nem marcados como falta
    pendingToClose: mine.filter((r) => r.status === 'CONFIRMED' && !isAfterNow(r, now)).length,
    upcoming: mine.filter((r) => r.status === 'CONFIRMED' && isAfterNow(r, now)).slice(0, 6).map(view),
  };
}

/* ------------------------------------------------------- relatório completo */

export async function fullReport(ctx: AppContext, auth: AuthContext, month?: string) {
  const mo = month ?? currentMonth();
  const { start, end } = monthRange(mo);
  const rows = await repo.monthAppointments(ctx.db, shopOf(auth), start, end);
  const by = (st: Row['status']) => rows.filter((r) => r.status === st);
  const cents = (l: Row[]) => l.reduce((a, r) => a + r.priceCents, 0);
  const rank = (key: (r: Row) => string) => {
    const map = new Map<string, { name: string; total: number; completed: number; revenueCents: number }>();
    for (const r of rows) {
      const k = key(r);
      const e = map.get(k) ?? { name: k, total: 0, completed: 0, revenueCents: 0 };
      if (r.status !== 'CANCELLED') e.total++;
      if (r.status === 'COMPLETED') { e.completed++; e.revenueCents += r.priceCents; }
      map.set(k, e);
    }
    return [...map.values()].sort((a, b) => b.completed - a.completed || b.total - a.total).map((e) => ({ ...e, revenue: toMoney(e.revenueCents) }));
  };
  const perDay = new Map<string, number>();
  for (const r of rows) if (r.status !== 'CANCELLED') perDay.set(r.date, (perDay.get(r.date) ?? 0) + 1);
  const unique = new Set(rows.filter((r) => r.status !== 'CANCELLED').map((r) => (r.clientId !== null ? `u:${r.clientId}` : `w:${r.clientName}|${r.clientPhone ?? ''}`)));
  return {
    month: mo,
    byStatus: { CONFIRMED: by('CONFIRMED').length, COMPLETED: by('COMPLETED').length, CANCELLED: by('CANCELLED').length, NO_SHOW: by('NO_SHOW').length },
    revenueRealized: toMoney(cents(by('COMPLETED'))),
    revenueForecast: toMoney(cents(by('CONFIRMED'))),
    cancellationRate: rows.length ? Math.round((by('CANCELLED').length / rows.length) * 1000) / 10 : 0,
    uniqueClients: unique.size,
    byProfessional: rank((r) => r.barberName),
    byService: rank((r) => r.serviceName),
    perDay: [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })),
  };
}
