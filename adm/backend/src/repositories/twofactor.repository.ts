import { and, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import { adminChallenges, adminRecoveryCodes, admins, type DbOrTx } from '@marqueaqui/database';

export async function setPendingSecret(db: DbOrTx, adminId: number, sealed: string) {
  await db.update(admins).set({ totpSecretEnc: sealed, totpEnabledAt: null, totpLastStep: null }).where(eq(admins.id, adminId));
}
export async function enable(db: DbOrTx, adminId: number, lastStep: number) {
  await db.update(admins).set({ totpEnabledAt: new Date(), totpLastStep: lastStep }).where(eq(admins.id, adminId));
}
export async function clear(db: DbOrTx, adminId: number) {
  await db.update(admins).set({ totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null }).where(eq(admins.id, adminId));
  await db.delete(adminRecoveryCodes).where(eq(adminRecoveryCodes.adminId, adminId));
  await db.delete(adminChallenges).where(eq(adminChallenges.adminId, adminId));
}

/** Avança o passo aceito de forma atômica: dois pedidos simultâneos com o mesmo código não passam os dois. */
export async function advanceStep(db: DbOrTx, adminId: number, step: number): Promise<boolean> {
  const rows = await db.update(admins).set({ totpLastStep: step })
    .where(and(eq(admins.id, adminId), sql`(${admins.totpLastStep} IS NULL OR ${admins.totpLastStep} < ${step})`))
    .returning({ id: admins.id });
  return rows.length === 1;
}

export async function replaceRecoveryCodes(db: DbOrTx, adminId: number, hashes: string[]) {
  await db.delete(adminRecoveryCodes).where(eq(adminRecoveryCodes.adminId, adminId));
  await db.insert(adminRecoveryCodes).values(hashes.map((codeHash) => ({ adminId, codeHash })));
}
/** Consome um código de recuperação (uso único) de forma atômica. */
export async function useRecoveryCode(db: DbOrTx, adminId: number, codeHash: string): Promise<boolean> {
  const rows = await db.update(adminRecoveryCodes).set({ usedAt: new Date() })
    .where(and(eq(adminRecoveryCodes.adminId, adminId), eq(adminRecoveryCodes.codeHash, codeHash), isNull(adminRecoveryCodes.usedAt)))
    .returning({ id: adminRecoveryCodes.id });
  return rows.length === 1;
}
export async function countUnusedRecoveryCodes(db: DbOrTx, adminId: number): Promise<number> {
  const rows = await db.select({ id: adminRecoveryCodes.id }).from(adminRecoveryCodes).where(and(eq(adminRecoveryCodes.adminId, adminId), isNull(adminRecoveryCodes.usedAt)));
  return rows.length;
}

/* desafio da 2ª etapa do login */
export async function createChallenge(db: DbOrTx, v: { adminId: number; tokenHash: string; expiresAt: Date; ip?: string | undefined }) {
  await db.delete(adminChallenges).where(eq(adminChallenges.adminId, v.adminId)); // um desafio por vez
  await db.delete(adminChallenges).where(lte(adminChallenges.expiresAt, new Date()));
  await db.insert(adminChallenges).values({ adminId: v.adminId, tokenHash: v.tokenHash, expiresAt: v.expiresAt, ip: v.ip ?? null });
}
export async function findChallenge(db: DbOrTx, tokenHash: string) {
  const [row] = await db.select().from(adminChallenges).where(and(eq(adminChallenges.tokenHash, tokenHash), gt(adminChallenges.expiresAt, new Date()))).limit(1);
  return row;
}
/** Conta a tentativa ANTES de conferir o código (atômico), então chamadas paralelas não passam do limite. */
export async function bumpChallengeAttempts(db: DbOrTx, id: string): Promise<number> {
  const rows = await db.update(adminChallenges).set({ attempts: sql`${adminChallenges.attempts} + 1` }).where(eq(adminChallenges.id, id)).returning({ attempts: adminChallenges.attempts });
  return rows[0]?.attempts ?? Number.MAX_SAFE_INTEGER;
}
export async function deleteChallenge(db: DbOrTx, id: string) {
  await db.delete(adminChallenges).where(eq(adminChallenges.id, id));
}
