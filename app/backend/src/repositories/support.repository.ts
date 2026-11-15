import { aliasedTable, and, avg, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import {
  appointments,
  barbers,
  platformFeedbacks,
  services,
  shopReviews,
  supportTickets,
  ticketMessages,
  users,
  type DbOrTx,
  type FeedbackCategory,
  type TicketCategory,
  type TicketStatus,
} from '@marqueaqui/database';

/* ---------------------------------------------------------------- feedbacks */

export async function insertFeedback(
  db: DbOrTx,
  row: { userId: number; category: FeedbackCategory; rating: number | null; message: string },
) {
  const [r] = await db.insert(platformFeedbacks).values(row).returning({ id: platformFeedbacks.id });
  return r!;
}

export async function listFeedbackOfUser(db: DbOrTx, userId: number, limit = 20) {
  return db
    .select({
      id: platformFeedbacks.id,
      category: platformFeedbacks.category,
      rating: platformFeedbacks.rating,
      message: platformFeedbacks.message,
      createdAt: platformFeedbacks.createdAt,
    })
    .from(platformFeedbacks)
    .where(eq(platformFeedbacks.userId, userId))
    .orderBy(desc(platformFeedbacks.createdAt))
    .limit(limit);
}

/* ------------------------------------------------------------------ chamados */

export async function insertTicket(
  db: DbOrTx,
  row: { userId: number; shopId: number | null; subject: string; category: TicketCategory },
) {
  const [r] = await db.insert(supportTickets).values(row).returning();
  return r!;
}

export async function insertTicketMessage(
  db: DbOrTx,
  row: { ticketId: number; authorType: 'USER' | 'ADMIN'; authorUserId?: number | null; authorAdminId?: number | null; body: string },
) {
  const [r] = await db.insert(ticketMessages).values(row).returning({ id: ticketMessages.id });
  return r!;
}

export async function listTicketsOfUser(db: DbOrTx, userId: number, page: number, pageSize: number) {
  const where = eq(supportTickets.userId, userId);
  const items = await db
    .select({
      id: supportTickets.id,
      subject: supportTickets.subject,
      category: supportTickets.category,
      status: supportTickets.status,
      lastMessageAt: supportTickets.lastMessageAt,
      lastMessageBy: supportTickets.lastMessageBy,
      createdAt: supportTickets.createdAt,
    })
    .from(supportTickets)
    .where(where)
    .orderBy(desc(supportTickets.lastMessageAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [t] = await db.select({ n: count() }).from(supportTickets).where(where);
  return { items, total: t?.n ?? 0 };
}

/** O filtro por dono está na própria consulta: chamado alheio simplesmente não é encontrado. */
export async function findTicketOfUser(db: DbOrTx, id: number, userId: number) {
  const [row] = await db
    .select()
    .from(supportTickets)
    .where(and(eq(supportTickets.id, id), eq(supportTickets.userId, userId)))
    .limit(1);
  return row;
}

export async function listTicketMessages(db: DbOrTx, ticketId: number) {
  return db
    .select({ id: ticketMessages.id, authorType: ticketMessages.authorType, body: ticketMessages.body, createdAt: ticketMessages.createdAt })
    .from(ticketMessages)
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(ticketMessages.createdAt, ticketMessages.id);
}

export async function touchTicket(db: DbOrTx, id: number, patch: { status?: TicketStatus; lastMessageBy?: 'USER' | 'ADMIN'; closedAt?: Date | null }) {
  await db
    .update(supportTickets)
    .set({ ...patch, lastMessageAt: new Date(), updatedAt: new Date() })
    .where(eq(supportTickets.id, id));
}

/* ----------------------------------------------------------------- avaliações */

export async function findAppointmentOfClient(db: DbOrTx, id: number, clientId: number) {
  const [row] = await db
    .select({
      id: appointments.id, shopId: appointments.shopId, barberId: appointments.barberId, status: appointments.status,
      date: appointments.date, serviceName: services.name,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(and(eq(appointments.id, id), eq(appointments.clientId, clientId)))
    .limit(1);
  return row;
}

export async function insertReview(
  db: DbOrTx,
  row: { shopId: number; appointmentId: number; clientId: number; barberId: number | null; rating: number; comment: string | null; serviceName: string; appointmentDate: string },
) {
  const [r] = await db.insert(shopReviews).values(row).onConflictDoNothing({ target: shopReviews.appointmentId }).returning({ id: shopReviews.id });
  return r; // undefined = já existia avaliação deste atendimento
}

export async function reviewedAppointmentIds(db: DbOrTx, ids: number[]): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const rows = await db
    .select({ id: shopReviews.appointmentId })
    .from(shopReviews)
    .where(inArray(shopReviews.appointmentId, ids));
  return new Set(rows.map((r) => r.id));
}

export async function listShopReviews(db: DbOrTx, shopId: number, page: number, pageSize: number) {
  const pro = aliasedTable(users, 'pro_user');
  const items = await db
    .select({
      id: shopReviews.id,
      rating: shopReviews.rating,
      comment: shopReviews.comment,
      reply: shopReviews.reply,
      repliedAt: shopReviews.repliedAt,
      createdAt: shopReviews.createdAt,
      clientName: users.name,
      serviceName: shopReviews.serviceName,
      professionalName: pro.name,
      date: shopReviews.appointmentDate,
    })
    .from(shopReviews)
    .innerJoin(users, eq(users.id, shopReviews.clientId))
    .leftJoin(barbers, eq(barbers.id, shopReviews.barberId))
    .leftJoin(pro, eq(pro.id, barbers.userId))
    .where(eq(shopReviews.shopId, shopId))
    .orderBy(desc(shopReviews.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const [t] = await db.select({ n: count() }).from(shopReviews).where(eq(shopReviews.shopId, shopId));
  return { items, total: t?.n ?? 0 };
}

export async function reviewSummary(db: DbOrTx, shopId: number) {
  const [a] = await db
    .select({ average: avg(shopReviews.rating), total: count() })
    .from(shopReviews)
    .where(eq(shopReviews.shopId, shopId));
  const dist = await db
    .select({ rating: shopReviews.rating, n: count() })
    .from(shopReviews)
    .where(eq(shopReviews.shopId, shopId))
    .groupBy(shopReviews.rating);
  return { average: a?.average ? Number(a.average) : null, total: a?.total ?? 0, distribution: dist };
}

/** Responde somente a avaliação da empresa da sessão. Devolve a linha ou undefined. */
export async function setReviewReply(db: DbOrTx, id: number, shopId: number, reply: string, userId: number) {
  const [row] = await db
    .update(shopReviews)
    .set({ reply, repliedAt: new Date(), repliedByUserId: userId })
    .where(and(eq(shopReviews.id, id), eq(shopReviews.shopId, shopId), isNull(shopReviews.reply)))
    .returning({ id: shopReviews.id, clientId: shopReviews.clientId });
  return row;
}

/** Avaliações públicas da empresa (para quem vai agendar): só o primeiro nome do cliente. */
export async function listPublicReviews(db: DbOrTx, shopId: number, limit: number) {
  const items = await db
    .select({
      id: shopReviews.id, rating: shopReviews.rating, comment: shopReviews.comment, reply: shopReviews.reply,
      createdAt: shopReviews.createdAt, serviceName: shopReviews.serviceName, clientName: users.name,
    })
    .from(shopReviews)
    .innerJoin(users, eq(users.id, shopReviews.clientId))
    .where(eq(shopReviews.shopId, shopId))
    .orderBy(desc(shopReviews.createdAt))
    .limit(limit);
  return items.map((i) => ({ ...i, clientName: (i.clientName.split(' ')[0] ?? '').slice(0, 30) }));
}
