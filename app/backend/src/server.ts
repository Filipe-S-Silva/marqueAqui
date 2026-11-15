import { configurePasswordPepper, createDatabase } from '@marqueaqui/database';
import { buildApp, createLimiters } from './app.ts';
import { createRateStore } from './utils/rate-limit.ts';
import { loadEnv } from './config/env.ts';
import { startInactivityJob } from './jobs/inactivity.ts';
import { startRetentionJob } from './jobs/retention.ts';

const env = loadEnv();
configurePasswordPepper(env.PASSWORD_PEPPER);
const { db, close } = createDatabase(env.DATABASE_URL);
const rateStore = await createRateStore(env.REDIS_URL, { warn: (o, m) => console.warn(m, o), info: (o, m) => console.info(m, o) });
const limiters = createLimiters(rateStore);
const app = await buildApp({ db, env, limiters });
const stopInactivity = startInactivityJob(app.ctx);
const stopRetention = startRetentionJob(app.ctx);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Encerrando');
  stopInactivity();
  stopRetention();
  await app.close();
  await rateStore.close();
  await close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ host: env.HOST, port: env.PORT });
