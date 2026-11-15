import { minutesToTime, nowInBusinessTz, shopManagers, shops, appointments, barbers, services, users } from '@marqueaqui/database';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { writeAudit } from '../repositories/audit.repository.ts';
import { insertNotifications } from '../repositories/notifications.repository.ts';
import * as repo from '../repositories/shops.repository.ts';
import type { AppContext } from '../types/context.ts';
import { conflict, notFound, unprocessable } from '../utils/errors.ts';
import { insertManagerAccount } from './accounts.ts';

export async function list(ctx: AppContext, q: { q?: string | undefined; status?: 'active' | 'inactive' | undefined; page: number; pageSize: number }) {
  const { items, total } = await repo.list(ctx.db, q, q.page, q.pageSize);
  return { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

export async function detail(ctx: AppContext, id: number) {
  const shop = await repo.find(ctx.db, id);
  if (!shop) throw notFound('Empresa não encontrada.');
  return { shop, managers: await repo.managersOf(ctx.db, id) };
}

interface ShopInput { name: string; description?: string | null | undefined; address?: string | null | undefined; phone?: string | null | undefined; logoUrl?: string | null | undefined }

/** Empresa + primeiro gestor numa única transação (spec 8.4). */
export async function create(ctx: AppContext, actor: number, input: ShopInput & { manager: { name: string; email: string; phone?: string | undefined } }) {
  return ctx.db.transaction(async (tx) => {
    const [shop] = await tx.insert(shops).values({
      name: input.name, description: input.description ?? null, address: input.address ?? null, phone: input.phone ?? null,
      logoUrl: input.logoUrl ?? null,
    }).returning();
    const manager = await insertManagerAccount(tx, ctx.env.DEFAULT_PASSWORD, shop!.id, input.manager);
    await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: 'shop.create', entityType: 'shop', entityId: shop!.id });
    return { shop: shop!, manager };
  });
}

export async function update(ctx: AppContext, actor: number, id: number, input: Partial<ShopInput>) {
  const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  if (!Object.keys(clean).length) throw unprocessable('Nenhum campo para atualizar.', 'EMPTY_UPDATE');
  const [row] = await ctx.db.update(shops).set(clean).where(eq(shops.id, id)).returning();
  if (!row) throw notFound('Empresa não encontrada.');
  await writeAudit(ctx.db, { actorType: 'ADMIN', actorId: actor, action: 'shop.update', entityType: 'shop', entityId: id, metadata: { fields: Object.keys(clean) } });
  return row;
}

export async function addManager(ctx: AppContext, actor: number, shopId: number, input: { name: string; email: string; phone?: string | undefined }) {
  return ctx.db.transaction(async (tx) => {
    if (!(await repo.find(tx, shopId))) throw notFound('Empresa não encontrada.');
    const r = await insertManagerAccount(tx, ctx.env.DEFAULT_PASSWORD, shopId, input);
    await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: 'shop.add_manager', entityType: 'shop', entityId: shopId, metadata: { userId: r.userId } });
    return r;
  });
}

export async function setManagerActive(ctx: AppContext, actor: number, shopId: number, userId: number, active: boolean) {
  return ctx.db.transaction(async (tx) => {
    await repo.findForUpdate(tx, shopId);
    const link = (await repo.managersOf(tx, shopId)).find((m) => m.userId === userId);
    if (!link) throw notFound('Gestor não vinculado a esta empresa.');
    // Uma empresa nunca fica sem gestor ativo
    if (!active && link.linkActive && (await repo.countActiveManagers(tx, shopId, userId)) === 0) {
      throw unprocessable('A empresa não pode ficar sem gestor ativo.', 'LAST_MANAGER');
    }
    if (active && !link.userActive) throw unprocessable('A conta deste gestor está desativada. Reative-a em Usuários.', 'USER_INACTIVE');
    await tx.update(shopManagers).set({ active }).where(and(eq(shopManagers.shopId, shopId), eq(shopManagers.userId, userId)));
    await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: active ? 'shop.manager_activate' : 'shop.manager_deactivate', entityType: 'shop', entityId: shopId, metadata: { userId } });
  });
}

const MAX_LIST = 500;

interface Affected { appointmentId: number; date: string; startTime: string; clientName: string; clientPhone: string | null; serviceName: string; professionalName: string }

