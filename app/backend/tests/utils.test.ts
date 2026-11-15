// Testes das utilidades puras do backend. Rodam sem dependências externas:
//   node --test app/backend/tests/utils.test.ts
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { parseCookies, serializeCookie } from '../src/utils/cookies.ts';
import { buildWordDoc, maskPhone, toCsv } from '../src/utils/documents.ts';
import { JwtError, signAccessToken, verifyAccessToken } from '../src/utils/jwt.ts';
import { createRateLimiter } from '../src/utils/rate-limit.ts';

const SECRET = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres';
const CLAIMS = { sub: '7', role: 'MANAGER' as const, shop: 3, sid: '11111111-1111-4111-8111-111111111111' };
const NOW = 1_800_000_000;

function reason(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof JwtError ? e.reason : `OUTRO:${String(e)}`;
  }
  return undefined;
}

const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');

describe('JWT HS256', () => {
  it('assina e valida um token válido', () => {
    const token = signAccessToken(CLAIMS, SECRET, 900, NOW);
    const claims = verifyAccessToken(token, SECRET, NOW + 10);
    assert.equal(claims.sub, '7');
    assert.equal(claims.role, 'MANAGER');
    assert.equal(claims.shop, 3);
    assert.equal(claims.exp, NOW + 900);
  });

  it('rejeita token expirado', () => {
    const token = signAccessToken(CLAIMS, SECRET, 900, NOW);
    assert.equal(reason(() => verifyAccessToken(token, SECRET, NOW + 900)), 'EXPIRED');
    assert.equal(reason(() => verifyAccessToken(token, SECRET, NOW + 5000)), 'EXPIRED');
  });

  it('rejeita assinatura de outro segredo e payload adulterado', () => {
    const token = signAccessToken(CLAIMS, SECRET, 900, NOW);
    assert.equal(reason(() => verifyAccessToken(token, SECRET + 'x', NOW)), 'BAD_SIGNATURE');

    const [h, p, s] = token.split('.') as [string, string, string];
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    payload.role = 'CLIENT';
    const forged = `${h}.${b64u(JSON.stringify(payload))}.${s}`;
    assert.equal(reason(() => verifyAccessToken(forged, SECRET, NOW)), 'BAD_SIGNATURE');
  });

  it('rejeita alg "none" e outros algoritmos, mesmo com assinatura vazia', () => {
    const body = b64u(JSON.stringify({ ...CLAIMS, typ: 'access', iss: 'marqueaqui-app', aud: 'marqueaqui-app-api', iat: NOW, exp: NOW + 900 }));
    const none = `${b64u(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${body}.`;
    assert.equal(reason(() => verifyAccessToken(none, SECRET, NOW)), 'MALFORMED');

    const hs512Header = b64u(JSON.stringify({ alg: 'HS512', typ: 'JWT' }));
    const sig = b64u(createHmac('sha512', SECRET).update(`${hs512Header}.${body}`).digest());
    assert.equal(reason(() => verifyAccessToken(`${hs512Header}.${body}.${sig}`, SECRET, NOW)), 'MALFORMED');
  });

  it('rejeita emissor, audiência e tipo incorretos mesmo com assinatura válida', () => {
    const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const make = (over: Record<string, unknown>) => {
      const body = b64u(
        JSON.stringify({ ...CLAIMS, typ: 'access', iss: 'marqueaqui-app', aud: 'marqueaqui-app-api', iat: NOW, exp: NOW + 900, ...over }),
      );
      const sig = b64u(createHmac('sha256', SECRET).update(`${header}.${body}`).digest());
      return `${header}.${body}.${sig}`;
    };
    assert.equal(reason(() => verifyAccessToken(make({}), SECRET, NOW)), undefined);
    assert.equal(reason(() => verifyAccessToken(make({ iss: 'outro' }), SECRET, NOW)), 'INVALID_CLAIMS');
    assert.equal(reason(() => verifyAccessToken(make({ aud: 'adm' }), SECRET, NOW)), 'INVALID_CLAIMS');
    assert.equal(reason(() => verifyAccessToken(make({ typ: 'refresh' }), SECRET, NOW)), 'INVALID_CLAIMS');
    assert.equal(reason(() => verifyAccessToken(make({ role: 'ADMIN' }), SECRET, NOW)), 'INVALID_CLAIMS');
    assert.equal(reason(() => verifyAccessToken(make({ iat: NOW + 3600 }), SECRET, NOW)), 'INVALID_CLAIMS');
  });

  it('rejeita lixo e tokens malformados', () => {
    for (const bad of ['', 'abc', 'a.b', 'a.b.c.d', '....', '!!!.@@@.###']) {
      assert.equal(reason(() => verifyAccessToken(bad, SECRET, NOW)), 'MALFORMED', bad);
    }
    assert.equal(reason(() => verifyAccessToken('x'.repeat(5000), SECRET, NOW)), 'MALFORMED');
  });
});

