import type { z } from 'zod';
import { writeAudit } from '../repositories/audit.repository.ts';
import * as notificationsRepo from '../repositories/notifications.repository.ts';
import { managerUserIds } from '../repositories/manager.repository.ts';
import * as repo from '../repositories/support.repository.ts';
import { getShop } from '../repositories/scheduling.repository.ts';
import type * as s from '../schemas/support.schemas.ts';
import type { AppContext, AuthContext } from '../types/app-context.ts';
import { conflict, forbidden, notFound, tooManyRequests, unprocessable } from '../utils/errors.ts';

const paged = <T>(items: T[], total: number, page: number, pageSize: number) => ({
  items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
});

async function throttle(ctx: AppContext, key: string): Promise<void> {
  const r = await ctx.limiters.submit.hit(key);
  if (r.limited) throw tooManyRequests(r.retryAfterSeconds, 'Você enviou muitas mensagens em pouco tempo. Aguarde um pouco.');
}

/* ---------------------------------------------------------------- feedbacks */

export async function sendFeedback(ctx: AppContext, auth: AuthContext, input: z.infer<typeof s.feedbackBody>) {
  await throttle(ctx, `fb|${auth.userId}`);
  const row = await repo.insertFeedback(ctx.db, {
    userId: auth.userId, category: input.category, rating: input.rating ?? null, message: input.message,
  });
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'feedback.create', entityType: 'feedback', entityId: row.id });
  return { id: row.id };
}

export async function myFeedback(ctx: AppContext, auth: AuthContext) {
  return repo.listFeedbackOfUser(ctx.db, auth.userId);
}

/* ------------------------------------------------------------------ chamados */

export async function openTicket(ctx: AppContext, auth: AuthContext, input: z.infer<typeof s.ticketCreateBody>) {
  await throttle(ctx, `tk|${auth.userId}`);
  const ticket = await ctx.db.transaction(async (tx) => {
    const t = await repo.insertTicket(tx, { userId: auth.userId, shopId: auth.shopId, subject: input.subject, category: input.category });
    await repo.insertTicketMessage(tx, { ticketId: t.id, authorType: 'USER', authorUserId: auth.userId, body: input.message });
    return t;
  });
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'ticket.create', entityType: 'ticket', entityId: ticket.id });
  return { id: ticket.id };
}

export async function myTickets(ctx: AppContext, auth: AuthContext, q: { page: number; pageSize: number }) {
  const { items, total } = await repo.listTicketsOfUser(ctx.db, auth.userId, q.page, q.pageSize);
  return paged(items, total, q.page, q.pageSize);
}

export async function myTicket(ctx: AppContext, auth: AuthContext, id: number) {
  const ticket = await repo.findTicketOfUser(ctx.db, id, auth.userId);
  if (!ticket) throw notFound('Chamado não encontrado.', 'TICKET_NOT_FOUND'); // 404 também para chamado de outra pessoa
  return {
    id: ticket.id, subject: ticket.subject, category: ticket.category, status: ticket.status,
    createdAt: ticket.createdAt, lastMessageAt: ticket.lastMessageAt,
    messages: await repo.listTicketMessages(ctx.db, ticket.id),
  };
}

export async function replyToMyTicket(ctx: AppContext, auth: AuthContext, id: number, input: z.infer<typeof s.ticketMessageBody>) {
  await throttle(ctx, `msg|${auth.userId}`);
  const ticket = await repo.findTicketOfUser(ctx.db, id, auth.userId);
  if (!ticket) throw notFound('Chamado não encontrado.', 'TICKET_NOT_FOUND');
  if (ticket.status === 'CLOSED') throw unprocessable('Este chamado está encerrado. Abra um novo chamado.', 'TICKET_CLOSED');
  await ctx.db.transaction(async (tx) => {
    await repo.insertTicketMessage(tx, { ticketId: id, authorType: 'USER', authorUserId: auth.userId, body: input.message });
    // Resposta do usuário reabre o atendimento
    await repo.touchTicket(tx, id, { status: 'OPEN', lastMessageBy: 'USER' });
  });
}

