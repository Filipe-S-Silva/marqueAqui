// node --test tests/retention.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { retentionCutoff } from '../src/utils/retention.ts';

describe('retentionCutoff', () => {
  it('subtrai meses mantendo o dia', () => assert.equal(retentionCutoff('2026-11-12', 3), '2026-08-12'));
  it('atravessa o ano', () => assert.equal(retentionCutoff('2026-02-10', 3), '2025-11-10'));
  it('ajusta para o último dia do mês menor', () => {
    assert.equal(retentionCutoff('2026-05-31', 3), '2026-02-28');
    assert.equal(retentionCutoff('2028-05-31', 3), '2028-02-29');
  });
});
