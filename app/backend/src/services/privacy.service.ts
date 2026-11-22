// Direitos do titular (LGPD, Arts. 18 e 19): cópia dos dados e exclusão da própria conta.
import { randomBytes } from 'node:crypto';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  appointments, hashPassword, minutesToTime, notifications, nowInBusinessTz, passwordResetTokens, platformFeedbacks,
  services, sessions, shopReviews, shops, supportTickets, ticketMessages, userPhotos, users, verifyPassword,
} from '@marqueaqui/database';
import * as authRepo from '../repositories/auth.repository.ts';
import { writeAudit } from '../repositories/audit.repository.ts';
import type { AppContext, AuthContext, ClientInfo } from '../types/app-context.ts';
import { conflict, tooManyRequests, unauthorized, unprocessable } from '../utils/errors.ts';

/** Tudo o que a plataforma guarda sobre o titular, em JSON (Art. 18, II e V; Art. 19, II). */
export async function exportMyData(ctx: AppContext, auth: AuthContext) {
  const db = ctx.db;
  const user = await authRepo.findUserById(db, auth.userId);
  if (!user) throw unauthorized('Sessão inválida.', 'SESSION_INVALID');
  const { passwordHash: _h, failedLoginAttempts: _f, lockedUntil: _l, ...profile } = user;

  const [myAppointments, reviews, feedbacks, tickets, myNotifications, mySessions] = await Promise.all([
    db.select({
      id: appointments.id, shop: shops.name, service: services.name, date: appointments.date, startTime: appointments.startTime,
      endTime: appointments.endTime, status: appointments.status, priceCents: appointments.priceCents,
      clientName: appointments.clientName, clientPhone: appointments.clientPhone, notes: appointments.notes, createdAt: appointments.createdAt,
    }).from(appointments)
      .innerJoin(shops, eq(shops.id, appointments.shopId))
      .innerJoin(services, eq(services.id, appointments.serviceId))
      .where(eq(appointments.clientId, auth.userId)).orderBy(asc(appointments.date)),
    db.select({ shop: shops.name, serviceName: shopReviews.serviceName, appointmentDate: shopReviews.appointmentDate, rating: shopReviews.rating, comment: shopReviews.comment, reply: shopReviews.reply, createdAt: shopReviews.createdAt })
      .from(shopReviews).innerJoin(shops, eq(shops.id, shopReviews.shopId)).where(eq(shopReviews.clientId, auth.userId)),
    db.select({ category: platformFeedbacks.category, rating: platformFeedbacks.rating, message: platformFeedbacks.message, createdAt: platformFeedbacks.createdAt })
      .from(platformFeedbacks).where(eq(platformFeedbacks.userId, auth.userId)),
    db.select({ id: supportTickets.id, subject: supportTickets.subject, category: supportTickets.category, status: supportTickets.status, createdAt: supportTickets.createdAt })
      .from(supportTickets).where(eq(supportTickets.userId, auth.userId)),
    db.select({ title: notifications.title, message: notifications.message, createdAt: notifications.createdAt, readAt: notifications.readAt })
      .from(notifications).where(eq(notifications.userId, auth.userId)),
    db.select({ createdAt: sessions.createdAt, expiresAt: sessions.expiresAt, revokedAt: sessions.revokedAt, ip: sessions.ip, userAgent: sessions.userAgent })
      .from(sessions).where(eq(sessions.userId, auth.userId)),
  ]);
  const messages = tickets.length
    ? await db.select({ ticketId: ticketMessages.ticketId, authorType: ticketMessages.authorType, body: ticketMessages.body, createdAt: ticketMessages.createdAt })
      .from(ticketMessages).where(inArray(ticketMessages.ticketId, tickets.map((t) => t.id))).orderBy(asc(ticketMessages.createdAt))
    : [];

  await writeAudit(db, { actorType: 'USER', actorId: auth.userId, action: 'privacy.export', entityType: 'user', entityId: auth.userId });
  return {
    generatedAt: new Date().toISOString(),
    profile,
    appointments: myAppointments,
    reviews,
    feedbacks,
    supportTickets: tickets.map((t) => ({ ...t, messages: messages.filter((m) => m.ticketId === t.id) })),
    notifications: myNotifications,
    sessions: mySessions,
  };
}

/**
 * Exclusão da conta pelo próprio titular (Art. 18, VI). A conta é anonimizada, não apagada: agendamentos têm
 * FK restrict e entram nos relatórios das empresas até a retenção apagá-los. Sessões (IP) ficam até expirar:
 * registros de acesso precisam ser guardados por 6 meses (Marco Civil, Art. 15; LGPD, Art. 16, I).
 * shortcut: só clientes; profissional e gestor dependem da empresa e são tratados pelo suporte (ADM).
 */
export async function deleteMyAccount(ctx: AppContext, client: ClientInfo, auth: AuthContext, password: string): Promise<void> {
  const user = await authRepo.findUserById(ctx.db, auth.userId);
  if (!user) throw unauthorized('Sessão inválida.', 'SESSION_INVALID');
  if (user.role !== 'CLIENT') {
    throw conflict('Contas de profissional ou gestor são excluídas pelo suporte, porque estão ligadas a uma empresa. Abra um chamado.', 'DELETE_VIA_SUPPORT');
  }
  const limit = await ctx.limiters.loginPair.peek(`pw|${user.id}`); // mesmo limite da troca de senha
  if (limit.limited) throw tooManyRequests(limit.retryAfterSeconds);
  if (!(await verifyPassword(user.passwordHash, password)).valid) {
    await ctx.limiters.loginPair.hit(`pw|${user.id}`);
    throw unprocessable('Senha incorreta.', 'CURRENT_PASSWORD_WRONG');
  }

  const now = new Date();
  const today = nowInBusinessTz(now);
  const lockedHash = await hashPassword(randomBytes(32).toString('base64url'));
  await ctx.db.transaction(async (tx) => {
    // Agendamentos futuros são cancelados e liberam o horário
    await tx.update(appointments).set({ status: 'CANCELLED', cancelReason: 'CLIENT', cancelledAt: now, cancelledByUserId: user.id })
      .where(and(
        eq(appointments.clientId, user.id), eq(appointments.status, 'CONFIRMED'),
        sql`(${appointments.date}, ${appointments.startTime}) > (${today.date}, ${minutesToTime(today.minutes)})`,
      ));
    await tx.update(appointments).set({ clientName: 'Cliente removido', clientPhone: null, notes: null }).where(eq(appointments.clientId, user.id));
    await tx.update(shopReviews).set({ comment: null }).where(eq(shopReviews.clientId, user.id));
    await tx.delete(platformFeedbacks).where(eq(platformFeedbacks.userId, user.id));
    await tx.delete(supportTickets).where(eq(supportTickets.userId, user.id)); // mensagens vão junto (cascade)
    await tx.delete(notifications).where(eq(notifications.userId, user.id));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await tx.delete(userPhotos).where(eq(userPhotos.userId, user.id));
    await tx.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.userId, user.id), isNull(sessions.revokedAt)));
    await tx.update(users).set({
      name: 'Usuário removido', email: `removido-${user.id}@removido.invalid`, phone: null, photoUrl: null, description: null,
      passwordHash: lockedHash, active: false, deactivatedAt: now, deactivationReason: 'SELF_DELETED',
    }).where(eq(users.id, user.id));
    await writeAudit(tx, { actorType: 'USER', actorId: user.id, action: 'privacy.self_delete', entityType: 'user', entityId: user.id, ip: client.ip });
  });
}
