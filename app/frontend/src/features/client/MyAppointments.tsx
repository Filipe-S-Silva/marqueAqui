import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Pagination } from '@/components/common/Pagination';
import { Rise } from '@/components/common/motion';
import { EmptyState, ErrorState } from '@/components/common/states';
import { Badge, STATUS_TONE } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ReviewDialog } from './ReviewDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/contexts/ToastContext';
import { useAsync, errorMessage } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { STATUS_LABEL, brl, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AppointmentRow, Paged } from './types';

const FILTERS = [['ALL', 'Todos'], ['CONFIRMED', 'Confirmados'], ['COMPLETED', 'Concluídos'], ['CANCELLED', 'Cancelados']] as const;
type Filter = (typeof FILTERS)[number][0];

export function MyAppointments() {
  const toast = useToast();
  const [status, setStatus] = useState<Filter>('ALL');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<AppointmentRow | null>(null);
  const [rating, setRating] = useState<AppointmentRow | null>(null);
  const r = useAsync(() => api.get<Paged<AppointmentRow>>(`/client/appointments?status=${status}&page=${page}&pageSize=6`), [status, page]);

  async function cancel() {
    if (!target) return;
    try { await api.post(`/client/appointments/${target.id}/cancel`); toast.push('success', 'Agendamento cancelado.'); r.reload(); }
    catch (e) { toast.push('error', errorMessage(e)); r.reload(); }
  }

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-extrabold">Meus agendamentos</h1>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
        {FILTERS.map(([v, label]) => (
          <Button key={v} size="sm" variant={status === v ? 'default' : 'outline'} aria-pressed={status === v} onClick={() => { setStatus(v); setPage(1); }}>{label}</Button>
        ))}
      </div>

      {r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : r.loading || !r.data ? (
        <div className="grid gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : !r.data.items.length ? <EmptyState title="Nenhum agendamento por aqui" /> : (
        <>
          <ul className="grid gap-3">
            {r.data.items.map((a, i) => (
              <Rise as="li" key={a.id} index={i}>
                <Card className={cn('lift flex flex-wrap items-center justify-between gap-3 p-4', a.status === 'CANCELLED' && 'opacity-75')}>
                  <div className="min-w-0">
                    <p className="font-bold">{a.serviceName}</p>
                    <p className="text-sm text-muted-foreground">{a.shopName} · {a.professionalName}</p>
                    <p className="mt-1 text-sm font-semibold">{formatDate(a.date)} · {a.startTime}–{a.endTime} · {brl(a.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                    {a.canCancel && <Button size="sm" variant="outline" onClick={() => setTarget(a)}>Cancelar</Button>}
                    {a.canReview && <Button size="sm" onClick={() => setRating(a)}>Avaliar</Button>}
                    {a.reviewed && <Badge tone="success">Avaliado</Badge>}
                    {a.status !== 'CONFIRMED' && a.shopId && a.serviceId && (
                      <Button size="sm" variant="ghost" asChild>
                        <Link to="/app/new" state={{ rebook: { shopId: a.shopId, serviceId: a.serviceId } }}><RotateCcw className="size-4" aria-hidden /> Agendar de novo</Link>
                      </Button>
                    )}
                  </div>
                </Card>
              </Rise>
            ))}
          </ul>
          <Pagination page={r.data.page} totalPages={r.data.totalPages} onChange={setPage} />
        </>
      )}

      <ReviewDialog target={rating} onClose={() => setRating(null)} onDone={r.reload} />
      <ConfirmDialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)} destructive confirmLabel="Cancelar agendamento"
        title="Cancelar este agendamento?"
        description={target ? `${target.serviceName} em ${formatDate(target.date)} às ${target.startTime}. Esta ação não pode ser desfeita.` : ''}
        onConfirm={cancel} />
    </div>
  );
}
