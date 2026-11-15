import { CalendarPlus, CalendarClock, CheckCircle2, ListChecks, RotateCcw, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { CountUp, Rise } from '@/components/common/motion';
import { ErrorState } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { ReviewDialog } from './ReviewDialog';
import type { ClientDashboardData } from './types';

export function ClientDashboard() {
  const { user } = useAuth();
  const d = useAsync(() => api.get<ClientDashboardData>('/client/dashboard'), []);
  const [reviewing, setReviewing] = useState(false);
  const first = user?.name.split(' ')[0] ?? '';

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Olá, {first}!</h1>
          <p className="text-sm text-muted-foreground">Veja seus próximos horários ou agende um novo.</p>
        </div>
        <Button asChild><Link to="/app/new"><CalendarPlus className="size-4" /> Novo agendamento</Link></Button>
      </div>

      {d.error ? <ErrorState message={d.error} onRetry={d.reload} /> : d.loading || !d.data ? (
        <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : (
        <>
          {d.data.pendingReview && (
            <Rise index={0}>
              <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/40 bg-primary/5 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-primary/15 text-primary"><Star className="size-5" aria-hidden /></span>
                  <div>
                    <p className="font-bold">Como foi seu atendimento?</p>
                    <p className="text-sm text-muted-foreground">{d.data.pendingReview.serviceName} em {d.data.pendingReview.shopName}, {formatDate(d.data.pendingReview.date)}.</p>
                  </div>
                </div>
                <Button onClick={() => setReviewing(true)}>Avaliar agora</Button>
              </Card>
              <ReviewDialog target={reviewing ? d.data.pendingReview : null} onClose={() => setReviewing(false)} onDone={d.reload} />
            </Rise>
          )}
          <Rise index={0}>
          <Card className="relative overflow-hidden">
            <span className="pole absolute inset-y-0 left-0 w-1.5" aria-hidden />
            <CardHeader className="pl-7"><CardTitle className="flex items-center gap-2"><CalendarClock className="size-4 text-primary" /> Próximo agendamento</CardTitle></CardHeader>
            <CardContent className="pl-7">
              {d.data.next ? (
                <div>
                  <p className="font-display text-2xl font-bold">{d.data.next.serviceName}</p>
                  <p className="text-sm text-muted-foreground">{d.data.next.shopName} · com {d.data.next.professionalName}</p>
                  <p className="mt-1 font-semibold">{formatDate(d.data.next.date)} às {d.data.next.startTime}</p>
                </div>
              ) : <p className="text-sm text-muted-foreground">Você não tem agendamentos futuros.</p>}
            </CardContent>
          </Card>
          </Rise>
          {d.data.lastBooking && (
            <Rise index={1}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-secondary text-primary"><RotateCcw className="size-5" aria-hidden /></span>
                  <div>
                    <p className="font-bold">Repetir sua última reserva</p>
                    <p className="text-sm text-muted-foreground">{d.data.lastBooking.serviceName} em {d.data.lastBooking.shopName}. Você só escolhe a nova data.</p>
                  </div>
                </div>
                <Button variant="outline" asChild>
                  <Link to="/app/new" state={{ rebook: { shopId: d.data.lastBooking.shopId, serviceId: d.data.lastBooking.serviceId } }}>Agendar de novo</Link>
                </Button>
              </Card>
            </Rise>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat icon={ListChecks} label="Agendamentos" index={1} value={d.data.totalAppointments} />
            <Stat icon={CalendarClock} label="Próximos" index={2} value={d.data.upcomingAppointments} />
            <Stat icon={CheckCircle2} label="Atendimentos concluídos" index={3} value={d.data.completedAppointments} />
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, index }: { icon: typeof ListChecks; label: string; value: number; index: number }) {
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
