import Fastify, { type FastifyInstance } from 'fastify';
import type { Database } from '@marqueaqui/database';
import type { Env } from './config/env.ts';
import { registerErrorHandler } from './plugins/error-handler.ts';
import { registerSecurity } from './plugins/security.ts';
import { routes } from './routes/routes.ts';
import type { AppContext, Limiters } from './types/context.ts';
import { createMemoryStore, type RateStore } from './utils/rate-limit.ts';

const MIN = 60_000;
export const createLimiters = (store: RateStore = createMemoryStore()): Limiters => ({
  global: store.limiter('global', { windowMs: MIN, max: 300 }),
  loginIp: store.limiter('loginIp', { windowMs: 15 * MIN, max: 5 }), // spec 8.1: 5 tentativas por IP a cada 15 min
  confirm: store.limiter('confirm', { windowMs: 15 * MIN, max: 10 }),
});

export async function buildApp(base: { db: Database; env: Env; limiters: Limiters }, opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger === false ? false : { level: base.env.LOG_LEVEL, redact: ['req.headers.authorization'] },
    trustProxy: base.env.TRUST_PROXY,
    bodyLimit: 1024 * 1024, // logos em data URL de até ~400 KB
  });
  app.decorate('ctx', { ...base, log: app.log } as AppContext);
  app.decorateRequest('admin', undefined);
  registerErrorHandler(app);
  await registerSecurity(app);
  app.get('/health', async () => ({ status: 'ok' }));
  await app.register(routes);
  return app;
}
