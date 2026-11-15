import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pepperPassword } from '../src/pepper.ts';

const P = 'p'.repeat(40);

test('sem pepper a senha passa inalterada', () => assert.equal(pepperPassword('abc', undefined), 'abc'));
test('com pepper: determinístico, depende da senha e do pepper, e não contém a senha', () => {
  const a = pepperPassword('Senha#2026', P);
  assert.equal(a, pepperPassword('Senha#2026', P));
  assert.notEqual(a, pepperPassword('Senha#2027', P));
  assert.notEqual(a, pepperPassword('Senha#2026', 'q'.repeat(40)));
  assert.ok(!a.includes('Senha'));
  assert.equal(Buffer.from(a, 'base64').length, 32);
});
