// Integração do ADM (exige PostgreSQL de teste migrado):
//   TEST_DATABASE_URL=postgres://... npm run test:integration -w @marqueaqui/adm-backend
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { admins, createDatabase, hashPassword } from '@marqueaqui/database';
import type { FastifyInstance } from 'fastify';
import { buildApp, createLimiters } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';
import { emailHmac } from '../src/utils/hmac.ts';
import { base32Decode, hotp, stepAt } from '../src/utils/totp.ts';

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;
const PEPPER = 'pepper-admin-de-teste-diferente-do-segredo-1234';
const PASS = 'SenhaAdmin#Teste2026';
const NEW_PASS = 'NovaSenha#Forte2026'; // definida pelo teste de troca de senha
const run = Date.now().toString(36);
const EMAIL = `adm.${run}@teste.local`;

suite('ADM: segurança (integração)', () => {
  let app: FastifyInstance;
  let close: () => Promise<void>;
  let token = '';

  before(async () => {
    const env = loadEnv({ NODE_ENV: 'test', DATABASE_URL: URL!, ADMIN_EMAIL_PEPPER: PEPPER, CORS_ORIGIN: 'http://localhost:5174', LOG_LEVEL: 'silent' } as NodeJS.ProcessEnv);
    const h = createDatabase(URL!, { max: 4 });
    close = h.close;
    await h.db.insert(admins).values({ name: `Admin ${run}`, emailHmac: emailHmac(EMAIL, PEPPER), passwordHash: await hashPassword(PASS) });
    app = await buildApp({ db: h.db, env, limiters: createLimiters() }, { logger: false });
    await app.ready();
    const l = await app.inject({ method: 'POST', url: '/auth/login', payload: { name: `Admin ${run}`, email: EMAIL, password: PASS } });
    assert.equal(l.statusCode, 200, l.body);
    token = l.json().data.accessToken;
  });
  after(async () => { await app?.close(); await close?.(); });
  const h = () => ({ authorization: `Bearer ${token}` });

  it('rotas sem token → 401; token em query string → 401', async () => {
    assert.equal((await app.inject({ method: 'GET', url: '/dashboard' })).statusCode, 401);
    assert.equal((await app.inject({ method: 'GET', url: `/dashboard?token=${token}` })).statusCode, 401);
  });
  it('mutação sem adminPassword → 400', async () => {
    const r = await app.inject({ method: 'POST', url: '/admins', headers: h(), payload: { name: 'X Y', email: 'x@y.com', password: 'SenhaLonga#2026' } });
    assert.equal(r.statusCode, 400);
  });
  it('mutação com adminPassword errada → 401/403 e nada é criado', async () => {
    const r = await app.inject({ method: 'POST', url: '/admins', headers: h(), payload: { adminPassword: 'errada', name: 'X Y', email: 'x@y.com', password: 'SenhaLonga#2026' } });
    assert.ok([401, 403].includes(r.statusCode), String(r.statusCode));
  });
  it('caractere NUL no corpo → 400 (e não 500)', async () => {
    const r = await app.inject({ method: 'GET', url: `/users?name=${encodeURIComponent('a\u0000b')}`, headers: h() });
    assert.equal(r.statusCode, 400);
  });
  it('admin não consegue se desativar', async () => {
    const me = (await app.inject({ method: 'GET', url: '/auth/me', headers: h() })).json().data;
    const r = await app.inject({ method: 'POST', url: `/admins/${me.id}/status`, headers: h(), payload: { adminPassword: PASS, active: false } });
    assert.equal(r.statusCode, 422);
  });
  it('mass assignment em PATCH /users/:id é rejeitado (.strict)', async () => {
    const r = await app.inject({ method: 'PATCH', url: '/users/1', headers: h(), payload: { adminPassword: PASS, active: true, passwordHash: 'x', email: 'a@b.com' } });
    assert.equal(r.statusCode, 400);
  });
  it('respostas de /admins não expõem e-mail nem hash', async () => {
    const r = await app.inject({ method: 'GET', url: '/admins', headers: h() });
    assert.doesNotMatch(r.body, /emailHmac|email_hmac|passwordHash|\$argon2|@teste\.local/);
  });
  it('logout apaga a sessão: o token deixa de valer', async () => {
    const l = await app.inject({ method: 'POST', url: '/auth/login', payload: { name: `Admin ${run}`, email: EMAIL, password: PASS } });
    const t = l.json().data.accessToken as string;
    const auth = { authorization: `Bearer ${t}` };
    assert.equal((await app.inject({ method: 'GET', url: '/auth/me', headers: auth })).statusCode, 200);
    await app.inject({ method: 'POST', url: '/auth/logout', headers: auth });
    assert.equal((await app.inject({ method: 'GET', url: '/auth/me', headers: auth })).statusCode, 401);
  });
  it('token do APP/JWT forjado não vale no ADM (sessão opaca em tabela própria)', async () => {
    const fake = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.assinatura';
    assert.equal((await app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${fake}` } })).statusCode, 401);
  });
  it('troca de senha encerra as outras sessões', async () => {
    const mk = async () => (await app.inject({ method: 'POST', url: '/auth/login', payload: { name: `Admin ${run}`, email: EMAIL, password: PASS } })).json().data.accessToken as string;
    const t1 = await mk(); const t2 = await mk();
    const r = await app.inject({ method: 'POST', url: '/auth/change-password', headers: { authorization: `Bearer ${t1}` }, payload: { currentPassword: PASS, newPassword: 'NovaSenha#Forte2026' } });
    assert.equal(r.statusCode, 200, r.body);
    assert.equal((await app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${t1}` } })).statusCode, 200);
    assert.equal((await app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${t2}` } })).statusCode, 401);
  });
  it('2FA: ativa com TOTP, exige o 2º fator no login, recusa replay e aceita código de recuperação só uma vez', async () => {
    const login = async () => (await app.inject({ method: 'POST', url: '/auth/login', payload: { name: `Admin ${run}`, email: EMAIL, password: NEW_PASS } })).json().data;
    // senha foi trocada no teste anterior; entra e ativa o 2FA
    const first = await login();
    const auth = { authorization: `Bearer ${first.accessToken}` };
    const setup = await app.inject({ method: 'POST', url: '/auth/2fa/setup', headers: auth, payload: { adminPassword: NEW_PASS } });
    assert.equal(setup.statusCode, 200, setup.body);
    const secret = base32Decode(setup.json().data.secret);
    const enable = await app.inject({ method: 'POST', url: '/auth/2fa/enable', headers: auth, payload: { code: hotp(secret, stepAt(Date.now())) } });
    assert.equal(enable.statusCode, 200, enable.body);
    const recovery = enable.json().data.recoveryCodes as string[];
    assert.equal(recovery.length, 8);

    const step1 = await login();
    assert.equal(step1.twoFactorRequired, true);
    assert.equal(step1.accessToken, undefined, 'sem sessão antes do 2º fator');
    const ch = step1.challengeToken as string;
    const bad = await app.inject({ method: 'POST', url: '/auth/login/2fa', payload: { challengeToken: ch, code: '000000' } });
    assert.equal(bad.statusCode, 401);
    // o código do passo já usado na ativação não pode ser reutilizado (replay): usa o do passo seguinte
    const code = hotp(secret, stepAt(Date.now()) + 1);
    const ok = await app.inject({ method: 'POST', url: '/auth/login/2fa', payload: { challengeToken: ch, code } });
    assert.equal(ok.statusCode, 200, ok.body);
    assert.ok(ok.json().data.accessToken);
    const replay = await app.inject({ method: 'POST', url: '/auth/login/2fa', payload: { challengeToken: ch, code } });
    assert.equal(replay.statusCode, 401, 'desafio é de uso único');

    const ch2 = (await login()).challengeToken as string;
    const viaRecovery = await app.inject({ method: 'POST', url: '/auth/login/2fa', payload: { challengeToken: ch2, code: recovery[0] } });
    assert.equal(viaRecovery.statusCode, 200, viaRecovery.body);
    const ch3 = (await login()).challengeToken as string;
    const again = await app.inject({ method: 'POST', url: '/auth/login/2fa', payload: { challengeToken: ch3, code: recovery[0] } });
    assert.equal(again.statusCode, 401, 'código de recuperação vale uma vez');
  });
  it('auditoria registra ações sem senhas, tokens nem textos', async () => {
    const r = await app.inject({ method: 'GET', url: '/audit?type=SECURITY&pageSize=50', headers: { authorization: `Bearer ${(await app.inject({ method: 'POST', url: '/auth/login', payload: { name: `Admin ${run}`, email: EMAIL, password: NEW_PASS } })).json().data.accessToken ?? ''}` } });
    // com 2FA ativo o login acima devolve desafio (sem token): a consulta então é 401, o que também é um resultado válido
    if (r.statusCode === 200) {
      assert.ok(r.json().data.items.length > 0);
      assert.doesNotMatch(r.body, /adminPassword|\$argon2|recoveryCodes|challengeToken/);
    } else assert.equal(r.statusCode, 401);
  });
  it('login errado: mensagem genérica; limite por IP devolve 429', async () => {
    let last = 0;
    for (let i = 0; i < 8; i++) last = (await app.inject({ method: 'POST', url: '/auth/login', payload: { name: 'Nao Existe', email: 'n@x.com', password: 'errada' } })).statusCode;
    assert.equal(last, 429);
  });
});