describe('rate limiter', () => {
  it('bloqueia ao exceder o limite e libera após a janela', () => {
    let t = 0;
    const rl = createRateLimiter({ windowMs: 1000, max: 3, now: () => t });
    assert.equal(rl.hit('a').limited, false);
    assert.equal(rl.hit('a').limited, false);
    assert.equal(rl.hit('a').limited, true); // 3ª ocorrência atinge o limite
    assert.equal(rl.peek('a').limited, true);
    assert.equal(rl.peek('b').limited, false);
    t = 1001;
    assert.equal(rl.peek('a').limited, false);
  });

  it('informa Retry-After e permite reset', () => {
    let t = 0;
    const rl = createRateLimiter({ windowMs: 60_000, max: 1, now: () => t });
    const r = rl.hit('k');
    assert.equal(r.limited, true);
    assert.equal(r.retryAfterSeconds, 60);
    t = 30_000;
    assert.equal(rl.peek('k').retryAfterSeconds, 30);
    rl.reset('k');
    assert.equal(rl.peek('k').limited, false);
  });

  it('limita o número de chaves em memória', () => {
    const rl = createRateLimiter({ windowMs: 1000, max: 5, maxKeys: 3 });
    for (let i = 0; i < 10; i++) rl.hit(`k${i}`);
    assert.equal(rl.peek('k9').limited, false);
  });
});

describe('cookies', () => {
  it('lê cookies e ignora duplicados maliciosos (vale o primeiro)', () => {
    const c = parseCookies('a=1; mq_refresh=abc%20def; a=2');
    assert.equal(c.a, '1');
    assert.equal(c.mq_refresh, 'abc def');
    assert.deepEqual(parseCookies(undefined), {});
  });

  it('serializa com HttpOnly, Secure e SameSite', () => {
    const s = serializeCookie('mq_refresh', 'tok', {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/auth',
      maxAgeSeconds: 60,
    });
    assert.equal(s, 'mq_refresh=tok; Path=/auth; Max-Age=60; HttpOnly; Secure; SameSite=Strict');
    assert.throws(() => serializeCookie('ruim;nome', 'x'));
  });
});

describe('documentos', () => {
  it('CSV neutraliza injeção de fórmula e escapa aspas e separadores', () => {
    const csv = toCsv(['Nome', 'Obs'], [['=HYPERLINK("x")', 'a;b'], ['+1', 'ok "citado"'], [null, 5]]);
    assert.ok(csv.startsWith('﻿'));
    assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
    assert.ok(csv.includes(`'+1`));
    assert.ok(csv.includes('"a;b"'));
    assert.ok(csv.includes('"ok ""citado"""'));
  });

  it('.doc escapa HTML do conteúdo', () => {
    const doc = buildWordDoc({
      title: 'Clientes <afetados>',
      headers: ['Nome'],
      rows: [['<script>alert(1)</script>']],
    });
    assert.ok(!doc.includes('<script>'));
    assert.ok(doc.includes('&lt;script&gt;'));
    assert.ok(doc.includes('Clientes &lt;afetados&gt;'));
  });

  it('mascara telefone mantendo DDD e dois últimos dígitos', () => {
    assert.equal(maskPhone('(71) 98888-0001'), '(71) *****-**01');
    assert.equal(maskPhone('123'), '');
    assert.equal(maskPhone(null), '');
  });
});
