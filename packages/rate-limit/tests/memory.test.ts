import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryStore, createRateStore } from '../src/index.ts';

test('memória: 5 ocorrências bloqueiam a 6ª e liberam após a janela', async () => {
  let now = 0;
  const l = createMemoryStore().limiter('x', { windowMs: 15 * 60_000, max: 5, now: () => now });
  for (let i = 0; i < 5; i++) await l.hit('ip');
  assert.equal((await l.peek('ip')).limited, true);
  assert.equal((await l.peek('outro')).limited, false);
  now += 15 * 60_000 + 1;
  assert.equal((await l.peek('ip')).limited, false);
});

test('memória: reset limpa a chave e os nomes de limitadores são independentes', async () => {
  const s = createMemoryStore();
  const a = s.limiter('a', { windowMs: 60_000, max: 1 });
  const b = s.limiter('b', { windowMs: 60_000, max: 1 });
  await a.hit('k');
  assert.equal((await a.peek('k')).limited, true);
  assert.equal((await b.peek('k')).limited, false);
  await a.reset('k');
  assert.equal((await a.peek('k')).limited, false);
});

test('sem REDIS_URL a fábrica devolve o armazenamento em memória (sem carregar ioredis)', async () => {
  assert.equal((await createRateStore(undefined)).kind, 'memory');
  assert.equal((await createRateStore('')).kind, 'memory');
});
