import { Building2, CalendarCheck, CheckCircle2, LifeBuoy, MessageSquareText, UserCog, UserRound, Users } from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { CountUp, Rise } from '@/components/common/motion';
import { ErrorState, PageLoading } from '@/components/common/states';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';

interface Dash {
  totals: { shops: number; activeShops: number; managers: number; professionals: number; clients: number; appointmentsThisMonth: number; openTickets: number; newFeedbacks: number };
  recentShops: Array<{ id: number; name: string; active: boolean; createdAt: string }>;
}

function Kpi({ icon: Icon, label, value, index }: { icon: ComponentType<{ className?: string }>; label: string; value: number; index: number }) {
  return (
    <Rise index={index}>
      <Card className="flex items-center gap-4 p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary text-primary"><Icon className="size-5" aria-hidden /></span>
        <div>
          <p className="font-display text-3xl font-extrabold leading-none"><CountUp value={value} /></p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </Card>
    </Rise>
  );
}

export function Dashboard() {
  const d = useAsync(() => api.get<Dash>('/dashboard'), []);
  if (d.error) return <ErrorState message={d.error} onRetry={d.reload} />;
  if (d.loading || !d.data) return <PageLoading />;
  const { totals: t } = d.data;
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-extrabold">Painel</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi icon={Building2} label="Empresas" index={0} value={t.shops} />
        <Kpi icon={CheckCircle2} label="Empresas ativas" index={1} value={t.activeShops} />
        <Kpi icon={UserCog} label="Gestores" index={2} value={t.managers} />
        <Kpi icon={Users} label="Profissionais" index={3} value={t.professionals} />
        <Kpi icon={UserRound} label="Clientes" index={4} value={t.clients} />
        <Kpi icon={CalendarCheck} label="Agendamentos no mês" index={5} value={t.appointmentsThisMonth} />
        <Link to="/tickets" aria-label="Chamados aguardando resposta"><Kpi icon={LifeBuoy} label="Chamados aguardando resposta" index={6} value={t.openTickets} /></Link>
        <Link to="/feedbacks" aria-label="Feedbacks novos"><Kpi icon={MessageSquareText} label="Feedbacks novos" index={7} value={t.newFeedbacks} /></Link>
      </div>
      <Card>
        <CardHeader><CardTitle>Empresas cadastradas recentemente</CardTitle></CardHeader>
        <CardContent>
          <ul className="grid gap-1 text-sm">
            {d.data.recentShops.map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <Link to={`/shops/${s.id}`} className="font-medium hover:underline"><span className="tnum text-muted-foreground">#{s.id}</span> {s.name}</Link>
                <span className="text-muted-foreground">{formatDate(s.createdAt.slice(0, 10))}{s.active ? '' : ' · inativa'}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
