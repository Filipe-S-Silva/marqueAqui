import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emailHmac } from '../src/utils/hmac.ts';
import { randomToken, sha256Hex } from '../src/utils/crypto.ts';
import { containsNul } from '../src/utils/nuls.ts';
import { createRateLimiter } from '../src/utils/rate-limit.ts';


test('HMAC do e-mail: determinístico, normaliza caixa/espaços e depende do pepper', () => {
  const a = emailHmac('Admin@Exemplo.com ', 'p'.repeat(32));
  assert.equal(a, emailHmac('admin@exemplo.com', 'p'.repeat(32)));
  assert.notEqual(a, emailHmac('admin@exemplo.com', 'q'.repeat(32)));
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.ok(!a.includes('admin'));
});

test('Token de sessão: 32 bytes aleatórios, únicos, e o hash SHA-256 não revela o token', () => {
  const a = randomToken(32); const b = randomToken(32);
  assert.notEqual(a, b);
  assert.equal(Buffer.from(a, 'base64url').length, 32);
  assert.match(sha256Hex(a), /^[0-9a-f]{64}$/);
  assert.equal(sha256Hex(a), sha256Hex(a));
  assert.ok(!sha256Hex(a).includes(a));
});

test('NUL: detecta em strings, chaves e estruturas aninhadas', () => {
  assert.equal(containsNul('abc'), false);
  assert.equal(containsNul('a\u0000b'), true);
  assert.equal(containsNul({ a: { b: ['x', 'y\u0000'] } }), true);
  assert.equal(containsNul({ 'k\u0000': 1 }), true);
  assert.equal(containsNul(null), false);
});

test('Rate limit de login: 5 falhas bloqueiam a 6ª e liberam após a janela', () => {
  let now = 0;
  const l = createRateLimiter({ windowMs: 15 * 60_000, max: 5, now: () => now });
  for (let i = 0; i < 5; i++) l.hit('1.2.3.4');
  assert.equal(l.peek('1.2.3.4').limited, true);
  assert.equal(l.peek('5.6.7.8').limited, false);
  now += 15 * 60_000 + 1;
  assert.equal(l.peek('1.2.3.4').limited, false);
});
