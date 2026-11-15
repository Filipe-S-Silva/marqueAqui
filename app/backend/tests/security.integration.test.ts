// Testes de integração de segurança do APP. EXIGEM um PostgreSQL de teste já migrado:
//   TEST_DATABASE_URL=postgres://... npm run test:integration -w @marqueaqui/app-backend
// Sem TEST_DATABASE_URL os testes são ignorados (skip), nunca "passam" em silêncio.
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { createDatabase } from '@marqueaqui/database';
import type { FastifyInstance } from 'fastify';
import { buildApp, createLimiters } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';

const URL = process.env.TEST_DATABASE_URL;
const SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres';
const PASSWORD = 'SenhaForte#2026';
const suite = URL ? describe : describe.skip;
const run = Date.now().toString(36);
const mail = (n: string) => `${n}.${run}@teste.local`;

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
function forge(header: object, payload: object, secret = SECRET): string {
  const head = `${b64(header)}.${b64(payload)}`;
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
}

suite('APP: segurança (integração)', () => {
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let tokenA = '';

  before(async () => {
    const env = loadEnv({ NODE_ENV: 'test', DATABASE_URL: URL!, JWT_SECRET: SECRET, CORS_ORIGIN: 'http://localhost:5173', LOG_LEVEL: 'silent' } as NodeJS.ProcessEnv);
    const handle = createDatabase(URL!, { max: 4 });
    close = handle.close;
    app = await buildApp({ db: handle.db, env, limiters: createLimiters() }, { logger: false });
    await app.ready();
    const reg = await app.inject({ method: 'POST', url: '/auth/register', payload: { name: 'Cliente A', email: mail('a'), password: PASSWORD } });
    assert.equal(reg.statusCode, 201, reg.body);
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: mail('a'), password: PASSWORD } });
    assert.equal(login.statusCode, 200, login.body);
    tokenA = login.json().data.accessToken;
  });
  after(async () => { await app?.close(); await close?.(); });

  const auth = (t = tokenA) => ({ authorization: `Bearer ${t}` });

  it('rota protegida sem token → 401', async () => {
    assert.equal((await app.inject({ method: 'GET', url: '/auth/me' })).statusCode, 401);
  });

  it('token em query string NÃO é aceito', async () => {
    assert.equal((await app.inject({ method: 'GET', url: `/auth/me?token=${tokenA}` })).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url: `/auth/me?access_token=${tokenA}` })).statusCode, 401);
  });

  it('JWT com alg "none" é rejeitado', async () => {
    const t = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: '1', role: 'MANAGER', sid: 'x' })}.`;
    assert.equal((await app.inject({ method: 'GET', url: '/auth/me', headers: auth(t) })).statusCode, 401);
  });

  it('JWT assinado com outro segredo é rejeitado', async () => {
    const now = Math.floor(Date.now() / 1000);
    const t = forge({ alg: 'HS256', typ: 'JWT' }, { sub: '1', role: 'MANAGER', sid: '11111111-1111-4111-8111-111111111111', iat: now, exp: now + 600, iss: 'marqueaqui-app', aud: 'marqueaqui-app-api' }, 'outro-segredo-com-mais-de-trinta-e-dois-chars');
    assert.equal((await app.inject({ method: 'GET', url: '/auth/me', headers: auth(t) })).statusCode, 401);
  });

  it('JWT adulterado (payload trocado, assinatura antiga) é rejeitado', async () => {
    const [h, , s] = tokenA.split('.');
    const evil = `${h}.${b64({ sub: '1', role: 'MANAGER' })}.${s}`;
    assert.equal((await app.inject({ method: 'GET', url: '/auth/me', headers: auth(evil) })).statusCode, 401);
  });

  it('login não enumera contas: e-mail inexistente e senha errada têm a mesma resposta externa', async () => {
    const wrong = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: mail('a'), password: 'errada-errada' } });
    const ghost = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: mail('nao-existe'), password: 'errada-errada' } });
    assert.equal(wrong.statusCode, ghost.statusCode);
    assert.equal(wrong.json().message, ghost.json().message);
  });

  it('recuperação de senha responde igual para e-mail existente e inexistente', async () => {
    const a = await app.inject({ method: 'POST', url: '/auth/forgot-password', payload: { email: mail('a') } });
    const b = await app.inject({ method: 'POST', url: '/auth/forgot-password', payload: { email: mail('fantasma') } });
    assert.equal(a.statusCode, b.statusCode);
    assert.equal(a.json().message, b.json().message);
  });

  it('respostas não vazam hash de senha, token de refresh ou campos internos', async () => {
    const me = await app.inject({ method: 'GET', url: '/auth/me', headers: auth() });
    assert.equal(me.statusCode, 200);
    assert.doesNotMatch(me.body, /passwordHash|password_hash|\$argon2|refresh/i);
  });

  it('cadastro ignora/rejeita campos privilegiados (mass assignment)', async () => {
    const r = await app.inject({ method: 'POST', url: '/auth/register', payload: { name: 'Mal Intencionado', email: mail('mass'), password: PASSWORD, role: 'MANAGER', active: true, isAdmin: true } });
    if (r.statusCode === 201) {
      const l = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: mail('mass'), password: PASSWORD } });
      assert.equal(l.json().data.user?.role ?? 'CLIENT', 'CLIENT');
    } else assert.equal(r.statusCode, 400);
  });

  it('CLIENT não acessa rotas de gestor nem de equipe → 403', async () => {
    for (const url of ['/manager/team', '/manager/reports/summary', '/staff/agenda']) {
      assert.equal((await app.inject({ method: 'GET', url, headers: auth() })).statusCode, 403, url);
    }
  });

  it('payload de SQL injection na busca não quebra nem altera a consulta', async () => {
    const r = await app.inject({ method: 'GET', url: `/public/shops?q=${encodeURIComponent("' OR '1'='1")}` });
    assert.ok([200, 400].includes(r.statusCode), String(r.statusCode));
    if (r.statusCode === 200) assert.deepEqual(r.json().data.items ?? r.json().data, []);
  });

  it('payload de SQL injection no login → falha de credencial, sem erro 500', async () => {
    const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: "admin'--@x.com", password: "' OR '1'='1" } });
    assert.ok(r.statusCode >= 400 && r.statusCode < 500, String(r.statusCode));
  });

  it('refresh sem o cabeçalho anti-CSRF é recusado', async () => {
    const r = await app.inject({ method: 'POST', url: '/auth/refresh', headers: { cookie: 'mq_refresh=abc' } });
    assert.ok([400, 401, 403].includes(r.statusCode), String(r.statusCode));
  });

  it('CORS: origem desconhecida não recebe Access-Control-Allow-Origin', async () => {
    const r = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'https://evil.example' } });
    assert.equal(r.headers['access-control-allow-origin'], undefined);
    const ok = await app.inject({ method: 'GET', url: '/health', headers: { origin: 'http://localhost:5173' } });
    assert.equal(ok.headers['access-control-allow-origin'], 'http://localhost:5173');
  });

  it('cabeçalhos de segurança presentes', async () => {
    const r = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.equal(r.headers['x-frame-options'], 'DENY');
  });

  it('força bruta no login: após o limite por par IP+e-mail devolve 429 com Retry-After', async () => {
    let last = 0; let retry: unknown;
    for (let i = 0; i < 12; i++) {
      const r = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: mail('brute'), password: `errada-${i}-xxxx` } });
      last = r.statusCode; retry = r.headers['retry-after'];
      if (last === 429) break;
    }
    assert.equal(last, 429);
    assert.ok(retry);
  });

  it('bloqueio de conta: após 5 senhas erradas nem a senha correta entra (e a resposta não revela o bloqueio)', async () => {
    const email = mail('lock');
    assert.equal((await app.inject({ method: 'POST', url: '/auth/register', payload: { name: 'Cliente Lock', email, password: PASSWORD } })).statusCode, 201);
    for (let i = 0; i < 5; i++) await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: `errada-${i}-xxxx` } });
    const right = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: PASSWORD } });
    assert.ok([401, 429].includes(right.statusCode), String(right.statusCode));
    if (right.statusCode === 401) assert.equal(right.json().message, (await app.inject({ method: 'POST', url: '/auth/login', payload: { email: mail('nunca-existiu'), password: 'qualquer-coisa' } })).json().message);
  });

  it('caractere NUL na consulta → 400 (e não 500)', async () => {
    const r = await app.inject({ method: 'GET', url: `/public/shops?q=${encodeURIComponent('a\u0000b')}` });
    assert.equal(r.statusCode, 400);
  });

  it('Permissions-Policy presente', async () => {
    assert.match(String((await app.inject({ method: 'GET', url: '/health' })).headers['permissions-policy']), /camera=\(\)/);
  });

  it('logout revoga a sessão: o access token deixa de funcionar', async () => {
    const l = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: mail('a'), password: PASSWORD } });
    const t = l.json().data.accessToken as string;
    assert.equal((await app.inject({ method: 'GET', url: '/auth/me', headers: auth(t) })).statusCode, 200);
    await app.inject({ method: 'POST', url: '/auth/logout', headers: { ...auth(t), 'x-requested-with': 'marqueaqui' } });
    assert.equal((await app.inject({ method: 'GET', url: '/auth/me', headers: auth(t) })).statusCode, 401);
  });
});
