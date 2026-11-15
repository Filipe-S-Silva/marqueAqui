import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

export type Database = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Aceita tanto a conexão normal quanto uma transação aberta. */
export type DbOrTx = Database | Tx;

export interface DatabaseHandle {
  db: Database;
  close: () => Promise<void>;
}

export function createDatabase(url: string, options: { max?: number } = {}): DatabaseHandle {
  const client = postgres(url, {
    max: options.max ?? 10,
    // Pooler do Neon/pgbouncer (modo transação) não aceita prepared statements
    prepare: !/-pooler\./.test(url),
    onnotice: () => {},
  });
  const db = drizzle(client, { schema });
  return { db, close: () => client.end({ timeout: 5 }) };
}

/** Chaves de advisory lock (spec 7.3 e 11). O primeiro inteiro é o "namespace" da trava. */
export const LOCK_NS = {
  barberBooking: 7001,
  inactivitySweep: 7002,
  retentionPurge: 7003,
} as const;
