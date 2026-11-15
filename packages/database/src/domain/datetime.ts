// Lógica de datas e horas centralizada (spec 7.4).
// Datas: YYYY-MM-DD. Horas: HH:MM. Ambas em horário local do negócio, sem conversão UTC.
// Só o "agora" depende de fuso (America/Sao_Paulo).
// Este arquivo não tem dependências: pode ser usado por backends e frontends.

export const BUSINESS_TZ = 'America/Sao_Paulo';
export const GRID_MINUTES = 30;
export const MAX_DAYS_AHEAD = 21;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function isValidMonth(value: string): boolean {
  return MONTH_RE.test(value);
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) {
    throw new RangeError(`Minutos fora do dia: ${minutes}`);
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDate(dt: Date): string {
  const y = String(dt.getUTCFullYear()).padStart(4, '0');
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return formatDate(new Date(Date.UTC(y, m - 1, d + days)));
}

/** 0 = domingo ... 6 = sábado. Calculado em UTC sobre a data local, sem depender do fuso do servidor. */
export function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export interface BusinessNow {
  date: string;
  minutes: number;
}

/** "Agora" no fuso do negócio. Aceita um instante para facilitar testes. */
export function nowInBusinessTz(instant: Date = new Date()): BusinessNow {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function monthRange(month: string): { start: string; end: string } {
  if (!isValidMonth(month)) throw new RangeError(`Mês inválido: ${month}`);
  const [y, m] = month.split('-').map(Number) as [number, number];
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}` };
}

export function currentMonth(now: BusinessNow = nowInBusinessTz()): string {
  return now.date.slice(0, 7);
}
