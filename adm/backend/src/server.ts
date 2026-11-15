import 'dotenv/config';
import { configurePasswordPepper, createDatabase } from '@marqueaqui/database';
import { buildApp, createLimiters } from './app.ts';
import { createRateStore } from './utils/rate-limit.ts';
import { loadEnv } from './config/env.ts';

const env = loadEnv();
configurePasswordPepper(env.PASSWORD_PEPPER);
const { db, close } = createDatabase(env.DATABASE_URL);
const rateStore = await createRateStore(env.REDIS_URL, { warn: (o, m) => console.warn(m, o), info: (o, m) => console.info(m, o) });
const app = await buildApp({ db, env, limiters: createLimiters(rateStore) });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Encerrando');
  await app.close();
  await rateStore.close();
  await close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
await app.listen({ host: env.HOST, port: env.PORT });
