import { ArrowLeft, Check, Clock, MapPin, Search, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Rise } from '@/components/common/motion';
import { Alert, EmptyState, ErrorState } from '@/components/common/states';
import { Avatar } from '@/components/common/Avatar';
import { Stars } from '@/components/common/Stars';
import { ShopAvatar } from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAsync, errorMessage } from '@/hooks/useAsync';
import { ApiError, api } from '@/lib/api';
import { addDaysIso, brl, formatDate, formatDuration, todayInBrazil, weekdayShort } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Availability, ServiceItem, ShopCard, ShopServices } from './types';

const STEPS = ['Empresa', 'Serviço', 'Data', 'Horário', 'Confirmar'];
const SLOT_TAKEN = 'Esse horário acabou de ser reservado. Escolha outro horário.';

function Stepper({ step }: { step: number }) {
  return (
    <div className="grid gap-3">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="pole h-full w-full origin-left rounded-full transition-transform duration-300 ease-[cubic-bezier(0.77,0,0.175,1)]"
          style={{ transform: `scaleX(${(step + 1) / STEPS.length})` }} />
      </div>
      <ol className="flex items-center gap-1 overflow-x-auto text-xs sm:text-sm" aria-label="Etapas do agendamento">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-1" aria-current={i === step ? 'step' : undefined}>
            <span className={cn('grid size-6 place-items-center rounded-full font-bold transition-colors duration-200', i < step ? 'bg-success text-background' : i === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cn('whitespace-nowrap transition-colors duration-200', i === step ? 'font-bold' : 'text-muted-foreground')}>{label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-border" />}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function BookingWizard() {
  const [step, setStep] = useState(0);
  const [shop, setShop] = useState<ShopCard | null>(null);
  const [service, setService] = useState<ServiceItem | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [pick, setPick] = useState<{ barberId: number; name: string; time: string } | null>(null);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // "Agendar de novo": reaproveita só empresa e serviço da reserva anterior; a data sempre é escolhida de novo
  const rebook = (useLocation().state as { rebook?: { shopId: number; serviceId: number } } | null)?.rebook;
  const [rebooting, setRebooting] = useState(Boolean(rebook));
  useEffect(() => {
    if (!rebook) return;
    let live = true;
    api.get<ShopServices>(`/public/shops/${rebook.shopId}/services`)
      .then((r) => {
        if (!live) return;
        setShop({ ...r.shop, logoUrl: null });
        const svc = r.services.find((x) => x.id === rebook.serviceId && x.professionals.length > 0);
        if (svc) { setService(svc); setStep(2); }
        else { setNotice('Esse serviço não está mais disponível. Escolha outro serviço desta empresa.'); setStep(1); }
      })
      .catch(() => { if (live) setNotice('Não foi possível reaproveitar a reserva anterior. Escolha a empresa novamente.'); })
      .finally(() => { if (live) setRebooting(false); });
    return () => { live = false; };
    // roda uma vez, com o estado da navegação
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dir = useRef<'fwd' | 'back'>('fwd');
  const go = (n: number) => { dir.current = n >= step ? 'fwd' : 'back'; setStep(n); };
  const back = () => { setNotice(null); go(Math.max(0, step - 1)); };

  if (done && shop && service && date && pick) {
    return (
      <Card className="grid gap-4 p-8 text-center">
        <span className="ring-pop relative mx-auto grid size-16 place-items-center rounded-full bg-success/15 text-success">
          <svg viewBox="0 0 24 24" className="size-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        <h1 className="text-3xl font-extrabold">Agendamento confirmado</h1>
        <p className="mx-auto max-w-md text-muted-foreground">{service.name} em {shop.name}, com {pick.name}, em {formatDate(date)} às <span className="tnum font-semibold text-foreground">{pick.time}</span>.</p>
        <div className="flex justify-center gap-2">
          <Button asChild variant="outline"><Link to="/app/appointments">Meus agendamentos</Link></Button>
          <Button asChild><Link to="/app">Início</Link></Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Novo agendamento</h1>
        {step > 0 && <Button variant="ghost" size="sm" onClick={back}><ArrowLeft className="size-4" /> Voltar</Button>}
      </div>
      <Stepper step={step} />
      {notice && <Alert tone="error">{notice}</Alert>}

      {rebooting ? <Skeleton className="h-40" /> : (
      <div key={step} className={dir.current === 'fwd' ? 'step-fwd' : 'step-back'}>
      {step === 0 && <StepShop onPick={(s) => { setShop(s); setService(null); setDate(null); setPick(null); go(1); }} />}
      {step === 1 && shop && <StepService shopId={shop.id} onPick={(s) => { setService(s); setDate(null); setPick(null); go(2); }} />}
      {step === 2 && <StepDate value={date} onPick={(d) => { setDate(d); setPick(null); go(3); }} />}
      {step === 3 && shop && service && date && (
        <StepSlot shopId={shop.id} serviceId={service.id} date={date} onPick={(p) => { setPick(p); setNotice(null); go(4); }} />
      )}
      {step === 4 && shop && service && date && pick && (
        <StepConfirm shop={shop} service={service} date={date} pick={pick}
          onDone={() => setDone(true)}
          onTaken={() => { setPick(null); setNotice(SLOT_TAKEN); go(3); }} />
      )}
      </div>
      )}
    </div>
  );
}

function StepShop({ onPick }: { onPick: (s: ShopCard) => void }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const list = useAsync(() => api.get<ShopCard[]>(`/public/shops${debounced ? `?q=${encodeURIComponent(debounced)}` : ''}`), [debounced]);

  return (
    <div className="grid gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input className="pl-9" placeholder="Pesquisar empresa pelo nome" aria-label="Pesquisar empresa" value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
      </div>
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.loading ? (
        <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      ) : !list.data?.length ? <EmptyState title="Nenhuma empresa encontrada" description="Tente outro nome." /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.data.map((s, i) => (
            <Rise key={s.id} index={i}>
            <button type="button" onClick={() => onPick(s)} className="lift w-full rounded-lg border bg-card p-4 text-left shadow-card active:scale-[0.99]">
              <div className="flex items-start gap-3">
                <ShopAvatar name={s.name} logoUrl={s.logoUrl} />
                <div className="min-w-0">
                  <p className="truncate font-bold">{s.name}</p>
                  {s.description && <p className="line-clamp-2 text-sm text-muted-foreground">{s.description}</p>}
                  {s.address && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" aria-hidden /> {s.address}</p>}
                </div>
              </div>
            </button>
            </Rise>
          ))}
        </div>
      )}
    </div>
  );
}

function StepService({ shopId, onPick }: { shopId: number; onPick: (s: ServiceItem) => void }) {
  const r = useAsync(() => api.get<ShopServices>(`/public/shops/${shopId}/services`), [shopId]);
  if (r.error) return <ErrorState message={r.error} onRetry={r.reload} />;
  if (r.loading || !r.data) return <div className="grid gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  const usable = r.data.services.filter((s) => s.professionals.length > 0);
  if (!usable.length) return <EmptyState title="Esta empresa ainda não tem serviços disponíveis" />;
  return (
    <div className="grid gap-3">
      <ShopReviews shopId={shopId} />
      {usable.map((s, i) => (
        <Rise key={s.id} index={i}>
        <button type="button" onClick={() => onPick(s)} className="lift w-full rounded-lg border bg-card p-4 text-left shadow-card active:scale-[0.99]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold">{s.name}</p>
              {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                {s.professionals.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Avatar name={p.name} photoUrl={p.photoUrl} className="size-6 text-[10px]" /> {p.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="tnum font-display text-lg font-extrabold text-primary">{brl(s.price)}</p>
              <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground"><Clock className="size-3" aria-hidden /> {formatDuration(s.durationMinutes)}</p>
            </div>
          </div>
        </button>
        </Rise>
      ))}
    </div>
  );
}

interface PublicReviews { average: number | null; total: number; items: Array<{ id: number; rating: number; comment: string | null; reply: string | null; serviceName: string; clientName: string }> }

/** Nota média e últimos comentários de clientes que já foram atendidos na empresa. */
function ShopReviews({ shopId }: { shopId: number }) {
  const r = useAsync(() => api.get<PublicReviews>(`/public/shops/${shopId}/reviews`).catch(() => null), [shopId]);
  const [open, setOpen] = useState(false);
  if (!r.data || r.data.total === 0) return null;
  const withText = r.data.items.filter((i) => i.comment);
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-bold">
          <Star className="size-4 fill-warning text-warning" aria-hidden />
          <span className="tnum">{r.data.average?.toFixed(1).replace('.', ',')}</span>
          <span className="text-sm font-normal text-muted-foreground">({r.data.total} {r.data.total === 1 ? 'avaliação' : 'avaliações'})</span>
        </p>
        {withText.length > 0 && <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Ocultar comentários' : 'Ver comentários'}</Button>}
      </div>
      {open && (
        <ul className="mt-3 grid gap-3">
          {withText.map((i) => (
            <li key={i.id} className="rounded-md bg-secondary/60 p-3 text-sm">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold">{i.clientName}</span><Stars value={i.rating} /></div>
              <p className="mt-1 break-words">{i.comment}</p>
              {i.reply && <p className="mt-2 border-l-2 border-primary pl-2 text-muted-foreground">Resposta da empresa: {i.reply}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StepDate({ value, onPick }: { value: string | null; onPick: (d: string) => void }) {
  // Exibição apenas; o backend valida a janela de 21 dias e datas passadas
  const days = useMemo(() => { const t = todayInBrazil(); return Array.from({ length: 21 }, (_, i) => addDaysIso(t, i)); }, []);
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7" role="group" aria-label="Escolha a data">
      {days.map((d) => (
        <button key={d} type="button" onClick={() => onPick(d)} aria-pressed={value === d}
          className={cn('lift rounded-lg border bg-card p-3 text-center shadow-card active:scale-[0.97]', value === d && 'border-primary bg-primary/10')}>
          <span className="block text-xs text-muted-foreground">{weekdayShort(d)}</span>
          <span className="block font-display text-2xl font-extrabold leading-tight">{d.slice(8)}</span>
          <span className="block text-xs text-muted-foreground">{d.slice(5, 7)}/{d.slice(2, 4)}</span>
        </button>
      ))}
    </div>
  );
}

function StepSlot({ shopId, serviceId, date, onPick }: { shopId: number; serviceId: number; date: string; onPick: (p: { barberId: number; name: string; time: string }) => void }) {
  const r = useAsync(() => api.get<Availability>(`/public/shops/${shopId}/availability?serviceId=${serviceId}&date=${date}`), [shopId, serviceId, date]);
  if (r.error) return <ErrorState message={r.error} onRetry={r.reload} />;
  if (r.loading || !r.data) return <div className="grid gap-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>;
  const withSlots = r.data.professionals.filter((p) => p.slots.length > 0);
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">Horários livres em {formatDate(date)}.</p>
      {!withSlots.length && <EmptyState title="Sem horários livres nesta data" description="Volte e escolha outro dia." />}
      {/* Todos os profissionais do serviço aparecem, com ou sem vaga: dá para comparar a disponibilidade de cada um */}
      {r.data.professionals.map((p) => (
        <Card key={p.barberId} className={cn('p-4', !p.slots.length && 'opacity-75')}>
          <div className="flex items-center gap-3">
            <Avatar name={p.name} photoUrl={p.photoUrl} className="size-12" />
            <div className="min-w-0">
              <p className="font-bold">{p.name}</p>
              <p className="text-sm text-muted-foreground">
                {p.slots.length ? `${p.slots.length} ${p.slots.length === 1 ? 'horário livre' : 'horários livres'}, a partir das ${p.slots[0]}` : 'Sem horários livres nesta data'}
              </p>
              {p.description && <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
            </div>
          </div>
          {p.slots.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {p.slots.map((t) => (
                <Button key={t} variant="outline" size="sm" className="tnum min-w-16" onClick={() => onPick({ barberId: p.barberId, name: p.name, time: t })}>{t}</Button>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function StepConfirm({ shop, service, date, pick, onDone, onTaken }: {
  shop: ShopCard; service: ServiceItem; date: string; pick: { barberId: number; name: string; time: string };
  onDone: () => void; onTaken: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true); setError(null);
    try {
      await api.post('/client/appointments', { shopId: shop.id, serviceId: service.id, barberId: pick.barberId, date, startTime: pick.time });
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'SLOT_TAKEN') onTaken();
      else setError(errorMessage(e));
    } finally { setBusy(false); }
  }

  const rows: Array<[string, string]> = [
    ['Empresa', shop.name], ['Serviço', service.name], ['Profissional', pick.name],
    ['Data', formatDate(date)], ['Horário', pick.time], ['Duração', formatDuration(service.durationMinutes)], ['Valor', brl(service.price)],
  ];
  return (
    <Card className="grid gap-4 p-5">
      <h2 className="text-lg font-bold">Confirme os dados</h2>
      <dl className="grid gap-2 text-sm">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b py-1.5 last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>)}
      </dl>
      {error && <Alert tone="error">{error}</Alert>}
      <Button size="lg" onClick={confirm} loading={busy}>Confirmar agendamento</Button>
    </Card>
  );
}
