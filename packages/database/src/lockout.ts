// Bloqueio de conta: 5 senhas erradas bloqueiam por 15 minutos. O contador é incrementado em UMA instrução
// UPDATE (atômica), então requisições simultâneas não furam o limite.
import { sql } from 'drizzle-orm';
import type { DbOrTx } from './client.ts';
import { admins, users } from './schema.ts';

export const LOCKOUT = { maxAttempts: 5, minutes: 15 } as const;

export function isLocked(row: { lockedUntil: Date | null }, now: Date = new Date()): boolean {
  return row.lockedUntil !== null && row.lockedUntil.getTime() > now.getTime();
}

type Table = typeof users | typeof admins;

async function register(db: DbOrTx, table: Table, id: number): Promise<{ attempts: number; lockedUntil: Date | null }> {
  // Se um bloqueio anterior já expirou, a contagem recomeça em 1. O SET lê sempre os valores ANTIGOS da linha.
  const next = sql`(CASE WHEN locked_until IS NOT NULL AND locked_until <= now() THEN 1 ELSE failed_login_attempts + 1 END)`;
  const rows = await db.execute(sql`
    UPDATE ${table}
       SET failed_login_attempts = ${next},
           locked_until = CASE WHEN ${next} >= ${LOCKOUT.maxAttempts}
                               THEN now() + make_interval(mins => ${LOCKOUT.minutes}) ELSE locked_until END
     WHERE id = ${id}
 RETURNING failed_login_attempts AS attempts, locked_until AS "lockedUntil"`);
  const r = (rows as unknown as Array<{ attempts: number; lockedUntil: Date | null }>)[0];
  return r ?? { attempts: 0, lockedUntil: null };
}

export const registerFailedUserLogin = (db: DbOrTx, id: number) => register(db, users, id);
export const registerFailedAdminLogin = (db: DbOrTx, id: number) => register(db, admins, id);

export async function clearUserLockout(db: DbOrTx, id: number): Promise<void> {
  await db.execute(sql`UPDATE ${users} SET failed_login_attempts = 0, locked_until = NULL WHERE id = ${id}`);
}
export async function clearAdminLockout(db: DbOrTx, id: number): Promise<void> {
  await db.execute(sql`UPDATE ${admins} SET failed_login_attempts = 0, locked_until = NULL WHERE id = ${id}`);
}
