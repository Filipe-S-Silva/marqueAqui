import { and, desc, eq, gt, lte, ne, count } from 'drizzle-orm';
import { adminSessions, admins, type DbOrTx } from '@marqueaqui/database';

export async function create(db: DbOrTx, v: { adminId: number; tokenHash: string; expiresAt: Date; ip?: string | undefined; userAgent?: string | undefined }) {
  const [row] = await db.insert(adminSessions).values({ ...v, ip: v.ip ?? null, userAgent: v.userAgent?.slice(0, 255) ?? null }).returning();
  return row!;
}

/** Sessão + administrador em uma consulta; quem chama confere validade e conta ativa. */
export async function findByTokenHash(db: DbOrTx, tokenHash: string) {
  const [row] = await db
    .select({ session: adminSessions, admin: admins })
    .from(adminSessions)
    .innerJoin(admins, eq(admins.id, adminSessions.adminId))
    .where(eq(adminSessions.tokenHash, tokenHash))
    .limit(1);
  return row;
}

export async function deleteById(db: DbOrTx, id: string): Promise<void> {
  await db.delete(adminSessions).where(eq(adminSessions.id, id));
}

/** Logout e revogação APAGAM as linhas (a sessão deixa de existir). */
export async function deleteAllFor(db: DbOrTx, adminId: number, exceptId?: string): Promise<number> {
  const rows = await db
    .delete(adminSessions)
    .where(and(eq(adminSessions.adminId, adminId), ...(exceptId ? [ne(adminSessions.id, exceptId)] : [])))
    .returning({ id: adminSessions.id });
  return rows.length;
}

export async function purgeExpired(db: DbOrTx, adminId: number): Promise<void> {
  await db.delete(adminSessions).where(and(eq(adminSessions.adminId, adminId), lte(adminSessions.expiresAt, new Date())));
}

export async function listActive(db: DbOrTx, adminId: number) {
  return db
    .select({ id: adminSessions.id, createdAt: adminSessions.createdAt, expiresAt: adminSessions.expiresAt, ip: adminSessions.ip, userAgent: adminSessions.userAgent })
    .from(adminSessions)
    .where(and(eq(adminSessions.adminId, adminId), gt(adminSessions.expiresAt, new Date())))
    .orderBy(desc(adminSessions.createdAt));
}

export async function countActive(db: DbOrTx, adminId: number): Promise<number> {
  const [r] = await db.select({ n: count() }).from(adminSessions).where(and(eq(adminSessions.adminId, adminId), gt(adminSessions.expiresAt, new Date())));
  return r?.n ?? 0;
}
