import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { notifications, type DbOrTx, type NewNotification, type Notification } from '@marqueaqui/database';

/** Idempotente: o mesmo (usuário, sourceKey) nunca gera duas notificações. */
export async function insertNotifications(db: DbOrTx, rows: NewNotification[]): Promise<void> {
  if (!rows.length) return;
  // lotes para não estourar o limite de parâmetros do PostgreSQL
  for (let i = 0; i < rows.length; i += 500) {
    await db
      .insert(notifications)
      .values(rows.slice(i, i + 500))
      .onConflictDoNothing({ target: [notifications.userId, notifications.sourceKey] });
  }
}

export async function listPending(db: DbOrTx, userId: number): Promise<Notification[]> {
  return db
    .select()
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.requiresAck, true), isNull(notifications.ackedAt)),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(50);
}

export async function listRecent(db: DbOrTx, userId: number, limit: number, offset: number) {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(limit)
    .offset(offset);
  const [total] = await db.select({ n: count() }).from(notifications).where(eq(notifications.userId, userId));
  const [unread] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return { rows, total: total?.n ?? 0, unread: unread?.n ?? 0 };
}

export async function findOwned(db: DbOrTx, id: number, userId: number): Promise<Notification | undefined> {
  const [row] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .limit(1);
  return row;
}

export async function ack(db: DbOrTx, id: number, userId: number): Promise<boolean> {
  const rows = await db
    .update(notifications)
    .set({ ackedAt: sql`coalesce(${notifications.ackedAt}, now())`, readAt: sql`coalesce(${notifications.readAt}, now())` })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning({ id: notifications.id });
  return rows.length === 1;
}

export async function markRead(db: DbOrTx, id: number, userId: number): Promise<boolean> {
  const rows = await db
    .update(notifications)
    .set({ readAt: sql`coalesce(${notifications.readAt}, now())` })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning({ id: notifications.id });
  return rows.length === 1;
}

export async function countPending(db: DbOrTx, userId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.requiresAck, true), isNull(notifications.ackedAt)),
    );
  return row?.n ?? 0;
}
