// Validação das variáveis de ambiente na inicialização (spec 15). Não sobe com algo essencial ausente.
import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3334),
    DATABASE_URL: z.string().url(),
    ADMIN_EMAIL_PEPPER: z.string().min(32, 'ADMIN_EMAIL_PEPPER precisa ter pelo menos 32 caracteres.'),
    // Barra final é erro comum ao colar a URL no painel; uma origem nunca tem barra, então removê-la é seguro.
    CORS_ORIGIN: z.string().min(1).transform((s) => s.split(',').map((o) => o.trim().replace(/\/+$/, '')).join(',')),
    // Pepper de senha (compartilhado com o APP). Obrigatório em produção.
    PASSWORD_PEPPER: z.string().min(32, 'PASSWORD_PEPPER precisa ter pelo menos 32 caracteres.').optional(),
    // true = todo administrador precisa ativar o 2FA antes de usar o painel
    ADMIN_REQUIRE_2FA: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
    ADMIN_SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    DEFAULT_PASSWORD: z.string().min(8).default('easyService'),
    TRUST_PROXY: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
    // Com REDIS_URL as duas APIs contam o limite de requisições no mesmo Redis; sem ela, em memória (por instância).
    REDIS_URL: z.string().regex(/^rediss?:\/\/\S+$/, 'REDIS_URL deve começar com redis:// ou rediss://.').optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.DEFAULT_PASSWORD === 'easyService') {
      ctx.addIssue({ code: 'custom', path: ['DEFAULT_PASSWORD'], message: 'Em produção, defina DEFAULT_PASSWORD; o valor de desenvolvimento é público.' });
    }
    if (env.PASSWORD_PEPPER && env.PASSWORD_PEPPER === env.ADMIN_EMAIL_PEPPER) {
      ctx.addIssue({ code: 'custom', path: ['PASSWORD_PEPPER'], message: 'PASSWORD_PEPPER deve ser diferente de ADMIN_EMAIL_PEPPER.' });
    }
    if (env.NODE_ENV === 'production' && !env.PASSWORD_PEPPER) {
      ctx.addIssue({ code: 'custom', path: ['PASSWORD_PEPPER'], message: 'Em produção, PASSWORD_PEPPER é obrigatório.' });
    }
    for (const origin of env.CORS_ORIGIN.split(',').map((o) => o.trim())) {
      let ok = false;
      try { const u = new URL(origin); ok = (u.protocol === 'http:' || u.protocol === 'https:') && u.origin === origin; } catch { ok = false; }
      if (!ok) ctx.addIssue({ code: 'custom', path: ['CORS_ORIGIN'], message: `Origem inválida: "${origin}". Use https://dominio.com, sem barra final e sem curinga.` });
      if (env.NODE_ENV === 'production' && origin.startsWith('http://')) {
        ctx.addIssue({ code: 'custom', path: ['CORS_ORIGIN'], message: 'Em produção, use apenas origens https.' });
      }
    }
  });

export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  HOST: string; PORT: number; DATABASE_URL: string;
  ADMIN_EMAIL_PEPPER: string; PASSWORD_PEPPER: string | undefined;
  CORS_ORIGINS: string[]; ADMIN_SESSION_TTL_SECONDS: number; ADMIN_REQUIRE_2FA: boolean; DEFAULT_PASSWORD: string;
  TRUST_PROXY: boolean; LOG_LEVEL: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  REDIS_URL: string | undefined;
  isProduction: boolean;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const r = schema.safeParse(source);
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  - ${i.path.join('.') || '(raiz)'}: ${i.message}`);
    throw new Error(`Variáveis de ambiente inválidas:\n${lines.join('\n')}\nVeja adm/backend/.env.example.`);
  }
  const e = r.data;
  return {
    NODE_ENV: e.NODE_ENV, HOST: e.HOST, PORT: e.PORT, DATABASE_URL: e.DATABASE_URL,
    ADMIN_EMAIL_PEPPER: e.ADMIN_EMAIL_PEPPER, PASSWORD_PEPPER: e.PASSWORD_PEPPER,
    CORS_ORIGINS: e.CORS_ORIGIN.split(',').map((o) => o.trim()),
    ADMIN_SESSION_TTL_SECONDS: e.ADMIN_SESSION_TTL_DAYS * 86_400, ADMIN_REQUIRE_2FA: e.ADMIN_REQUIRE_2FA,
    DEFAULT_PASSWORD: e.DEFAULT_PASSWORD, TRUST_PROXY: e.TRUST_PROXY, LOG_LEVEL: e.LOG_LEVEL,
    REDIS_URL: e.REDIS_URL,
    isProduction: e.NODE_ENV === 'production',
  };
}
