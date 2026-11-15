export interface RateResult { limited: boolean; retryAfterSeconds: number }
export type Maybe<T> = T | Promise<T>;

/**
 * Memória devolve valores síncronos; Redis devolve Promises. Quem chama SEMPRE usa `await`, então as duas
 * implementações são intercambiáveis.
 */
export interface RateLimiter {
  /** Registra uma ocorrência e informa se o limite foi excedido. */
  hit(key: string): Maybe<RateResult>;
  /** Consulta sem registrar. */
  peek(key: string): Maybe<RateResult>;
  reset(key: string): Maybe<void>;
  /** Para testes (só memória). */
  clear(): void;
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  now?: () => number;
  maxKeys?: number;
}

export interface RateStore {
  readonly kind: 'memory' | 'redis';
  /** `name` separa os contadores (ex.: "loginIp") e vira parte da chave no Redis. */
  limiter(name: string, options: RateLimiterOptions): RateLimiter;
  close(): Promise<void>;
}

export interface RateLog { warn: (o: unknown, m?: string) => void; info: (o: unknown, m?: string) => void }
