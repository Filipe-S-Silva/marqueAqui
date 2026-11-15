import { createDatabase } from '@marqueaqui/database';
import { loadEnv } from '../config/env.ts';
import { createLimiters } from '../app.ts';
import { createMailer } from '../plugins/mailer.ts';
import { sweepInactiveUsers } from './inactivity.ts';
import { purgeOldAppointments } from './retention.ts';

const env = loadEnv();
const { db, close } = createDatabase(env.DATABASE_URL, { max: 2 });
const log = { info: console.log, warn: console.warn, error: console.error };
const ctx = { db, env, limiters: createLimiters(), mailer: createMailer(env, log), log };
console.log(`Contas desativadas por inatividade: ${await sweepInactiveUsers(ctx)}`);
console.log(`Agendamentos antigos apagados: ${await purgeOldAppointments(ctx)}`);
await close();
