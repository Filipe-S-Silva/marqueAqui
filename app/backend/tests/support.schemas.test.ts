// Validação dos contratos de feedback, chamado e avaliação (requer `npm install`, pois usa zod):
//   node --test tests/support.schemas.test.ts
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { feedbackBody, reviewBody, ticketCreateBody } from '../src/schemas/support.schemas.ts';

describe('feedbackBody', () => {
  it('aceita um feedback válido', () => {
    assert.equal(feedbackBody.safeParse({ category: 'SUGGESTION', rating: 5, message: 'Muito bom, parabéns!' }).success, true);
  });
  it('rejeita campos extras (mass assignment)', () => {
    assert.equal(feedbackBody.safeParse({ category: 'PRAISE', message: 'Muito bom, parabéns!', userId: 1, status: 'READ' }).success, false);
  });
  it('rejeita nota fora de 1–5 e mensagem curta', () => {
    assert.equal(feedbackBody.safeParse({ category: 'PRAISE', rating: 6, message: 'Muito bom, parabéns!' }).success, false);
    assert.equal(feedbackBody.safeParse({ category: 'PRAISE', message: 'curto' }).success, false);
  });
});

describe('ticketCreateBody', () => {
  it('rejeita categoria desconhecida e assunto curto', () => {
    assert.equal(ticketCreateBody.safeParse({ subject: 'Erro ao entrar', category: 'XPTO', message: 'Descrição suficiente' }).success, false);
    assert.equal(ticketCreateBody.safeParse({ subject: 'Oi', category: 'BUG', message: 'Descrição suficiente' }).success, false);
  });
  it('rejeita status enviado pelo cliente', () => {
    assert.equal(ticketCreateBody.safeParse({ subject: 'Erro ao entrar', category: 'BUG', message: 'Descrição suficiente', status: 'CLOSED' }).success, false);
  });
});

describe('reviewBody', () => {
  it('exige nota de 1 a 5 e trata comentário vazio como nulo', () => {
    assert.equal(reviewBody.safeParse({ rating: 0 }).success, false);
    const ok = reviewBody.safeParse({ rating: 4, comment: '   ' });
    assert.equal(ok.success, true);
    if (ok.success) assert.equal(ok.data.comment, null);
  });
});
