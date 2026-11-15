import * as repo from '../repositories/notifications.repository.ts';
import type { AppContext, AuthContext } from '../types/app-context.ts';
import { notFound } from '../utils/errors.ts';

const view = (n: Awaited<ReturnType<typeof repo.listPending>>[number]) => ({
  id: n.id,
  type: n.type,
  title: n.title,
  message: n.message,
  data: n.data,
  requiresAck: n.requiresAck,
  acked: n.ackedAt !== null,
  read: n.readAt !== null,
  createdAt: n.createdAt,
});

export async function pending(ctx: AppContext, auth: AuthContext) {
  return (await repo.listPending(ctx.db, auth.userId)).map(view);
}

export async function list(ctx: AppContext, auth: AuthContext, page: number, pageSize: number) {
  const { rows, total, unread } = await repo.listRecent(ctx.db, auth.userId, pageSize, (page - 1) * pageSize);
  return { items: rows.map(view), page, pageSize, total, unread, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

// Sempre filtrado pelo dono: notificação alheia responde 404
export async function ack(ctx: AppContext, auth: AuthContext, id: number) {
  if (!(await repo.ack(ctx.db, id, auth.userId))) throw notFound('Notificação não encontrada.');
}

export async function read(ctx: AppContext, auth: AuthContext, id: number) {
  if (!(await repo.markRead(ctx.db, id, auth.userId))) throw notFound('Notificação não encontrada.');
}
