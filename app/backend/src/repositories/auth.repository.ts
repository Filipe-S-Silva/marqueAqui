import { and, eq, isNull, lt, ne, sql } from 'drizzle-orm';
import {
  barbers,
  passwordResetTokens,
  sessions,
  shopManagers,
  shops,
  users,
  type DbOrTx,
  type NewUser,
  type Session,
  type User,
  type UserRole,
} from '@marqueaqui/database';

export async function findUserByEmail(db: DbOrTx, email: string): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row;
}

export async function findUserById(db: DbOrTx, id: number): Promise<User | undefined> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

export async function insertUser(db: DbOrTx, values: NewUser): Promise<User> {
  const [row] = await db.insert(users).values(values).returning();
  return row!;
}

export async function touchLogin(db: DbOrTx, userId: number): Promise<void> {
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
}

export async function updatePassword(
  db: DbOrTx,
  userId: number,
  passwordHash: string,
  mustChangePassword: boolean,
): Promise<void> {
  await db.update(users).set({ passwordHash, mustChangePassword }).where(eq(users.id, userId));
}

export async function setMustChangePassword(db: DbOrTx, userId: number, value: boolean): Promise<void> {
  await db.update(users).set({ mustChangePassword: value }).where(eq(users.id, userId));
}

/* ----------------------------------------------------------- empresas */

export interface UserShop {
  id: number;
  name: string;
  /** Linha de `barbers` do usuário nesta empresa (profissional, ou gestor que atende também). */
  barberId: number | null;
}

/** Empresas ATIVAS às quais o usuário está vinculado com vínculo ativo. */
export async function listUserShops(db: DbOrTx, user: { id: number; role: UserRole }): Promise<UserShop[]> {
  if (user.role === 'CLIENT') return [];
  if (user.role === 'MANAGER') {
    return db
      .select({ id: shops.id, name: shops.name, barberId: barbers.id })
      .from(shopManagers)
      .innerJoin(shops, eq(shops.id, shopManagers.shopId))
      .leftJoin(
        barbers,
        and(eq(barbers.shopId, shops.id), eq(barbers.userId, user.id), eq(barbers.active, true)),
      )
      .where(and(eq(shopManagers.userId, user.id), eq(shopManagers.active, true), eq(shops.active, true)))
      .orderBy(shops.name);
  }
  return db
    .select({ id: shops.id, name: shops.name, barberId: barbers.id })
    .from(barbers)
    .innerJoin(shops, eq(shops.id, barbers.shopId))
    .where(and(eq(barbers.userId, user.id), eq(barbers.active, true), eq(shops.active, true)))
    .orderBy(shops.name);
}

/* ------------------------------------------------------------ sessões */

export async function insertSession(db: DbOrTx, values: typeof sessions.$inferInsert): Promise<Session> {
  const [row] = await db.insert(sessions).values(values).returning();
  return row!;
}

export async function findSessionWithUser(
  db: DbOrTx,
  sessionId: string,
): Promise<{ session: Session; user: User } | undefined> {
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  return row;
}

export async function findSessionByTokenHash(db: DbOrTx, tokenHash: string): Promise<Session | undefined> {
  const [row] = await db.select().from(sessions).where(eq(sessions.tokenHash, tokenHash)).limit(1);
  return row;
}

export async function markSessionRotated(db: DbOrTx, sessionId: string): Promise<boolean> {
  // Só uma requisição consegue rotacionar: protege contra uso paralelo do mesmo refresh token
  const rows = await db
    .update(sessions)
    .set({ rotatedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.rotatedAt), isNull(sessions.revokedAt)))
    .returning({ id: sessions.id });
  return rows.length === 1;
}

export async function revokeFamily(db: DbOrTx, familyId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.familyId, familyId), isNull(sessions.revokedAt)));
}

export async function revokeUserSessions(db: DbOrTx, userId: number, exceptSessionId?: string): Promise<void> {
  const conditions = [eq(sessions.userId, userId), isNull(sessions.revokedAt)];
  if (exceptSessionId) conditions.push(ne(sessions.id, exceptSessionId));
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(...conditions));
}

export async function setSessionShop(db: DbOrTx, sessionId: string, shopId: number | null): Promise<void> {
  await db.update(sessions).set({ activeShopId: shopId }).where(eq(sessions.id, sessionId));
}

export async function deleteExpiredSessions(db: DbOrTx, olderThan: Date): Promise<number> {
  const rows = await db.delete(sessions).where(lt(sessions.expiresAt, olderThan)).returning({ id: sessions.id });
  return rows.length;
}

/* ------------------------------------------------- redefinição de senha */

export async function replacePasswordResetToken(
  db: DbOrTx,
  userId: number,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  await db
    .delete(passwordResetTokens)
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
  await db.insert(passwordResetTokens).values({ userId, tokenHash, expiresAt });
}

export async function findResetToken(db: DbOrTx, tokenHash: string) {
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);
  return row;
}

export async function consumeResetToken(db: DbOrTx, id: number): Promise<boolean> {
  const rows = await db
    .update(passwordResetTokens)
    .set({ usedAt: sql`now()` })
    .where(and(eq(passwordResetTokens.id, id), isNull(passwordResetTokens.usedAt)))
    .returning({ id: passwordResetTokens.id });
  return rows.length === 1;
}

export async function updateProfile(
  db: DbOrTx,
  userId: number,
  v: Partial<{ name: string; phone: string | null | undefined; photoUrl: string | null; description: string | null }>,
): Promise<void> {
  await db.update(users).set(v).where(eq(users.id, userId));
}
