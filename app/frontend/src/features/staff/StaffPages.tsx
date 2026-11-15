import { CalendarCheck, CalendarClock, CheckCircle2, Hourglass } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, ErrorState, PageLoading } from '@/components/common/states';
import { CountUp, Rise } from '@/components/common/motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync, errorMessage } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { brl, formatDate, todayInBrazil } from '@/lib/format';
import { AgendaColumn } from './AgendaView';
import { BreakForm } from './BreaksPanel';
import { DayNav } from './DayNav';
import { StaffBookingDialog } from './StaffBookingDialog';
import type { StaffAgenda } from './types';

interface UpcomingItem { id: number; date: string; startTime: string; clientName: string; serviceName: string; price: number }
interface StaffDash { todayAppointments: number; completedThisMonth: number; pendingToClose: number; upcoming: UpcomingItem[] }

export function StaffDashboard() {
  const d = useAsync(() => api.get<StaffDash>('/staff/dashboard'), []);
  if (d.error) return <ErrorState message={d.error} onRetry={d.reload} />;
  if (d.loading || !d.data) return <PageLoading />;
  const k = d.data;
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-extrabold">Início</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi icon={CalendarCheck} label="Atendimentos hoje" value={k.todayAppointments} index={0} />
        <Kpi icon={CheckCircle2} label="Concluídos no mês" value={k.completedThisMonth} index={1} />
        <Kpi icon={Hourglass} label="Aguardando conclusão" value={k.pendingToClose} index={2} />
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" /> Próximos atendimentos</CardTitle></CardHeader>
        <CardContent>
          {!k.upcoming.length ? <p className="text-sm text-muted-foreground">Nenhum atendimento futuro.</p> : (
            <ul className="grid gap-2">
              {k.upcoming.map((u) => (
                <li key={u.id} className="flex flex-wrap justify-between gap-2 rounded-md border p-3 text-sm">
                  <span className="font-semibold">{formatDate(u.date)} · {u.startTime} — {u.clientName}</span>
                  <span className="text-muted-foreground">{u.serviceName} · {brl(u.price)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function Kpi({ icon: Icon, label, value, format, index = 0 }: { icon: typeof CalendarCheck; label: string; value: string | number; format?: (n: number) => string; index?: number }) {
  return (
    <Rise index={index}>
      <Card className="flex items-center gap-4 p-5">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary text-primary"><Icon className="size-5" aria-hidden /></span>
        <div className="min-w-0">
          <p className="truncate font-display text-3xl font-extrabold leading-none">
            {typeof value === 'number' ? <CountUp value={value} format={format} /> : value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{label}</p>
        </div>
      </Card>
    </Rise>
  );
}

export function StaffAgendaPage() {
  const { activeShopId, shops } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState(todayInBrazil());
  // activeShopId na chave: trocar de empresa recarrega a agenda
  const r = useAsync(() => api.get<StaffAgenda>(`/staff/agenda?date=${date}`), [date, activeShopId]);

  async function deleteBreak(id: number) {
    try { await api.del(`/staff/breaks/${id}`); toast.push('success', 'Pausa removida.'); r.reload(); }
    catch (e) { toast.push('error', errorMessage(e)); }
  }
  if (activeShopId === null) return <EmptyState title="Nenhuma empresa ativa" description={shops.length ? 'Selecione uma empresa no menu.' : 'Sua conta não tem vínculo ativo.'} />;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Minha agenda</h1>
        {r.data && <StaffBookingDialog shopId={activeShopId} barbers={[{ barberId: r.data.barberId, name: r.data.name }]} initialDate={date} onCreated={r.reload} />}
      </div>
      <DayNav date={date} onChange={setDate} />
      {r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : r.loading || !r.data ? <PageLoading /> : (
        <>
          <AgendaColumn agenda={r.data} date={date} onChanged={r.reload} onDeleteBreak={(id) => void deleteBreak(id)} />
          <BreakForm date={date} onCreated={r.reload} />
        </>
      )}
    </div>
  );
}
