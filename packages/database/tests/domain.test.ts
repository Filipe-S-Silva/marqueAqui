// Testes das regras puras de datas e disponibilidade.
// Rodam com o test runner nativo do Node, sem dependências:
//   node --test packages/database/tests/
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addDays,
  isValidDate,
  isValidTime,
  minutesToTime,
  monthRange,
  nowInBusinessTz,
  timeToMinutes,
  weekdayOf,
} from '../src/domain/datetime.ts';
import {
  checkSlot,
  listFreeSlots,
  overlaps,
  validateWorkingIntervals,
  type CheckSlotInput,
} from '../src/domain/availability.ts';

const NOW = { date: '2026-11-02', minutes: 10 * 60 }; // segunda-feira 10:00
const working = [
  { startTime: '09:00', endTime: '12:00' },
  { startTime: '13:00', endTime: '18:00' },
];

function base(over: Partial<CheckSlotInput> = {}): CheckSlotInput {
  return {
    date: '2026-11-03',
    startTime: '09:00',
    durationMinutes: 30,
    working,
    breaks: [],
    appointments: [],
    now: NOW,
    ...over,
  };
}

describe('datetime', () => {
  it('valida datas reais e rejeita datas impossíveis', () => {
    assert.equal(isValidDate('2026-02-28'), true);
    assert.equal(isValidDate('2026-02-30'), false);
    assert.equal(isValidDate('2028-02-29'), true);
    assert.equal(isValidDate('2026-2-3'), false);
    assert.equal(isValidTime('23:59'), true);
    assert.equal(isValidTime('24:00'), false);
    assert.equal(isValidTime('9:00'), false);
  });

  it('converte horas e minutos', () => {
    assert.equal(timeToMinutes('09:30'), 570);
    assert.equal(minutesToTime(570), '09:30');
    assert.throws(() => minutesToTime(1440));
  });

  it('calcula dia da semana sem depender do fuso do servidor', () => {
    assert.equal(weekdayOf('2026-11-02'), 1); // segunda
    assert.equal(weekdayOf('2026-11-01'), 0); // domingo
    assert.equal(weekdayOf('2026-11-07'), 6); // sábado
  });

  it('soma dias atravessando mês e ano', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  });

  it('calcula o intervalo do mês', () => {
    assert.deepEqual(monthRange('2028-02'), { start: '2028-02-01', end: '2028-02-29' });
    assert.throws(() => monthRange('2026-13'));
  });

  it('usa o fuso America/Sao_Paulo para o "agora"', () => {
    // 2026-11-02T02:30:00Z é 2026-11-01 23:30 em São Paulo (UTC-3, sem horário de verão desde 2019)
    const n = nowInBusinessTz(new Date('2026-11-02T02:30:00Z'));
    assert.deepEqual(n, { date: '2026-11-01', minutes: 23 * 60 + 30 });
  });
});

describe('regra de sobreposição', () => {
  it('detecta sobreposição parcial, total e contida', () => {
    assert.equal(overlaps(540, 600, 570, 630), true);
    assert.equal(overlaps(540, 600, 540, 600), true);
    assert.equal(overlaps(540, 720, 570, 600), true);
  });
  it('horários encostados não conflitam', () => {
    assert.equal(overlaps(540, 570, 570, 600), false);
    assert.equal(overlaps(570, 600, 540, 570), false);
  });
});

