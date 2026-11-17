import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from './config/env.ts';
import { createMailer } from './plugins/mailer.ts';
import { registerErrorHandler } from './plugins/error-handler.ts';
import { registerSecurity } from './plugins/security.ts';
import { managerRoutes } from './routes/manager.routes.ts';
import { photoRoutes } from './routes/photo.routes.ts';
import { supportRoutes } from './routes/support.routes.ts';
import { authRoutes } from './routes/auth.routes.ts';
import { clientRoutes, notificationRoutes, publicRoutes, staffRoutes } from './routes/scheduling.routes.ts';
import { sweepInactiveUsers } from './jobs/inactivity.ts';
import { purgeOldAppointments } from './jobs/retention.ts';
import type { AppContext, Limiters } from './types/app-context.ts';
import { createMemoryStore, type RateStore } from './utils/rate-limit.ts';

const MIN = 60_000;

export function createLimiters(store: RateStore = createMemoryStore()): Limiters {
  const createRateLimiter = (name: string, o: { windowMs: number; max: number }) => store.limiter(name, o);
  return {
    global: createRateLimiter('global', { windowMs: MIN, max: 300 }),
    loginIp: createRateLimiter('loginIp', { windowMs: 15 * MIN, max: 30 }),
    loginPair: createRateLimiter('loginPair', { windowMs: 15 * MIN, max: 5 }),
    loginAccount: createRateLimiter('loginAccount', { windowMs: 15 * MIN, max: 20 }),
    register: createRateLimiter('register', { windowMs: 60 * MIN, max: 10 }),
    forgotIp: createRateLimiter('forgotIp', { windowMs: 15 * MIN, max: 10 }),
    forgotAccount: createRateLimiter('forgotAccount', { windowMs: 60 * MIN, max: 3 }),
    lookup: createRateLimiter('lookup', { windowMs: MIN, max: 20 }),
    submit: createRateLimiter('submit', { windowMs: 60 * MIN, max: 20 }),
  };
}

export type BuildContext = Omit<AppContext, 'log' | 'mailer'>;

export async function buildApp(base: BuildContext, opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const env: Env = base.env;
  const app = Fastify({
    logger: opts.logger === false ? false : { level: env.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie'] },
    trustProxy: env.TRUST_PROXY,
    bodyLimit: 100 * 1024,
    disableRequestLogging: false,
  });

  app.decorate('ctx', { ...base, log: app.log, mailer: createMailer(env, app.log) } as AppContext);
  app.decorateRequest('auth', undefined);

  registerErrorHandler(app);
  await registerSecurity(app);

  app.get('/health', async () => ({ status: 'ok' }));
  // Substitui os setInterval do server.ts no serverless: o Vercel Cron chama uma vez por dia.
  app.get('/internal/maintenance', async (req, reply) => {
    if (!env.CRON_SECRET || req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) return reply.code(404).send();
    return { deactivated: await sweepInactiveUsers(app.ctx), purged: await purgeOldAppointments(app.ctx) };
  });
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(publicRoutes);
  await app.register(clientRoutes);
  await app.register(staffRoutes);
  await app.register(notificationRoutes);
  await app.register(managerRoutes);
  await app.register(supportRoutes);
  await app.register(photoRoutes);
  return app;
}
