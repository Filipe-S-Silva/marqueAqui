export const brl = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' sem passar por Date (evita deslocamento de fuso). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
  return h ? `${h}h` : `${m} min`;
}

/** Até três iniciais do nome (fallback de logo). */
export function initials(name: string, max = 3): string {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 0 && /[A-Za-zÀ-ÿ0-9]/.test(w[0]!))
    .slice(0, max)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const weekdayShort = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]!;
};

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Hoje no fuso de Brasília como 'YYYY-MM-DD' (só para montar o calendário; o backend valida). */
export function todayInBrazil(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

export const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Faltou',
};
