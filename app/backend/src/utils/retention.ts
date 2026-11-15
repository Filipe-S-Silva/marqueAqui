// Cálculo puro da data de corte da retenção (testável sem banco).
/** Data limite (YYYY-MM-DD): agendamentos com data anterior a ela são apagados. */
export function retentionCutoff(todayIso: string, months: number): string {
  const [y, m, d] = todayIso.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay)); // 31/05 − 3 meses = 28/02 (ou 29)
  return target.toISOString().slice(0, 10);
}
