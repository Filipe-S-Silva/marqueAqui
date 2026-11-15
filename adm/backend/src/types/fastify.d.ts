import type { AdminContext, AppContext } from './context.ts';

declare module 'fastify' {
  interface FastifyInstance { ctx: AppContext }
  interface FastifyRequest { admin?: AdminContext }
}
