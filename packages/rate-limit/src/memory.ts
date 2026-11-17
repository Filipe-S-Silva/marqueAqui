// Limitador em memória, janela deslizante. Suficiente para UMA instância; com várias, use REDIS_URL.
import type { RateLimiterOptions, RateResult, SyncRateLimiter } from './types.ts';

export function createRateLimiter(options: RateLimiterOptions): SyncRateLimiter {
  const { windowMs, max } = options;
  const now = options.now ?? (() => Date.now());
  const maxKeys = options.maxKeys ?? 50_000;
  const hits = new Map<string, number[]>();

  function prune(key: string): number[] {
    const cutoff = now() - windowMs;
    const list = (hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length) hits.set(key, list);
    else hits.delete(key);
    return list;
  }

  function status(list: number[]): RateResult {
    if (list.length < max) return { limited: false, retryAfterSeconds: 0 };
    const oldest = list[list.length - max]!;
    return { limited: true, retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now()) / 1000)) };
  }

  return {
    hit(key) {
      const list = prune(key);
      // Protege a memória contra enxurrada de chaves únicas
      if (!hits.has(key) && hits.size >= maxKeys) {
        const first = hits.keys().next().value;
        if (first !== undefined) hits.delete(first);
      }
      list.push(now());
      hits.set(key, list);
      return status(list);
    },
    peek: (key) => status(prune(key)),
    reset(key) { hits.delete(key); },
    clear() { hits.clear(); },
  };
}

export function createMemoryStore(): import('./types.ts').RateStore {
  return { kind: 'memory', limiter: (_name, o) => createRateLimiter(o), close: async () => {} };
}
