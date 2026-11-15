import { Ban, Check, Coffee, UserX, X } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Badge, STATUS_TONE } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { STATUS_LABEL, brl, todayInBrazil } from '@/lib/format';
import type { AgendaAppointment, BarberAgenda } from './types';

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Só para exibição: janelas do expediente sem agendamento ou pausa. O backend continua sendo a fonte da verdade. */
export function freeGaps(a: BarberAgenda): Array<{ startTime: string; endTime: string }> {
  const busy = [
    ...a.appointments.filter((x) => x.status !== 'CANCELLED'),
    ...a.breaks,
  ].map((x) => [toMin(x.startTime), toMin(x.endTime)] as const).sort((p, q) => p[0] - q[0]);
  const gaps: Array<{ startTime: string; endTime: string }> = [];
  for (const w of a.working) {
    let cursor = toMin(w.startTime);
    const end = toMin(w.endTime);
    for (const [s, e] of busy) {
      if (e <= cursor || s >= end) continue;
      if (s > cursor) gaps.push({ startTime: toTime(cursor), endTime: toTime(Math.min(s, end)) });
      cursor = Math.max(cursor, e);
    }
    if (cursor < end) gaps.push({ startTime: toTime(cursor), endTime: toTime(end) });
  }
  return gaps;
}

type Action = { kind: 'cancel' | 'complete' | 'no-show'; appt: AgendaAppointment };

export function AgendaColumn({ agenda, date, onChanged, onDeleteBreak }: {
  agenda: BarberAgenda; date: string; onChanged: () => void; onDeleteBreak?: (id: number) => void;
}) {
  const toast = useToast();
  const [action, setAction] = useState<Action | null>(null);
  const today = todayInBrazil();
  const nowMin = (() => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()); return toMin(p); })();
  // Dica de interface; o backend valida de verdade se o horário já começou
  const started = (a: AgendaAppointment) => date < today || (date === today && toMin(a.startTime) <= nowMin);

  const items = [
    ...agenda.appointments.map((a) => ({ t: a.startTime, kind: 'appt' as const, a })),
    ...agenda.breaks.map((b) => ({ t: b.startTime, kind: 'break' as const, b })),
  ].sort((x, y) => x.t.localeCompare(y.t));
  const gaps = freeGaps(agenda);

  async function run() {
    if (!action) return;
    try {
      await api.post(`/staff/appointments/${action.appt.id}/${action.kind}`);
      toast.push('success', action.kind === 'cancel' ? 'Agendamento cancelado.' : action.kind === 'complete' ? 'Atendimento concluído.' : 'Falta registrada.');
    } catch (e) { toast.push('error', errorMessage(e)); }
    onChanged();
  }

  return (
    <Card className="grid gap-3 p-4">
      <div>
        <h3 className="font-bold">{agenda.name}</h3>
        <p className="text-xs text-muted-foreground">
          {agenda.working.length ? `Expediente: ${agenda.working.map((w) => `${w.startTime}–${w.endTime}`).join(' · ')}` : 'Sem expediente neste dia'}
        </p>
        {gaps.length > 0 && <p className="text-xs text-success">Livre: {gaps.map((g) => `${g.startTime}–${g.endTime}`).join(' · ')}</p>}
      </div>
      {!items.length ? <p className="text-sm text-muted-foreground">Nada agendado.</p> : (
        <ul className="grid gap-2">
          {items.map((it) => it.kind === 'break' ? (
            <li key={`b${it.b.id}`} className="flex items-center justify-between gap-2 rounded-md border border-dashed bg-muted/50 p-3 text-sm">
              <span className="flex items-center gap-2"><Coffee className="size-4 text-muted-foreground" aria-hidden /> {it.b.startTime}–{it.b.endTime} · {it.b.reason || 'Pausa'}</span>
              {onDeleteBreak && <Button size="sm" variant="ghost" onClick={() => onDeleteBreak(it.b.id)} aria-label="Remover pausa"><X className="size-4" /></Button>}
            </li>
          ) : (
            <li key={`a${it.a.id}`} className="rounded-md border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{it.a.startTime}–{it.a.endTime} · {it.a.clientName}</p>
                  <p className="text-sm text-muted-foreground">{it.a.serviceName} · {it.a.durationMinutes} min · {brl(it.a.price)}</p>
                  {it.a.clientPhone && <p className="text-xs text-muted-foreground">{it.a.clientPhone}</p>}
                </div>
                <Badge tone={STATUS_TONE[it.a.status]}>{STATUS_LABEL[it.a.status]}</Badge>
              </div>
              {it.a.status === 'CONFIRMED' && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" disabled={!started(it.a)} onClick={() => setAction({ kind: 'complete', appt: it.a })}><Check className="size-4" /> Concluir</Button>
                  <Button size="sm" variant="outline" disabled={!started(it.a)} onClick={() => setAction({ kind: 'no-show', appt: it.a })}><UserX className="size-4" /> Faltou</Button>
                  <Button size="sm" variant="outline" onClick={() => setAction({ kind: 'cancel', appt: it.a })}><Ban className="size-4" /> Cancelar</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog open={action !== null} onOpenChange={(o) => !o && setAction(null)}
        destructive={action?.kind === 'cancel'}
        title={action?.kind === 'cancel' ? 'Cancelar agendamento?' : action?.kind === 'complete' ? 'Concluir atendimento?' : 'Marcar como não compareceu?'}
        description={action ? `${action.appt.clientName} · ${action.appt.startTime} · ${action.appt.serviceName}` : ''}
        onConfirm={run} />
    </Card>
  );
}
