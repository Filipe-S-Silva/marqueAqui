import { appointments, barbers, platformFeedbacks, supportTickets, currentMonth, monthRange, nowInBusinessTz, shopManagers, shops, users } from '@marqueaqui/database';
import { and, count, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { AppContext } from '../types/context.ts';

export async function dashboard(ctx: AppContext) {
  const now = nowInBusinessTz();
  const { start, end } = monthRange(currentMonth(now));
  const n = async (q: Promise<Array<{ n: number }>>) => (await q)[0]?.n ?? 0;

  const [total, active, managers, professionals, clients, month, openTickets, newFeedbacks, recent] = await Promise.all([
    n(ctx.db.select({ n: count() }).from(shops)),
    n(ctx.db.select({ n: count() }).from(shops).where(eq(shops.active, true))),
    n(ctx.db.select({ n: sql<number>`count(distinct ${shopManagers.userId})::int` }).from(shopManagers).innerJoin(users, eq(users.id, shopManagers.userId)).where(and(eq(shopManagers.active, true), eq(users.active, true)))),
    n(ctx.db.select({ n: sql<number>`count(distinct ${barbers.userId})::int` }).from(barbers).innerJoin(users, eq(users.id, barbers.userId)).where(and(eq(barbers.active, true), eq(users.active, true)))),
    n(ctx.db.select({ n: count() }).from(users).where(and(eq(users.role, 'CLIENT'), eq(users.active, true)))),
    n(ctx.db.select({ n: count() }).from(appointments).where(and(gte(appointments.date, start), lte(appointments.date, end)))),
    n(ctx.db.select({ n: count() }).from(supportTickets).where(and(eq(supportTickets.status, 'OPEN'), eq(supportTickets.lastMessageBy, 'USER')))),
    n(ctx.db.select({ n: count() }).from(platformFeedbacks).where(eq(platformFeedbacks.status, 'NEW'))),
    ctx.db.select({ id: shops.id, name: shops.name, active: shops.active, createdAt: shops.createdAt }).from(shops).orderBy(desc(shops.createdAt)).limit(5),
  ]);

  return {
    totals: { shops: total, activeShops: active, managers, professionals, clients, appointmentsThisMonth: month, openTickets, newFeedbacks },
    recentShops: recent,
  };
}
