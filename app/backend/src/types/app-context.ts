import type { Database, UserRole } from '@marqueaqui/database';
import type { Env } from '../config/env.ts';
import type { RateLimiter } from '../utils/rate-limit.ts';

export interface Limiters {
  global: RateLimiter;
  loginIp: RateLimiter;
  loginPair: RateLimiter;
  loginAccount: RateLimiter;
  register: RateLimiter;
  forgotIp: RateLimiter;
  forgotAccount: RateLimiter;
  lookup: RateLimiter;
  /** Feedback, chamados, mensagens e avaliações (por usuário). */
  submit: RateLimiter;
}

export interface Mailer {
  sendPasswordReset(input: { to: string; name: string; token: string }): Promise<void>;
}

/** Dependências compartilhadas, injetadas nos serviços (facilita teste). */
export interface AppContext {
  db: Database;
  env: Env;
  limiters: Limiters;
  mailer: Mailer;
  log: { info: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void };
}

export interface ClientInfo {
  ip: string;
  userAgent: string;
}

/** Usuário autenticado e contexto de empresa, reconstruído do banco a cada requisição. */
export interface AuthContext {
  userId: number;
  role: UserRole;
  name: string;
  email: string;
  sessionId: string;
  /** Por onde a sessão entrou: 'partner' libera as rotas de gestor/profissional. */
  portal: 'client' | 'partner';
  mustChangePassword: boolean;
  /** Empresa ativa (validada no banco). Nula para clientes ou sem vínculo ativo. */
  shopId: number | null;
  /** Para profissionais: linha de `barbers` na empresa ativa. Gestores que atendem também podem ter. */
  barberId: number | null;
}
