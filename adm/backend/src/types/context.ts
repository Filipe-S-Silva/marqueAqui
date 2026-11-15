import type { Database } from '@marqueaqui/database';
import type { Env } from '../config/env.ts';
import type { RateLimiter } from '../utils/rate-limit.ts';

export interface Limiters { global: RateLimiter; loginIp: RateLimiter; confirm: RateLimiter }

export interface AdminContext { adminId: number; name: string; sessionId: string; mustChangePassword: boolean }

export interface AppContext {
  db: Database; env: Env; limiters: Limiters;
  log: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void };
}
