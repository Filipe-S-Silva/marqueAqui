import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadEnv } from '../src/config/env.ts';

const base = { DATABASE_URL: 'postgres://u:p@localhost:5432/db', CORS_ORIGIN: 'http://localhost:5174' };

test('Ambiente ADM: pepper de e-mail forte e padrões de sessão', () => {
  assert.throws(() => loadEnv({ ...base } as NodeJS.ProcessEnv), /ADMIN_EMAIL_PEPPER/);
  const ok = loadEnv({ ...base, ADMIN_EMAIL_PEPPER: 'y'.repeat(40) } as NodeJS.ProcessEnv);
  assert.equal(ok.PORT, 3334);
  assert.equal(ok.ADMIN_SESSION_TTL_SECONDS, 7 * 86_400);
  assert.throws(() => loadEnv({ ...base, CORS_ORIGIN: '*', ADMIN_EMAIL_PEPPER: 'y'.repeat(40) } as NodeJS.ProcessEnv), /Origem inválida/);
  assert.throws(() => loadEnv({ ...base, CORS_ORIGIN: 'null', ADMIN_EMAIL_PEPPER: 'y'.repeat(40) } as NodeJS.ProcessEnv), /Origem inválida/);
});

test('Ambiente ADM: pepper de senha distinto do de e-mail', () => {
  const e = { ...base, ADMIN_EMAIL_PEPPER: 'y'.repeat(40) };
  assert.throws(() => loadEnv({ ...e, PASSWORD_PEPPER: 'y'.repeat(40) } as NodeJS.ProcessEnv), /diferente/);
  assert.equal(loadEnv({ ...e, PASSWORD_PEPPER: 'z'.repeat(40) } as NodeJS.ProcessEnv).PASSWORD_PEPPER, 'z'.repeat(40));
});

test('Ambiente ADM: produção exige pepper de senha, senha padrão própria e https', () => {
  const e = { ...base, CORS_ORIGIN: 'https://adm.exemplo.com', ADMIN_EMAIL_PEPPER: 'y'.repeat(40), NODE_ENV: 'production' };
  assert.throws(() => loadEnv(e as NodeJS.ProcessEnv), /PASSWORD_PEPPER/);
  assert.throws(() => loadEnv({ ...e, PASSWORD_PEPPER: 'z'.repeat(40) } as NodeJS.ProcessEnv), /DEFAULT_PASSWORD/);
  assert.ok(loadEnv({ ...e, PASSWORD_PEPPER: 'z'.repeat(40), DEFAULT_PASSWORD: 'Outra#Senha-Provisoria1' } as NodeJS.ProcessEnv).isProduction);
});
