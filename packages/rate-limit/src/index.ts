import { createMemoryStore } from './memory.ts';
import type { RateLog, RateStore } from './types.ts';

export * from './types.ts';
export { createMemoryStore, createRateLimiter } from './memory.ts';

/**
 * Com `redisUrl` usa Redis compartilhado entre as APIs; sem ele, memória por instância.
 * O módulo do Redis só é carregado quando a URL existe (testes e uso local não precisam dele).
 */
export async function createRateStore(redisUrl: string | undefined, log?: RateLog): Promise<RateStore> {
  if (!redisUrl) return createMemoryStore();
  const { createRedisStore } = await import('./redis.ts');
  return createRedisStore(redisUrl, log);
}