export async function setActive(ctx: AppContext, actor: number, id: number, active: boolean) {
  return ctx.db.transaction(async (tx) => {
    const shop = await repo.findForUpdate(tx, id);
    if (!shop) throw notFound('Empresa não encontrada.');
    if (shop.active === active) throw conflict(active ? 'A empresa já está ativa.' : 'A empresa já está inativa.', 'NO_CHANGE');

    const now = new Date();
    const stamp = now.getTime();
    const [managerRows, barberRows] = await Promise.all([
      tx.select({ id: shopManagers.userId }).from(shopManagers).innerJoin(users, eq(users.id, shopManagers.userId))
        .where(and(eq(shopManagers.shopId, id), eq(shopManagers.active, true), eq(users.active, true))),
      tx.select({ barberId: barbers.id, userId: barbers.userId }).from(barbers).innerJoin(users, eq(users.id, barbers.userId))
        .where(and(eq(barbers.shopId, id), eq(barbers.active, true), eq(users.active, true))),
    ]);

    if (active) {
      await tx.update(shops).set({ active: true, deactivatedAt: null }).where(eq(shops.id, id));
      const recipients = [...new Set([...managerRows.map((m) => m.id), ...barberRows.map((b) => b.userId)])];
      await insertNotifications(tx, recipients.map((userId) => ({
        userId, type: 'SHOP_REACTIVATED' as const, title: 'Empresa reativada',
        message: `${shop.name} foi reativada. Os agendamentos cancelados na desativação não foram restaurados.`,
        data: { shopId: id }, requiresAck: true, sourceKey: `shop-react:${id}:${stamp}`,
      })));
      await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: 'shop.activate', entityType: 'shop', entityId: id });
      return { cancelledAppointments: 0 };
    }

    const today = nowInBusinessTz(now);
    const future = await tx
      .select({
        id: appointments.id, barberId: appointments.barberId, clientId: appointments.clientId,
        date: appointments.date, startTime: appointments.startTime,
        clientName: appointments.clientName, clientPhone: appointments.clientPhone,
        serviceName: services.name, professionalName: users.name,
      })
      .from(appointments)
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .innerJoin(barbers, eq(barbers.id, appointments.barberId))
      .innerJoin(users, eq(users.id, barbers.userId))
      .where(and(eq(appointments.shopId, id), eq(appointments.status, 'CONFIRMED'),
        sql`(${appointments.date}, ${appointments.startTime}) > (${today.date}, ${minutesToTime(today.minutes)})`));

    if (future.length) {
      await tx.update(appointments)
        .set({ status: 'CANCELLED', cancelReason: 'SHOP_DEACTIVATED', cancelledAt: now })
        .where(and(inArray(appointments.id, future.map((f) => f.id)), eq(appointments.status, 'CONFIRMED')));
    }
    await tx.update(shops).set({ active: false, deactivatedAt: now }).where(eq(shops.id, id));

    const toAffected = (f: (typeof future)[number]): Affected => ({
      appointmentId: f.id, date: f.date, startTime: f.startTime, clientName: f.clientName,
      clientPhone: f.clientPhone, serviceName: f.serviceName, professionalName: f.professionalName,
    });
    const key = `shop-deact:${id}:${stamp}`;
    const rows: Parameters<typeof insertNotifications>[1] = [];

    // Cliente: somente os próprios agendamentos cancelados
    const byClient = new Map<number, typeof future>();
    for (const f of future) if (f.clientId !== null) byClient.set(f.clientId, [...(byClient.get(f.clientId) ?? []), f]);
    for (const [userId, list] of byClient) {
      rows.push({ userId, type: 'SHOP_DEACTIVATED', title: 'Agendamento cancelado',
        message: `${shop.name} foi desativada e ${list.length} agendamento(s) seu(s) foi(ram) cancelado(s).`,
        data: { shopId: id, affected: list.slice(0, MAX_LIST).map(toAffected) }, requiresAck: true, sourceKey: key });
    }
    // Profissional: somente os clientes dos próprios agendamentos
    for (const b of barberRows) {
      const mine = future.filter((f) => f.barberId === b.barberId);
      rows.push({ userId: b.userId, type: 'SHOP_DEACTIVATED', title: 'Empresa desativada',
        message: `${shop.name} foi desativada. ${mine.length} atendimento(s) seu(s) foi(ram) cancelado(s).`,
        data: { shopId: id, affected: mine.slice(0, MAX_LIST).map(toAffected) }, requiresAck: true, sourceKey: key });
    }
    // Gestor: lista completa de clientes afetados (o frontend gera o .doc a partir de data.affected)
    for (const m of managerRows) {
      rows.push({ userId: m.id, type: 'SHOP_DEACTIVATED', title: 'Empresa desativada',
        message: `${shop.name} foi desativada pela administração. ${future.length} agendamento(s) futuro(s) cancelado(s).`,
        data: { shopId: id, total: future.length, affected: future.slice(0, MAX_LIST).map(toAffected) }, requiresAck: true, sourceKey: key });
    }
    // Quem é gestor E profissional recebe um único aviso (o de gestor, mais completo)
    const seen = new Set<number>();
    const unique = [...rows].sort((a, b) => (managerRows.some((m) => m.id === b.userId) ? 1 : 0) - (managerRows.some((m) => m.id === a.userId) ? 1 : 0))
      .filter((r) => (seen.has(r.userId) ? false : (seen.add(r.userId), true)));
    await insertNotifications(tx, unique);
    await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: 'shop.deactivate', entityType: 'shop', entityId: id, metadata: { cancelled: future.length } });
    return { cancelledAppointments: future.length };
  });
}

