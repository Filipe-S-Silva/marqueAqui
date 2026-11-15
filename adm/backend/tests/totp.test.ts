import assert from 'node:assert/strict';
import { test } from 'node:test';
import { auditType } from '../src/utils/audit-type.ts';
import { scrub } from '../src/utils/scrub.ts';
import { open, seal } from '../src/utils/secretbox.ts';
import {
  base32Decode, base32Encode, generateRecoveryCode, generateSecret, hashRecoveryCode, hotp, looksLikeRecoveryCode,
  normalizeRecoveryCode, otpauthUrl, stepAt, verifyTotp,
} from '../src/utils/totp.ts';

const RFC = Buffer.from('12345678901234567890'); // segredo de teste do RFC 6238 (SHA-1)

test('TOTP: vetores do RFC 6238 (6 últimos dígitos dos códigos de 8)', () => {
  const vectors: Array<[number, string]> = [[59, '287082'], [1111111109, '081804'], [1111111111, '050471'], [1234567890, '005924'], [2000000000, '279037']];
  for (const [t, code] of vectors) assert.equal(hotp(RFC, stepAt(t * 1000)), code, `t=${t}`);
});

test('TOTP: janela ±1, e o mesmo passo não é aceito duas vezes (replay)', () => {
  const now = 1_111_111_109_000;
  const step = stepAt(now);
  const code = hotp(RFC, step);
  assert.equal(verifyTotp(RFC, code, now, 0), step);
  assert.equal(verifyTotp(RFC, code, now, step), null, 'replay');
  assert.equal(verifyTotp(RFC, hotp(RFC, step - 1), now, 0), step - 1, 'passo anterior');
  assert.equal(verifyTotp(RFC, hotp(RFC, step + 2), now, 0), null, 'fora da janela');
  assert.equal(verifyTotp(RFC, '12345', now, 0), null);
  assert.equal(verifyTotp(RFC, 'abcdef', now, 0), null);
});

test('base32: ida e volta e rejeita caractere inválido', () => {
  const s = generateSecret();
  assert.equal(s.length, 20);
  assert.deepEqual(base32Decode(base32Encode(s)), s);
  assert.equal(base32Encode(Buffer.from('foobar')), 'MZXW6YTBOI');
  assert.throws(() => base32Decode('abc!'));
});

test('otpauth: contém issuer, segredo base32 e parâmetros', () => {
  const u = otpauthUrl({ issuer: 'MarqueAqui ADM', label: 'Ana Souza', secret: RFC });
  assert.match(u, /^otpauth:\/\/totp\/MarqueAqui%20ADM:Ana%20Souza\?/);
  assert.match(u, /secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ/);
  assert.match(u, /digits=6/);
});

test('códigos de recuperação: formato, normalização e HMAC dependente do pepper', () => {
  const c = generateRecoveryCode();
  assert.match(c, /^[A-Z2-7]{4}-[A-Z2-7]{4}-[A-Z2-7]{4}$/);
  assert.ok(looksLikeRecoveryCode(c.toLowerCase()));
  assert.equal(normalizeRecoveryCode(` ${c.toLowerCase()} `), c.replaceAll('-', ''));
  assert.ok(!looksLikeRecoveryCode('123456'));
  const p = 'p'.repeat(40);
  assert.equal(hashRecoveryCode(c, p), hashRecoveryCode(c.toLowerCase(), p));
  assert.notEqual(hashRecoveryCode(c, p), hashRecoveryCode(c, 'q'.repeat(40)));
  assert.notEqual(generateRecoveryCode(), generateRecoveryCode());
});

test('segredo cifrado: ida e volta, falha com outro pepper ou adulterado', () => {
  const p = 'p'.repeat(40);
  const sealed = seal(RFC, p);
  assert.ok(!sealed.includes(RFC.toString('base64url')));
  assert.deepEqual(open(sealed, p), RFC);
  assert.throws(() => open(sealed, 'q'.repeat(40)));
  const parts = sealed.split('.'); parts[3] = Buffer.from('xxxxxxxxxxxxxxxxxxxx').toString('base64url');
  assert.throws(() => open(parts.join('.'), p));
});

test('auditoria: classificação por tipo e remoção de segredos e textos', () => {
  assert.equal(auditType('admin.login'), 'AUTH');
  assert.equal(auditType('admin.login_failed'), 'SECURITY');
  assert.equal(auditType('admin.2fa_enabled'), 'SECURITY');
  assert.equal(auditType('user.update'), 'USER');
  assert.equal(auditType('user.unlock'), 'SECURITY');
  assert.equal(auditType('shop.deactivate'), 'SHOP');
  assert.equal(auditType('ticket.reply'), 'SUPPORT');
  assert.equal(auditType('announcement.send'), 'ANNOUNCEMENT');
  assert.equal(auditType('admin.create'), 'ADMIN');
  const out = scrub({ count: 3, adminPassword: 'x', token: 'y', message: 'texto livre', recoveryCodes: ['a'], nested: { secretKey: 'z', ok: 1 }, titleLength: 12 });
  assert.deepEqual(out, { count: 3, nested: { ok: 1 }, titleLength: 12 });
});