describe('checkSlot', () => {
  it('aceita horário livre dentro do expediente', () => {
    assert.deepEqual(checkSlot(base()), { ok: true });
  });

  it('rejeita fora do expediente e durante o intervalo de almoço', () => {
    assert.deepEqual(checkSlot(base({ startTime: '08:30' })), { ok: false, reason: 'OUTSIDE_WORKING_HOURS' });
    assert.deepEqual(checkSlot(base({ startTime: '12:00' })), { ok: false, reason: 'OUTSIDE_WORKING_HOURS' });
    assert.deepEqual(checkSlot(base({ startTime: '17:30', durationMinutes: 60 })), {
      ok: false,
      reason: 'OUTSIDE_WORKING_HOURS',
    });
  });

  it('serviço não pode atravessar o intervalo entre dois turnos', () => {
    assert.deepEqual(checkSlot(base({ startTime: '11:30', durationMinutes: 60 })), {
      ok: false,
      reason: 'OUTSIDE_WORKING_HOURS',
    });
  });

  it('exige a grade de 30 minutos e duração múltipla de 30', () => {
    assert.deepEqual(checkSlot(base({ startTime: '09:15' })), { ok: false, reason: 'NOT_ON_GRID' });
    assert.deepEqual(checkSlot(base({ durationMinutes: 45 })), { ok: false, reason: 'INVALID_DURATION' });
    assert.deepEqual(checkSlot(base({ durationMinutes: 0 })), { ok: false, reason: 'INVALID_DURATION' });
  });

  it('rejeita data passada e horário que já começou hoje', () => {
    assert.deepEqual(checkSlot(base({ date: '2026-11-01' })), { ok: false, reason: 'PAST' });
    assert.deepEqual(checkSlot(base({ date: '2026-11-02', startTime: '09:30' })), { ok: false, reason: 'PAST' });
    assert.deepEqual(checkSlot(base({ date: '2026-11-02', startTime: '10:00' })), { ok: false, reason: 'PAST' });
    assert.deepEqual(checkSlot(base({ date: '2026-11-02', startTime: '10:30' })), { ok: true });
  });

  it('limita a janela a 21 dias (hoje + 20)', () => {
    assert.deepEqual(checkSlot(base({ date: '2026-11-22' })), { ok: true });
    assert.deepEqual(checkSlot(base({ date: '2026-11-23' })), { ok: false, reason: 'TOO_FAR' });
  });

  it('allowPast libera histórico (seed)', () => {
    assert.deepEqual(checkSlot(base({ date: '2026-10-01', allowPast: true })), { ok: true });
  });

  it('rejeita pausa e conflito com agendamento', () => {
    const breaks = [{ startTime: '15:00', endTime: '16:00' }];
    assert.deepEqual(checkSlot(base({ startTime: '15:30', breaks })), { ok: false, reason: 'DURING_BREAK' });
    assert.deepEqual(checkSlot(base({ startTime: '16:00', breaks })), { ok: true });

    const appointments = [{ startTime: '10:00', endTime: '11:00' }];
    assert.deepEqual(checkSlot(base({ startTime: '10:30', appointments })), { ok: false, reason: 'CONFLICT' });
    assert.deepEqual(checkSlot(base({ startTime: '09:30', durationMinutes: 60, appointments })), {
      ok: false,
      reason: 'CONFLICT',
    });
    assert.deepEqual(checkSlot(base({ startTime: '11:00', appointments })), { ok: true });
    assert.deepEqual(checkSlot(base({ startTime: '09:30', durationMinutes: 30, appointments })), { ok: true });
  });

  it('datas e horas inválidas retornam o motivo correto', () => {
    assert.deepEqual(checkSlot(base({ date: '2026-02-30' })), { ok: false, reason: 'INVALID_DATE' });
    assert.deepEqual(checkSlot(base({ startTime: '25:00' })), { ok: false, reason: 'INVALID_TIME' });
  });
});

describe('listFreeSlots', () => {
  it('lista toda a grade quando a agenda está vazia', () => {
    const slots = listFreeSlots({
      date: '2026-11-03',
      durationMinutes: 30,
      working,
      breaks: [],
      appointments: [],
      now: NOW,
    });
    assert.equal(slots.length, 6 + 10);
    assert.equal(slots[0], '09:00');
    assert.equal(slots.includes('12:00'), false);
    assert.equal(slots.includes('12:30'), false);
    assert.equal(slots.includes('13:00'), true);
    assert.equal(slots.at(-1), '17:30');
  });

  it('respeita duração, agendamentos e pausas', () => {
    const slots = listFreeSlots({
      date: '2026-11-03',
      durationMinutes: 60,
      working,
      breaks: [{ startTime: '15:00', endTime: '16:00' }],
      appointments: [{ startTime: '09:30', endTime: '10:30' }],
      now: NOW,
    });
    assert.equal(slots.includes('09:00'), false); // 09:00-10:00 bate com 09:30-10:30
    assert.equal(slots.includes('10:30'), true);
    assert.equal(slots.includes('11:30'), false); // 11:30-12:30 atravessa o almoço
    assert.equal(slots.includes('14:30'), false); // 14:30-15:30 bate na pausa
    assert.equal(slots.includes('16:00'), true);
    assert.equal(slots.includes('17:00'), true);
    assert.equal(slots.includes('17:30'), false);
  });

  it('hoje só mostra horários futuros', () => {
    const slots = listFreeSlots({
      date: '2026-11-02',
      durationMinutes: 30,
      working,
      breaks: [],
      appointments: [],
      now: NOW,
    });
    assert.equal(slots[0], '10:30');
  });

  it('sem expediente, sem horários', () => {
    const slots = listFreeSlots({
      date: '2026-11-07',
      durationMinutes: 30,
      working: [],
      breaks: [],
      appointments: [],
      now: NOW,
    });
    assert.deepEqual(slots, []);
  });
});

describe('validateWorkingIntervals', () => {
  it('ordena e aceita intervalos válidos', () => {
    const r = validateWorkingIntervals([
      { startTime: '13:00', endTime: '18:00' },
      { startTime: '09:00', endTime: '12:00' },
    ]);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.sorted[0]!.startTime, '09:00');
  });
  it('rejeita sobreposição, fim antes do início e fora da grade', () => {
    assert.equal(
      validateWorkingIntervals([
        { startTime: '09:00', endTime: '12:00' },
        { startTime: '11:30', endTime: '13:00' },
      ]).ok,
      false,
    );
    assert.equal(validateWorkingIntervals([{ startTime: '12:00', endTime: '09:00' }]).ok, false);
    assert.equal(validateWorkingIntervals([{ startTime: '09:10', endTime: '12:00' }]).ok, false);
  });
});
