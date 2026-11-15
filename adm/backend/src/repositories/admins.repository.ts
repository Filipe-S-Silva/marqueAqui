import { and, asc, count, eq, ne } from 'drizzle-orm';
import { admins, type Admin, type DbOrTx } from '@marqueaqui/database';

export async function findByHmac(db: DbOrTx, hmac: string): Promise<Admin | undefined> {
  const [row] = await db.select().from(admins).where(eq(admins.emailHmac, hmac)).limit(1);
  return row;
}
export async function findById(db: DbOrTx, id: number): Promise<Admin | undefined> {
  const [row] = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
  return row;
}
export async function list(db: DbOrTx) {
  // O e-mail nunca é devolvido: só existe o HMAC, que não é reversível
  return db
    .select({ id: admins.id, name: admins.name, active: admins.active, lastLoginAt: admins.lastLoginAt, createdAt: admins.createdAt, lockedUntil: admins.lockedUntil, mustChangePassword: admins.mustChangePassword, totpEnabledAt: admins.totpEnabledAt })
    .from(admins)
    .orderBy(asc(admins.name));
}
export async function insert(db: DbOrTx, v: { name: string; emailHmac: string; passwordHash: string; mustChangePassword?: boolean }): Promise<Admin> {
  const [row] = await db.insert(admins).values(v).returning();
  return row!;
}
export async function update(db: DbOrTx, id: number, v: Partial<{ name: string; passwordHash: string; active: boolean; lastLoginAt: Date; mustChangePassword: boolean }>) {
  const [row] = await db.update(admins).set(v).where(eq(admins.id, id)).returning();
  return row;
}
export async function countActiveExcept(db: DbOrTx, id: number): Promise<number> {
  const [r] = await db.select({ n: count() }).from(admins).where(and(eq(admins.active, true), ne(admins.id, id)));
  return r?.n ?? 0;
}
