import type { AppContext, AuthContext } from './app-context.ts';

declare module 'fastify' {
  interface FastifyInstance {
    ctx: AppContext;
  }
  interface FastifyRequest {
    auth?: AuthContext;
  }
}
