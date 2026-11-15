// Operações de conta reutilizadas por empresas e usuários, sempre dentro de uma transação.
import { appointments, barbers, hashPassword, minutesToTime, nowInBusinessTz, shopManagers, users, workingHours, type DbOrTx, type UserRole } from '@marqueaqui/database';
import { and, count, eq, sql } from 'drizzle-orm';
import { conflict } from '../utils/errors.ts';

export const DEFAULT_HOURS = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: '09:00', endTime: '18:00' }));

export async function findUserByEmail(db: DbOrTx, email: string) {
  const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return row;
}

export async function insertUser(db: DbOrTx, v: { name: string; email: string; phone?: string | undefined; role: UserRole; password: string; mustChangePassword: boolean }) {
  const [row] = await db.insert(users).values({
    name: v.name, email: v.email, phone: v.phone ?? null, role: v.role,
    passwordHash: await hashPassword(v.password), mustChangePassword: v.mustChangePassword,
  }).returning();
  return row!;
}

export async function linkManager(db: DbOrTx, shopId: number, userId: number) {
  await db.insert(shopManagers).values({ shopId, userId }).onConflictDoUpdate({ target: [shopManagers.shopId, shopManagers.userId], set: { active: true } });
}

/** Cria (ou reaproveita) a conta de gestor e a vincula à empresa. */
export async function insertManagerAccount(db: DbOrTx, defaultPassword: string, shopId: number, input: { name: string; email: string; phone?: string | undefined }) {
  const existing = await findUserByEmail(db, input.email);
  if (existing) {
    if (existing.role !== 'MANAGER' || !existing.active) throw conflict('Este e-mail pertence a outra conta e não pode ser vinculado como gestor.', 'EMAIL_UNAVAILABLE');
    await linkManager(db, shopId, existing.id);
    return { userId: existing.id, name: existing.name, email: existing.email, mustChangePassword: false };
  }
  const u = await insertUser(db, { ...input, role: 'MANAGER', password: defaultPassword, mustChangePassword: true });
  await linkManager(db, shopId, u.id);
  return { userId: u.id, name: u.name, email: u.email, mustChangePassword: true };
}

/** Vínculo de profissional com a empresa; cria expediente padrão apenas na primeira vez. */
export async function linkProfessional(db: DbOrTx, shopId: number, userId: number) {
  const [existing] = await db.select().from(barbers).where(and(eq(barbers.userId, userId), eq(barbers.shopId, shopId))).limit(1);
  if (existing) {
    await db.update(barbers).set({ active: true, deactivatedAt: null }).where(eq(barbers.id, existing.id));
    return existing.id;
  }
  const [b] = await db.insert(barbers).values({ userId, shopId }).returning();
  await db.insert(workingHours).values(DEFAULT_HOURS.map((h) => ({ barberId: b!.id, ...h })));
  return b!.id;
}

export async function futureConfirmedCount(db: DbOrTx, where: { barberId?: number; clientId?: number }): Promise<number> {
  const now = nowInBusinessTz();
  const [r] = await db.select({ n: count() }).from(appointments).where(and(
    eq(appointments.status, 'CONFIRMED'),
    sql`(${appointments.date}, ${appointments.startTime}) > (${now.date}, ${minutesToTime(now.minutes)})`,
    ...(where.barberId ? [eq(appointments.barberId, where.barberId)] : []),
    ...(where.clientId ? [eq(appointments.clientId, where.clientId)] : []),
  ));
  return r?.n ?? 0;
}


