import { Coffee } from 'lucide-react';
import { Avatar } from '@/components/common/Avatar';
import { STATUS_LABEL } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BarberAgenda } from './types';

const ROW = 44; // px por 30 minutos
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Mesma cor para o mesmo serviço em todas as colunas, para o gestor achar "todos os cortes" de relance
const TONES = ['bg-[var(--ev-teal)] text-[var(--ev-teal-fg)]', 'bg-[var(--ev-blue)] text-[var(--ev-blue-fg)]', 'bg-[var(--ev-yellow)] text-[var(--ev-yellow-fg)]', 'bg-[var(--ev-gray)] text-[var(--ev-gray-fg)]'];
function tone(service: string) {
  let h = 0;
  for (const ch of service) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

/** Grade do dia: uma coluna por profissional (foto e nome no topo), horários na lateral e os atendimentos como blocos. */
export function AgendaGrid({ agendas }: { agendas: BarberAgenda[] }) {
  const spans = agendas.flatMap((a) => [...a.working, ...a.breaks, ...a.appointments.filter((x) => x.status !== 'CANCELLED')]);
  const start = Math.floor(Math.min(9 * 60, ...spans.map((s) => toMin(s.startTime))) / 60) * 60;
  const end = Math.ceil(Math.max(18 * 60, ...spans.map((s) => toMin(s.endTime))) / 60) * 60;
  const y = (m: number) => ((m - start) / 30) * ROW;
  const hours = Array.from({ length: (end - start) / 60 }, (_, i) => start + i * 60);
  const single = agendas.length === 1;

  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
      <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${agendas.length}, minmax(${single ? '0' : '10.5rem'}, 1fr))` }}>
        <div className="sticky left-0 z-10 border-b bg-card" />
        {agendas.map((a) => (
          <div key={a.barberId} className="flex flex-col items-center gap-2 border-b border-l px-2 py-4 text-center">
            <Avatar name={a.name} photoUrl={a.photoUrl} className={single ? 'size-20 text-lg' : 'size-14 text-sm'} />
            <p className={cn('font-bold', single ? 'text-base' : 'text-sm')}>{a.name}</p>
          </div>
        ))}

        {/* horários fixos à esquerda quando a grade rola para o lado no celular */}
        <div className="sticky left-0 z-10 bg-card" style={{ height: y(end) }} aria-hidden>
          {hours.map((m) => (
            <span key={m} className="tnum absolute right-2 text-xs font-semibold text-muted-foreground" style={{ top: y(m) + 4 }}>{toTime(m)}</span>
          ))}
        </div>

        {agendas.map((a) => (
          <div key={a.barberId} className="relative border-l bg-background" style={{ height: y(end) }}>
            {/* expediente em branco; fora dele fica o fundo apagado */}
            {a.working.map((w) => (
              <div key={w.startTime} className="absolute inset-x-0 bg-card" style={{ top: y(toMin(w.startTime)), height: y(toMin(w.endTime)) - y(toMin(w.startTime)) }} />
            ))}
            <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${ROW}px)` }} />

            {a.breaks.map((b) => (
              <div key={`b${b.id}`} className="absolute inset-x-1 flex items-center gap-1.5 overflow-hidden rounded-md border border-dashed bg-muted px-2 text-xs text-muted-foreground"
                style={{ top: y(toMin(b.startTime)) + 2, height: y(toMin(b.endTime)) - y(toMin(b.startTime)) - 4 }}>
                <Coffee className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{b.reason || 'Pausa'}</span>
              </div>
            ))}

            {a.appointments.filter((x) => x.status !== 'CANCELLED').map((x) => (
              <div key={x.id} title={`${x.startTime}–${x.endTime} · ${x.clientName} · ${x.serviceName} · ${STATUS_LABEL[x.status]}`}
                className={cn('absolute inset-x-1 overflow-hidden rounded-md px-2.5 py-1.5 text-xs shadow-card', tone(x.serviceName), x.status === 'NO_SHOW' && 'opacity-60')}
                style={{ top: y(toMin(x.startTime)) + 2, height: y(toMin(x.endTime)) - y(toMin(x.startTime)) - 4 }}>
                <p className="tnum">{x.startTime} - {x.endTime}{x.status !== 'CONFIRMED' && ` · ${STATUS_LABEL[x.status]}`}</p>
                <p className="truncate text-sm font-bold">{x.clientName}</p>
                <p className="truncate">{x.serviceName}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
