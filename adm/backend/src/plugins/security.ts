// CORS com origens explícitas, cabeçalhos de segurança e limite global de requisições (spec 10.5).
import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { tooManyRequests, validationError } from '../utils/errors.ts';
import { containsNul } from '../utils/nuls.ts';

export async function registerSecurity(app: FastifyInstance): Promise<void> {
  const { env, limiters } = app.ctx;
  const allowed = new Set(env.CORS_ORIGINS);
  if (!env.isProduction) {
    // Só em desenvolvimento: localhost e 127.0.0.1 são tratados como a mesma origem da lista
    for (const o of env.CORS_ORIGINS) {
      try {
        const u = new URL(o);
        const other = u.hostname === 'localhost' ? '127.0.0.1' : u.hostname === '127.0.0.1' ? 'localhost' : null;
        if (other) allowed.add(`${u.protocol}//${other}${u.port ? `:${u.port}` : ''}`);
      } catch { /* env.ts já validou o formato */ }
    }
  }

  await app.register(cors, {
    // Requisições sem Origin (curl, servidor a servidor) passam; navegador só com origem na lista.
    origin: (origin, cb) => cb(null, !origin || allowed.has(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition', 'Retry-After'],
    maxAge: 600,
  });

  app.addHook('onRequest', async (req) => {
    if (req.url === '/health') return;
    const r = await limiters.global.hit(req.ip);
    if (r.limited) throw tooManyRequests(r.retryAfterSeconds);
  });

  // O PostgreSQL recusa o caractere NUL em texto (daria 500): rejeitamos antes com 400
  app.addHook('preValidation', async (req) => {
    if (containsNul(req.body) || containsNul(req.query) || containsNul(req.params)) {
      throw validationError('Dados inválidos: caractere nulo não é permitido.');
    }
  });

  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    reply.header('Cross-Origin-Resource-Policy', 'same-site');
    reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    // Respostas autenticadas nunca devem ser guardadas em cache compartilhado
    reply.header('Cache-Control', 'no-store');
    if (env.isProduction) {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    return payload;
  });
}
