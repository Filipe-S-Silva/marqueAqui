import { Ban, CalendarCheck, DollarSign, Scissors, TrendingUp, Users } from 'lucide-react';
import { ErrorState, PageLoading } from '@/components/common/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { brl, formatDate } from '@/lib/format';
import { Kpi } from '@/features/staff/StaffPages';

interface Row { id: number; date: string; startTime: string; clientName: string; serviceName: string; professionalName: string; price: number }
interface Dash {
  month: string; todayAppointments: number; professionals: number; services: number;
  revenueRealized: number; revenueForecast: number; cancellations: number; upcoming: Row[]; todayAgenda: Row[];
}

export function ManagerDashboard() {
  const { activeShopId } = useAuth();
  const d = useAsync(() => api.get<Dash>('/manager/dashboard'), [activeShopId]);
  if (d.error) return <ErrorState message={d.error} onRetry={d.reload} />;
  if (d.loading || !d.data) return <PageLoading />;
  const k = d.data;
  return (
    <div className="grid gap-6">
      <h1 className="font-display text-3xl font-extrabold">Visão geral</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi icon={CalendarCheck} label="Agendamentos hoje" value={k.todayAppointments} index={0} />
        <Kpi icon={Users} label="Profissionais ativos" value={k.professionals} index={1} />
        <Kpi icon={Scissors} label="Serviços ativos" value={k.services} index={2} />
        <Kpi icon={DollarSign} label="Receita realizada (mês)" value={k.revenueRealized} format={brl} index={3} />
        <Kpi icon={TrendingUp} label="Receita prevista (mês)" value={k.revenueForecast} format={brl} index={4} />
        <Kpi icon={Ban} label="Cancelamentos (mês)" value={k.cancellations} index={5} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <List title="Agenda de hoje" rows={k.todayAgenda} empty="Nada agendado para hoje." />
        <List title="Próximos atendimentos" rows={k.upcoming} empty="Nenhum atendimento futuro." />
      </div>
    </div>
  );
}

function List({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {!rows.length ? <p className="text-sm text-muted-foreground">{empty}</p> : (
          <ul className="grid gap-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-md border p-3 text-sm">
                <p className="font-semibold">{formatDate(r.date)} · {r.startTime} — {r.clientName}</p>
                <p className="text-muted-foreground">{r.serviceName} com {r.professionalName}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
