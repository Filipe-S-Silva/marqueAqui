// Regra de disponibilidade (spec 7.1 e 7.2). Funções puras, sem acesso a banco.
// Usada pelo backend (consulta e criação), pelo seed e pelos testes.
import {
  GRID_MINUTES,
  MAX_DAYS_AHEAD,
  addDays,
  isValidDate,
  isValidTime,
  minutesToTime,
  timeToMinutes,
  type BusinessNow,
} from './datetime.ts';

export interface TimeInterval {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export type SlotRejection =
  | 'INVALID_DATE'
  | 'INVALID_TIME'
  | 'INVALID_DURATION'
  | 'NOT_ON_GRID'
  | 'PAST'
  | 'TOO_FAR'
  | 'OUTSIDE_WORKING_HOURS'
  | 'DURING_BREAK'
  | 'CONFLICT';

export type SlotCheck = { ok: true } | { ok: false; reason: SlotRejection };

/** Regra de sobreposição: novoInicio < fimExistente && novoFim > inicioExistente (em minutos). */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export interface CheckSlotInput {
  date: string;
  startTime: string;
  durationMinutes: number;
  /** Intervalos de expediente do dia da semana correspondente. */
  working: TimeInterval[];
  /** Pausas e bloqueios da data. */
  breaks: TimeInterval[];
  /** Agendamentos NÃO cancelados do profissional na data. */
  appointments: TimeInterval[];
  now: BusinessNow;
  /** Permite datas/horas passadas (somente seed de histórico). */
  allowPast?: boolean;
  maxDaysAhead?: number;
}

export function checkSlot(input: CheckSlotInput): SlotCheck {
  const { date, startTime, durationMinutes, working, breaks, appointments, now } = input;
  if (!isValidDate(date)) return { ok: false, reason: 'INVALID_DATE' };
  if (!isValidTime(startTime)) return { ok: false, reason: 'INVALID_TIME' };
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < GRID_MINUTES ||
    durationMinutes % GRID_MINUTES !== 0
  ) {
    return { ok: false, reason: 'INVALID_DURATION' };
  }

  const start = timeToMinutes(startTime);
  const end = start + durationMinutes;
  if (start % GRID_MINUTES !== 0) return { ok: false, reason: 'NOT_ON_GRID' };
  if (end > 1439 + 1) return { ok: false, reason: 'OUTSIDE_WORKING_HOURS' };

  if (!input.allowPast) {
    if (date < now.date) return { ok: false, reason: 'PAST' };
    if (date === now.date && start <= now.minutes) return { ok: false, reason: 'PAST' };
    const lastAllowed = addDays(now.date, (input.maxDaysAhead ?? MAX_DAYS_AHEAD) - 1);
    if (date > lastAllowed) return { ok: false, reason: 'TOO_FAR' };
  }

  // O serviço inteiro precisa caber dentro de UM intervalo de expediente.
  const insideWorking = working.some(
    (w) => start >= timeToMinutes(w.startTime) && end <= timeToMinutes(w.endTime),
  );
  if (!insideWorking) return { ok: false, reason: 'OUTSIDE_WORKING_HOURS' };

  for (const b of breaks) {
    if (overlaps(start, end, timeToMinutes(b.startTime), timeToMinutes(b.endTime))) {
      return { ok: false, reason: 'DURING_BREAK' };
    }
  }
  for (const a of appointments) {
    if (overlaps(start, end, timeToMinutes(a.startTime), timeToMinutes(a.endTime))) {
      return { ok: false, reason: 'CONFLICT' };
    }
  }
  return { ok: true };
}

/** Lista os horários de início disponíveis (HH:MM) para um serviço de determinada duração. */
export function listFreeSlots(input: Omit<CheckSlotInput, 'startTime'>): string[] {
  if (!isValidDate(input.date)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const w of input.working) {
    const wStart = timeToMinutes(w.startTime);
    const wEnd = timeToMinutes(w.endTime);
    // primeiro início alinhado à grade de 30 minutos dentro do intervalo
    const first = Math.ceil(wStart / GRID_MINUTES) * GRID_MINUTES;
    for (let s = first; s + input.durationMinutes <= wEnd; s += GRID_MINUTES) {
      const startTime = minutesToTime(s);
      if (seen.has(startTime)) continue;
      if (checkSlot({ ...input, startTime }).ok) {
        seen.add(startTime);
        result.push(startTime);
      }
    }
  }
  return result.sort();
}

export function addDuration(startTime: string, durationMinutes: number): string {
  return minutesToTime(timeToMinutes(startTime) + durationMinutes);
}

/** Valida e normaliza intervalos de expediente de um dia: sem sobreposição, ordenados, na grade. */
export function validateWorkingIntervals(
  intervals: TimeInterval[],
): { ok: true; sorted: TimeInterval[] } | { ok: false; message: string } {
  const sorted = [...intervals].sort((a, b) => a.startTime.localeCompare(b.startTime));
  for (const it of sorted) {
    if (!isValidTime(it.startTime) || !isValidTime(it.endTime)) {
      return { ok: false, message: 'Horário inválido. Use o formato HH:MM.' };
    }
    const s = timeToMinutes(it.startTime);
    const e = timeToMinutes(it.endTime);
    if (e <= s) return { ok: false, message: 'O fim do intervalo deve ser depois do início.' };
    if (s % GRID_MINUTES !== 0 || e % GRID_MINUTES !== 0) {
      return { ok: false, message: 'Os horários devem seguir a grade de 30 minutos.' };
    }
  }
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (timeToMinutes(cur.startTime) < timeToMinutes(prev.endTime)) {
      return { ok: false, message: 'Os intervalos do mesmo dia não podem se sobrepor.' };
    }
  }
  return { ok: true, sorted };
}
