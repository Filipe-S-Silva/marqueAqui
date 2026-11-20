import { useState, type FormEvent } from 'react';
import { Field } from '@/components/common/Field';
import { Pagination } from '@/components/common/Pagination';
import { Rise } from '@/components/common/motion';
import { EmptyState, ErrorState } from '@/components/common/states';
import { Stars } from '@/components/common/Stars';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage, useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { formatDateTime } from '@/features/support/labels';

interface Review {
  id: number; rating: number; comment: string | null; reply: string | null; repliedAt: string | null; createdAt: string;
  clientName: string; serviceName: string; professionalName: string | null; date: string;
}
interface ReviewsData {
  summary: { average: number | null; total: number; distribution: Array<{ rating: number; n: number }> };
  items: Review[]; page: number; totalPages: number;
}

/** Avaliações dos clientes sobre os atendimentos da empresa ativa. O gestor pode responder publicamente uma vez por avaliação. */
export function ReviewsPage() {
  const [page, setPage] = useState(1);
  const r = useAsync(() => api.get<ReviewsData>(`/manager/reviews?page=${page}&pageSize=8`), [page]);
  if (r.error) return <ErrorState message={r.error} onRetry={r.reload} />;
  if (r.loading || !r.data) return <div className="grid gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  const { summary, items } = r.data;
  const count = (n: number) => summary.distribution.find((d) => d.rating === n)?.n ?? 0;
  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-extrabold">Avaliações dos clientes</h1>
      <Card className="grid gap-4 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div>
          <p className="text-4xl font-extrabold">{summary.average ? summary.average.toFixed(1).replace('.', ',') : '–'}</p>
          {summary.average !== null && <Stars value={Math.round(summary.average)} />}
          <p className="mt-1 text-sm text-muted-foreground">{summary.total} {summary.total === 1 ? 'avaliação' : 'avaliações'}</p>
        </div>
        <ul className="grid gap-1.5" aria-label="Distribuição das notas">
          {[5, 4, 3, 2, 1].map((n) => (
            <li key={n} className="flex items-center gap-3 text-sm">
              <span className="w-20 shrink-0 whitespace-nowrap">{n} {n === 1 ? 'estrela' : 'estrelas'}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-warning" style={{ width: `${summary.total ? (count(n) / summary.total) * 100 : 0}%` }} />
              </span>
              <span className="w-8 text-right tabular-nums text-muted-foreground">{count(n)}</span>
            </li>
          ))}
        </ul>
      </Card>

      {!items.length ? <EmptyState title="Ainda sem avaliações" description="Quando um cliente avaliar um atendimento concluído, ele aparece aqui." /> : (
        <>
          <ul className="grid gap-3">
            {items.map((v, i) => <Rise as="li" key={v.id} index={i}><ReviewCard review={v} onChanged={r.reload} /></Rise>)}
          </ul>
          <Pagination page={r.data.page} totalPages={r.data.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}

function ReviewCard({ review: v, onChanged }: { review: Review; onChanged: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await api.post(`/manager/reviews/${v.id}/reply`, { reply: text }); toast.push('success', 'Resposta publicada.'); setOpen(false); onChanged(); }
    catch (err) { toast.push('error', errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <Card className="grid gap-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold">{v.clientName}</p>
          <p className="text-sm text-muted-foreground">{v.serviceName}{v.professionalName ? ` com ${v.professionalName}` : ''} · {formatDate(v.date)}</p>
        </div>
        <Stars value={v.rating} />
      </div>
      {v.comment && <p className="whitespace-pre-wrap break-words text-sm">{v.comment}</p>}
      {v.reply ? (
        <div className="rounded-md bg-secondary p-3 text-sm">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Sua resposta{v.repliedAt ? ` · ${formatDateTime(v.repliedAt)}` : ''}</p>
          <p className="whitespace-pre-wrap break-words">{v.reply}</p>
        </div>
      ) : open ? (
        <form onSubmit={send} className="grid gap-2">
          <Field label="Sua resposta"><Textarea value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} required /></Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={busy} disabled={text.trim().length < 2}>Publicar resposta</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      ) : <Button size="sm" variant="outline" className="w-fit" onClick={() => setOpen(true)}>Responder</Button>}
    </Card>
  );
}
