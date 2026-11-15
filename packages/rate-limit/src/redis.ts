// Limitador compartilhado em Redis (ex.: Upstash). Janela deslizante com sorted set e script Lua atômico.
// FAIL-OPEN: se o Redis cair ou demorar, a API continua respondendo e o limite DEIXA DE VALER até ele voltar.
import { randomBytes } from 'node:crypto';
import type { RateLimiter, RateLimiterOptions, RateLog, RateResult, RateStore } from './types.ts';

/** Superfície mínima do ioredis usada aqui (evita depender dos tipos do pacote). */
interface RedisLike {
  eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  on(event: 'error', fn: (e: Error) => void): unknown;
  quit(): Promise<unknown>;
  disconnect(): void;
}

const SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local win = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local record = ARGV[4] == '1'
redis.call('ZREMRANGEBYSCORE', key, 0, now - win)
if record then
  redis.call('ZADD', key, now, ARGV[5])
  redis.call('PEXPIRE', key, win)
end
local n = redis.call('ZCARD', key)
if n < max then return {0, 0} end
local oldest = redis.call('ZRANGE', key, n - max, n - max, 'WITHSCORES')
return {1, tonumber(oldest[2]) + win - now}
`;

const OPEN: RateResult = { limited: false, retryAfterSeconds: 0 };

export async function createRedisStore(url: string, log?: RateLog): Promise<RateStore> {
  const { default: Redis } = (await import('ioredis')) as unknown as {
    default: new (url: string, o: Record<string, unknown>) => RedisLike;
  };
  const client = new Redis(url, {
    // Falha rápida em vez de enfileirar comandos enquanto o Redis está fora
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    commandTimeout: 500,
    retryStrategy: (times: number) => Math.min(times * 200, 5000),
  });

  let lastWarn = 0;
  let down = false;
  const warn = (e: unknown) => {
    const t = Date.now();
    if (!down || t - lastWarn > 30_000) {
      lastWarn = t;
      log?.warn({ err: e instanceof Error ? e.message : String(e) }, 'Redis indisponível: o limite de requisições está SUSPENSO até ele voltar.');
    }
    down = true;
  };
  const recovered = () => {
    if (down) { down = false; log?.info({}, 'Redis voltou: limite de requisições reativado.'); }
  };
  client.on('error', warn);

  const limiter = (name: string, o: RateLimiterOptions): RateLimiter => {
    const k = (key: string) => `mq:rl:${name}:${key}`;
    async function run(key: string, record: boolean): Promise<RateResult> {
      try {
        const now = Date.now();
        const r = (await client.eval(SCRIPT, 1, k(key), now, o.windowMs, o.max, record ? '1' : '0', `${now}-${randomBytes(6).toString('hex')}`)) as [number, number];
        recovered();
        return r[0] === 1 ? { limited: true, retryAfterSeconds: Math.max(1, Math.ceil(r[1] / 1000)) } : OPEN;
      } catch (e) {
        warn(e);
        return OPEN;
      }
    }
    return {
      hit: (key) => run(key, true),
      peek: (key) => run(key, false),
      async reset(key) {
        try { await client.del(k(key)); } catch (e) { warn(e); }
      },
      clear() { /* só faz sentido em memória */ },
    };
  };

  return {
    kind: 'redis',
    limiter,
    async close() {
      try { await client.quit(); } catch { client.disconnect(); }
    },
  };
}