export async function closeMyTicket(ctx: AppContext, auth: AuthContext, id: number) {
  const ticket = await repo.findTicketOfUser(ctx.db, id, auth.userId);
  if (!ticket) throw notFound('Chamado não encontrado.', 'TICKET_NOT_FOUND');
  if (ticket.status === 'CLOSED') throw conflict('O chamado já está encerrado.', 'ALREADY_CLOSED');
  await repo.touchTicket(ctx.db, id, { status: 'CLOSED', closedAt: new Date() });
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'ticket.close', entityType: 'ticket', entityId: id });
}

/* ----------------------------------------------------------------- avaliações */

export async function reviewAppointment(ctx: AppContext, auth: AuthContext, appointmentId: number, input: z.infer<typeof s.reviewBody>) {
  await throttle(ctx, `rv|${auth.userId}`);
  // Só o próprio cliente do atendimento; o de outra pessoa responde 404
  const appt = await repo.findAppointmentOfClient(ctx.db, appointmentId, auth.userId);
  if (!appt) throw notFound('Agendamento não encontrado.');
  if (appt.status !== 'COMPLETED') throw unprocessable('Só é possível avaliar atendimentos concluídos.', 'NOT_COMPLETED');
  const row = await repo.insertReview(ctx.db, {
    shopId: appt.shopId, appointmentId, clientId: auth.userId, barberId: appt.barberId, rating: input.rating, comment: input.comment,
    serviceName: appt.serviceName, appointmentDate: appt.date,
  });
  if (!row) throw conflict('Você já avaliou este atendimento.', 'ALREADY_REVIEWED');
  await notificationsRepo.insertNotifications(
    ctx.db,
    (await managerUserIds(ctx.db, appt.shopId)).map((userId) => ({
      userId, type: 'INFO' as const, title: 'Nova avaliação de cliente',
      message: `Um cliente avaliou um atendimento com ${input.rating} de 5 estrelas. Veja em Avaliações.`,
      data: { reviewId: row.id }, requiresAck: false, sourceKey: `review:${row.id}`,
    })),
  );
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'review.create', entityType: 'review', entityId: row.id });
  return { id: row.id };
}

export async function annotateReviewed<T extends { id: number; status: string }>(ctx: AppContext, items: T[]) {
  const done = await repo.reviewedAppointmentIds(ctx.db, items.filter((i) => i.status === 'COMPLETED').map((i) => i.id));
  return items.map((i) => ({ ...i, reviewed: done.has(i.id), canReview: i.status === 'COMPLETED' && !done.has(i.id) }));
}

export async function shopReviews(ctx: AppContext, auth: AuthContext, q: { page: number; pageSize: number }) {
  if (auth.shopId === null) throw forbidden('Nenhuma empresa ativa vinculada à sua conta.', 'NO_ACTIVE_SHOP');
  const [{ items, total }, summary] = await Promise.all([
    repo.listShopReviews(ctx.db, auth.shopId, q.page, q.pageSize),
    repo.reviewSummary(ctx.db, auth.shopId),
  ]);
  return { summary, ...paged(items, total, q.page, q.pageSize) };
}

export async function replyToReview(ctx: AppContext, auth: AuthContext, reviewId: number, input: z.infer<typeof s.reviewReplyBody>) {
  if (auth.shopId === null) throw forbidden('Nenhuma empresa ativa vinculada à sua conta.', 'NO_ACTIVE_SHOP');
  const row = await repo.setReviewReply(ctx.db, reviewId, auth.shopId, input.reply, auth.userId); // filtra pela empresa da sessão
  if (!row) throw notFound('Avaliação não encontrada ou já respondida.', 'REVIEW_NOT_FOUND');
  await notificationsRepo.insertNotifications(ctx.db, [{
    userId: row.clientId, type: 'INFO', title: 'A empresa respondeu sua avaliação',
    message: 'Veja a resposta em Meus agendamentos.', data: { reviewId }, requiresAck: false, sourceKey: `review-reply:${reviewId}`,
  }]);
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'review.reply', entityType: 'review', entityId: reviewId });
}

/** Nota média e últimas avaliações de uma empresa, visíveis a qualquer visitante. */
export async function publicReviews(ctx: AppContext, shopId: number) {
  const shop = await getShop(ctx.db, shopId);
  if (!shop || !shop.active) throw notFound('Empresa não encontrada.', 'SHOP_NOT_FOUND');
  const [summary, items] = await Promise.all([repo.reviewSummary(ctx.db, shopId), repo.listPublicReviews(ctx.db, shopId, 10)]);
  return { average: summary.average, total: summary.total, items };
}
