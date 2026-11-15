import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import {
  platformFeedbacks, shops, supportTickets, ticketMessages, users,
  type FeedbackStatus, type TicketCategory, type TicketStatus, type FeedbackCategory,
} from '@marqueaqui/database';
import { writeAudit } from '../repositories/audit.repository.ts';
import { insertNotifications } from '../repositories/notifications.repository.ts';
import type { AppContext } from '../types/context.ts';
import { notFound, unprocessable } from '../utils/errors.ts';

const paged = <T>(items: T[], total: number, page: number, pageSize: number) => ({
  items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
});

/* ---------------------------------------------------------------- feedbacks */

export async function listFeedbacks(ctx: AppContext, q: { page: number; pageSize: number; status?: FeedbackStatus | undefined; category?: FeedbackCategory | undefined }) {
  const cond: SQL[] = [];
  if (q.status) cond.push(eq(platformFeedbacks.status, q.status));
  if (q.category) cond.push(eq(platformFeedbacks.category, q.category));
  const where = cond.length ? and(...cond) : undefined;
  const items = await ctx.db
    .select({
      id: platformFeedbacks.id, category: platformFeedbacks.category, rating: platformFeedbacks.rating,
      message: platformFeedbacks.message, status: platformFeedbacks.status, createdAt: platformFeedbacks.createdAt,
      userId: users.id, userName: users.name, userRole: users.role,
    })
    .from(platformFeedbacks)
    .innerJoin(users, eq(users.id, platformFeedbacks.userId))
    .where(where)
    .orderBy(desc(platformFeedbacks.createdAt))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);
  const [t] = await ctx.db.select({ n: count() }).from(platformFeedbacks).where(where);
  return paged(items, t?.n ?? 0, q.page, q.pageSize);
}

export async function setFeedbackStatus(ctx: AppContext, actor: number, id: number, status: FeedbackStatus, ip?: string) {
  const [row] = await ctx.db
    .update(platformFeedbacks)
    .set({ status, handledByAdminId: actor, handledAt: new Date() })
    .where(eq(platformFeedbacks.id, id))
    .returning({ id: platformFeedbacks.id });
  if (!row) throw notFound('Feedback não encontrado.');
  await writeAudit(ctx.db, { actorType: 'ADMIN', actorId: actor, action: 'feedback.status', entityType: 'feedback', entityId: id, metadata: { status }, ...(ip ? { ip } : {}) });
}

/* ------------------------------------------------------------------ chamados */

export async function listTickets(ctx: AppContext, q: { page: number; pageSize: number; status?: TicketStatus | undefined; category?: TicketCategory | undefined; waiting?: '1' | undefined }) {
  const cond: SQL[] = [];
  if (q.status) cond.push(eq(supportTickets.status, q.status));
  if (q.category) cond.push(eq(supportTickets.category, q.category));
  if (q.waiting) {
    cond.push(eq(supportTickets.lastMessageBy, 'USER'));
    if (!q.status) cond.push(eq(supportTickets.status, 'OPEN')); // fechado nunca "aguarda"
  }
  const where = cond.length ? and(...cond) : undefined;
  const items = await ctx.db
    .select({
      id: supportTickets.id, subject: supportTickets.subject, category: supportTickets.category, status: supportTickets.status,
      lastMessageAt: supportTickets.lastMessageAt, lastMessageBy: supportTickets.lastMessageBy, createdAt: supportTickets.createdAt,
      userId: users.id, userName: users.name, userRole: users.role, shopId: shops.id, shopName: shops.name,
    })
    .from(supportTickets)
    .innerJoin(users, eq(users.id, supportTickets.userId))
    .leftJoin(shops, eq(shops.id, supportTickets.shopId))
    .where(where)
    .orderBy(desc(supportTickets.lastMessageAt))
    .limit(q.pageSize)
    .offset((q.page - 1) * q.pageSize);
  const [t] = await ctx.db.select({ n: count() }).from(supportTickets).where(where);
  return paged(items, t?.n ?? 0, q.page, q.pageSize);
}

export async function ticketDetail(ctx: AppContext, id: number) {
  const [t] = await ctx.db
    .select({
      id: supportTickets.id, subject: supportTickets.subject, category: supportTickets.category, status: supportTickets.status,
      createdAt: supportTickets.createdAt, lastMessageAt: supportTickets.lastMessageAt,
      userId: users.id, userName: users.name, userEmail: users.email, userRole: users.role, shopId: shops.id, shopName: shops.name,
    })
    .from(supportTickets)
    .innerJoin(users, eq(users.id, supportTickets.userId))
    .leftJoin(shops, eq(shops.id, supportTickets.shopId))
    .where(eq(supportTickets.id, id))
    .limit(1);
  if (!t) throw notFound('Chamado não encontrado.');
  const messages = await ctx.db
    .select({ id: ticketMessages.id, authorType: ticketMessages.authorType, body: ticketMessages.body, createdAt: ticketMessages.createdAt })
    .from(ticketMessages)
    .where(eq(ticketMessages.ticketId, id))
    .orderBy(ticketMessages.createdAt, ticketMessages.id);
  return { ...t, messages };
}

export async function replyTicket(ctx: AppContext, actor: number, id: number, message: string, ip?: string) {
  const [t] = await ctx.db.select({ id: supportTickets.id, userId: supportTickets.userId, status: supportTickets.status }).from(supportTickets).where(eq(supportTickets.id, id)).limit(1);
  if (!t) throw notFound('Chamado não encontrado.');
  if (t.status === 'CLOSED') throw unprocessable('O chamado está encerrado. Reabra antes de responder.', 'TICKET_CLOSED');
  await ctx.db.transaction(async (tx) => {
    const [m] = await tx.insert(ticketMessages).values({ ticketId: id, authorType: 'ADMIN', authorAdminId: actor, body: message }).returning({ id: ticketMessages.id });
    await tx.update(supportTickets).set({ status: 'IN_PROGRESS', lastMessageBy: 'ADMIN', lastMessageAt: new Date(), updatedAt: new Date() }).where(eq(supportTickets.id, id));
    await insertNotifications(tx, [{
      userId: t.userId, type: 'INFO', title: 'A equipe respondeu seu chamado',
      message: 'Abra o chamado em Suporte para ler a resposta.', data: { ticketId: id }, requiresAck: false,
      sourceKey: `ticket:${id}:${m!.id}`,
    }]);
    // Auditoria nunca guarda o texto da mensagem, só o tamanho
    await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: 'ticket.reply', entityType: 'ticket', entityId: id, metadata: { messageLength: message.length }, ...(ip ? { ip } : {}) });
  });
}

export async function setTicketStatus(ctx: AppContext, actor: number, id: number, status: TicketStatus, ip?: string) {
  const [row] = await ctx.db
    .update(supportTickets)
    .set({ status, closedAt: status === 'CLOSED' ? new Date() : null, updatedAt: new Date() })
    .where(eq(supportTickets.id, id))
    .returning({ id: supportTickets.id });
  if (!row) throw notFound('Chamado não encontrado.');
  await writeAudit(ctx.db, { actorType: 'ADMIN', actorId: actor, action: 'ticket.status', entityType: 'ticket', entityId: id, metadata: { status }, ...(ip ? { ip } : {}) });
}
