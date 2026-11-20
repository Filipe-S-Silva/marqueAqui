import { Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { ErrorState, PageLoading } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync, errorMessage } from '@/hooks/useAsync';
import { api, download } from '@/lib/api';
import { brl } from '@/lib/format';
import { Kpi } from '@/features/staff/StaffPages';
import { Ban, CalendarCheck, DollarSign, TrendingUp, Users } from 'lucide-react';

interface Rank { name: string; total: number; completed: number; revenue: number }
interface Report {
  month: string; byStatus: Record<'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW', number>;
  revenueRealized: number; revenueForecast: number; cancellationRate: number; uniqueClients: number;
  byProfessional: Rank[]; byService: Rank[]; perDay: Array<{ date: string; count: number }>;
}

const currentMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);

export function ReportPage() {
  const { activeShopId } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const r = useAsync(() => api.get<Report>(`/manager/reports/full?month=${month}`), [month, activeShopId]);

  async function csv() {
    try { await download(`/manager/reports/export?month=${month}&format=csv`, `agendamentos-${month}.csv`); }
    catch (e) { toast.push('error', errorMessage(e)); }
  }

  const max = Math.max(1, ...(r.data?.perDay.map((d) => d.count) ?? [1]));
  return (
    <div className="grid grid-cols-1 gap-5 print:gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Relatório mensal</h1>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Input type="month" className="w-auto" aria-label="Mês" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          <Button variant="outline" onClick={() => void csv()}><Download className="size-4" /> CSV</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Imprimir / PDF</Button>
        </div>
      </div>
      {r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : r.loading || !r.data ? <PageLoading /> : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Kpi icon={CalendarCheck} label="Confirmados / Concluídos" value={`${r.data.byStatus.CONFIRMED} / ${r.data.byStatus.COMPLETED}`} />
            <Kpi icon={Ban} label={`Cancelados · taxa ${r.data.cancellationRate.toLocaleString('pt-BR')}%`} value={r.data.byStatus.CANCELLED} />
            <Kpi icon={Users} label="Clientes únicos" value={r.data.uniqueClients} />
            <Kpi icon={DollarSign} label="Receita realizada" value={brl(r.data.revenueRealized)} />
            <Kpi icon={TrendingUp} label="Receita prevista" value={brl(r.data.revenueForecast)} />
            <Kpi icon={Ban} label="Faltas" value={r.data.byStatus.NO_SHOW} />
          </div>
          <Card>
            <CardHeader><CardTitle>Agendamentos por dia</CardTitle></CardHeader>
            <CardContent>
              {!r.data.perDay.length ? <p className="text-sm text-muted-foreground">Sem agendamentos no período.</p> : (
                <div className="flex h-40 items-end gap-1 overflow-x-auto" role="img" aria-label="Gráfico de barras de agendamentos por dia">
                  {r.data.perDay.map((d) => (
                    <div key={d.date} className="flex h-full min-w-5 flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                      <span className="tnum text-xs text-muted-foreground">{d.count}</span>
                      <div className="flex w-full flex-1 items-end">
                        <div className="w-full rounded-t bg-primary" style={{ height: `${(d.count / max) * 100}%`, minHeight: 4 }} />
                      </div>
                      <span className="tnum text-xs text-muted-foreground">{d.date.slice(8)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RankTable title="Por profissional" rows={r.data.byProfessional} />
            <RankTable title="Por serviço" rows={r.data.byService} />
          </div>
        </>
      )}
    </div>
  );
}

function RankTable({ title, rows }: { title: string; rows: Rank[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="py-1">Nome</th><th>Atend.</th><th>Concl.</th><th className="text-right">Receita</th></tr></thead>
          <tbody>{rows.map((x) => <tr key={x.name} className="border-t"><td className="py-1.5">{x.name}</td><td>{x.total}</td><td>{x.completed}</td><td className="text-right">{brl(x.revenue)}</td></tr>)}</tbody>
        </table>
        {!rows.length && <p className="pt-2 text-sm text-muted-foreground">Sem dados.</p>}
      </CardContent>
    </Card>
  );
}
