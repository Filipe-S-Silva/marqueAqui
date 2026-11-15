// Desativa contas sem login há INACTIVITY_DAYS dias (spec 11). Idempotente e protegido por advisory lock.
// Clientes e profissionais são varridos; gestores não (uma empresa não pode ficar sem gestor — decisão do ADM).
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import {
  LOCK_NS, appointments, barbers, minutesToTime, nowInBusinessTz, services, sessions, shopManagers, users,
} from '@marqueaqui/database';
import { writeAudit } from '../repositories/audit.repository.ts';
import { insertNotifications } from '../repositories/notifications.repository.ts';
import type { AppContext } from '../types/app-context.ts';

export async function sweepInactiveUsers(ctx: AppContext, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - ctx.env.INACTIVITY_DAYS * 86_400_000);
  return ctx.db.transaction(async (tx) => {
    const lock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(${LOCK_NS.inactivitySweep}::int, 0) AS got`);
    if (!(lock as unknown as Array<{ got: boolean }>)[0]?.got) return 0; // outra instância já está varrendo

    const stale = await tx
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(and(
        inArray(users.role, ['CLIENT', 'PROFESSIONAL']),
        eq(users.active, true),
        or(lt(users.lastLoginAt, cutoff), and(isNull(users.lastLoginAt), lt(users.createdAt, cutoff))),
      ));
    if (!stale.length) return 0;
    const ids = stale.map((u) => u.id);
    const today = nowInBusinessTz(now);

    // Agendamentos futuros em que a conta é cliente ou profissional
    const future = await tx
      .select({
        id: appointments.id, shopId: appointments.shopId, clientId: appointments.clientId, date: appointments.date,
        startTime: appointments.startTime, serviceName: services.name, barberUserId: barbers.userId,
      })
      .from(appointments)
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .innerJoin(barbers, eq(barbers.id, appointments.barberId))
      .where(and(
        eq(appointments.status, 'CONFIRMED'),
        sql`(${appointments.date}, ${appointments.startTime}) > (${today.date}, ${minutesToTime(today.minutes)})`,
        or(inArray(appointments.clientId, ids), inArray(barbers.userId, ids)),
      ));

    await tx.update(users).set({ active: false, deactivatedAt: now, deactivationReason: 'INACTIVITY' }).where(inArray(users.id, ids));
    await tx.update(sessions).set({ revokedAt: now }).where(and(inArray(sessions.userId, ids), isNull(sessions.revokedAt)));
    if (future.length) {
      await tx.update(appointments).set({ status: 'CANCELLED', cancelReason: 'INACTIVITY', cancelledAt: now })
        .where(and(inArray(appointments.id, future.map((f) => f.id)), eq(appointments.status, 'CONFIRMED')));
    }

    // Avisos: clientes afetados por profissional inativo e gestores das empresas correspondentes
    const idSet = new Set(ids);
    const byProfessional = future.filter((f) => idSet.has(f.barberUserId) && !(f.clientId !== null && idSet.has(f.clientId)));
    const key = `inactivity:${now.toISOString().slice(0, 10)}`;
    const notes: Parameters<typeof insertNotifications>[1] = [];
    const byClient = new Map<number, typeof future>();
    for (const f of byProfessional) if (f.clientId !== null && !idSet.has(f.clientId)) byClient.set(f.clientId, [...(byClient.get(f.clientId) ?? []), f]);
    for (const [userId, list] of byClient) {
      notes.push({ userId, type: 'ACCOUNT_DEACTIVATED', title: 'Agendamento cancelado',
        message: `${list.length} agendamento(s) seu(s) foi(ram) cancelado(s) porque o profissional foi desativado por inatividade.`,
        data: { affected: list.map((f) => ({ appointmentId: f.id, date: f.date, startTime: f.startTime, serviceName: f.serviceName })) },
        requiresAck: true, sourceKey: `${key}:c` });
    }
    const proShops = await tx
      .select({ shopId: barbers.shopId, userId: barbers.userId }).from(barbers)
      .where(and(inArray(barbers.userId, ids.filter((i) => stale.find((s) => s.id === i)?.role === 'PROFESSIONAL')), eq(barbers.active, true)));
    const shopIds = [...new Set(proShops.map((p) => p.shopId))];
    if (shopIds.length) {
      const mgrs = await tx.select({ userId: shopManagers.userId, shopId: shopManagers.shopId }).from(shopManagers)
        .innerJoin(users, eq(users.id, shopManagers.userId))
        .where(and(inArray(shopManagers.shopId, shopIds), eq(shopManagers.active, true), eq(users.active, true)));
      for (const m of new Map(mgrs.map((x) => [x.userId, x])).values()) {
        const names = proShops.filter((p) => mgrs.some((g) => g.userId === m.userId && g.shopId === p.shopId))
          .map((p) => stale.find((s) => s.id === p.userId)?.name).filter(Boolean);
        notes.push({ userId: m.userId, type: 'ACCOUNT_DEACTIVATED', title: 'Profissional desativado por inatividade',
          message: `Desativado(s) por inatividade: ${[...new Set(names)].join(', ')}. Os agendamentos futuros foram cancelados.`,
          data: {}, requiresAck: true, sourceKey: `${key}:m` });
      }
    }
    await insertNotifications(tx, notes);
    for (const id of ids) {
      await writeAudit(tx, { actorType: 'SYSTEM', action: 'user.deactivated_inactivity', entityType: 'user', entityId: id });
    }
    return ids.length;
  });
}

export function startInactivityJob(ctx: AppContext): () => void {
  const run = () =>
    sweepInactiveUsers(ctx)
      .then((n) => n && ctx.log.info({ deactivated: n }, 'Contas inativas desativadas'))
      .catch((e) => ctx.log.error({ err: e }, 'Falha na varredura de inatividade'));
  void run();
  const timer = setInterval(run, ctx.env.INACTIVITY_SWEEP_MINUTES * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
