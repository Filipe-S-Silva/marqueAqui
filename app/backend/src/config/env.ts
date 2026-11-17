// Validação das variáveis de ambiente na inicialização (spec 15).
// A API não sobe se algo essencial estiver ausente ou inválido.
import 'dotenv/config';
import { z } from 'zod';

const bool = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3333),
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter pelo menos 32 caracteres.'),
    CORS_ORIGIN: z.string().min(1),
    INACTIVITY_DAYS: z.coerce.number().int().min(1).default(45),
    INACTIVITY_SWEEP_MINUTES: z.coerce.number().int().min(1).default(360),
    RETENTION_MONTHS: z.coerce.number().int().min(1).max(60).default(3),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(60).default(7),
    COOKIE_SECURE: bool.optional(),
    DEFAULT_PASSWORD: z.string().min(8).default('easyService'),
    // Pepper de senha (IGUAL ao do ADM e do seed). Obrigatório em produção.
    PASSWORD_PEPPER: z.string().min(32, 'PASSWORD_PEPPER precisa ter pelo menos 32 caracteres.').optional(),
    TRUST_PROXY: bool.default(false),
    // Com REDIS_URL as duas APIs contam o limite de requisições no mesmo Redis; sem ela, em memória (por instância).
    REDIS_URL: z.string().regex(/^rediss?:\/\/\S+$/, 'REDIS_URL deve começar com redis:// ou rediss://.').optional(),
    // Segredo do Vercel Cron (enviado como "Authorization: Bearer ..."); sem ele a rota de manutenção fica desligada.
    CRON_SECRET: z.string().min(16, 'CRON_SECRET precisa ter pelo menos 16 caracteres.').optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  })
  .superRefine((env, ctx) => {
    const origins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
    for (const origin of origins) {
      let ok = false;
      try {
        const u = new URL(origin);
        ok = (u.protocol === 'http:' || u.protocol === 'https:') && u.origin === origin;
      } catch {
        ok = false;
      }
      if (!ok) {
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGIN'],
          message: `Origem inválida: "${origin}". Use o formato https://dominio.com, sem barra final e sem curinga.`,
        });
      }
    }
    if (env.NODE_ENV === 'production' && !env.PASSWORD_PEPPER) {
      ctx.addIssue({ code: 'custom', path: ['PASSWORD_PEPPER'], message: 'Em produção, PASSWORD_PEPPER é obrigatório.' });
    }
    if (env.NODE_ENV === 'production' && env.DEFAULT_PASSWORD === 'easyService') {
      ctx.addIssue({ code: 'custom', path: ['DEFAULT_PASSWORD'], message: 'Em produção, defina DEFAULT_PASSWORD; o valor de desenvolvimento é público.' });
    }
    if (env.NODE_ENV === 'production') {
      if (env.COOKIE_SECURE === false) {
        ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'COOKIE_SECURE=false não é permitido em produção.' });
      }
      if (origins.some((o) => o.startsWith('http://'))) {
        ctx.addIssue({ code: 'custom', path: ['CORS_ORIGIN'], message: 'Em produção, use apenas origens https.' });
      }
    }
  });

export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  HOST: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_SECRET: string;
  CORS_ORIGINS: string[];
  INACTIVITY_DAYS: number;
  INACTIVITY_SWEEP_MINUTES: number;
  RETENTION_MONTHS: number;
  ACCESS_TOKEN_TTL_SECONDS: number;
  REFRESH_TOKEN_TTL_DAYS: number;
  COOKIE_SECURE: boolean;
  DEFAULT_PASSWORD: string;
  PASSWORD_PEPPER: string | undefined;
  TRUST_PROXY: boolean;
  LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  REDIS_URL: string | undefined;
  CRON_SECRET: string | undefined;
  isProduction: boolean;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`);
    throw new Error(`Variáveis de ambiente inválidas:\n${lines.join('\n')}\nVeja app/backend/.env.example.`);
  }
  const e = result.data;
  return {
    NODE_ENV: e.NODE_ENV,
    HOST: e.HOST,
    PORT: e.PORT,
    DATABASE_URL: e.DATABASE_URL,
    JWT_SECRET: e.JWT_SECRET,
    CORS_ORIGINS: e.CORS_ORIGIN.split(',').map((o) => o.trim()),
    INACTIVITY_DAYS: e.INACTIVITY_DAYS,
    INACTIVITY_SWEEP_MINUTES: e.INACTIVITY_SWEEP_MINUTES,
    RETENTION_MONTHS: e.RETENTION_MONTHS,
    ACCESS_TOKEN_TTL_SECONDS: e.ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_TOKEN_TTL_DAYS: e.REFRESH_TOKEN_TTL_DAYS,
    COOKIE_SECURE: e.COOKIE_SECURE ?? e.NODE_ENV === 'production',
    DEFAULT_PASSWORD: e.DEFAULT_PASSWORD,
    PASSWORD_PEPPER: e.PASSWORD_PEPPER,
    TRUST_PROXY: e.TRUST_PROXY,
    LOG_LEVEL: e.LOG_LEVEL,
    REDIS_URL: e.REDIS_URL,
    CRON_SECRET: e.CRON_SECRET,
    isProduction: e.NODE_ENV === 'production',
  };
}
