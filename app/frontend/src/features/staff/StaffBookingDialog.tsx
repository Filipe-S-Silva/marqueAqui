import { CalendarPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Avatar } from '@/components/common/Avatar';
import { Field } from '@/components/common/Field';
import { Alert } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage } from '@/hooks/useAsync';
import { ApiError, api } from '@/lib/api';
import { addDaysIso, brl, formatDate, todayInBrazil } from '@/lib/format';
import type { Availability, ServiceItem, ShopServices } from '@/features/client/types';

interface Lookup { id: number; name: string; photoUrl: string | null; phoneMasked: string; memberSince: string; previousAppointments: number }
interface Props {
  shopId: number;
  /** Profissional: a própria agenda. Gestor: lista para escolher. */
  barbers: Array<{ barberId: number; name: string }>;
  initialDate: string;
  onCreated: () => void;
}

export function StaffBookingDialog({ shopId, barbers, initialDate, onCreated }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [barberId, setBarberId] = useState<number | ''>(barbers.length === 1 ? barbers[0]!.barberId : '');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [serviceId, setServiceId] = useState<number | ''>('');
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<string[]>([]);
  const [time, setTime] = useState('');
  const [type, setType] = useState<'WALK_IN' | 'REGISTERED'>('WALK_IN');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [found, setFound] = useState<Lookup | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) setDate(initialDate); }, [open, initialDate]);
  useEffect(() => {
    if (!open) return;
    api.get<ShopServices>(`/public/shops/${shopId}/services`).then((r) => setServices(r.services)).catch(() => setServices([]));
  }, [open, shopId]);

  const barberServices = useMemo(
    () => services.filter((s) => barberId !== '' && s.professionals.some((p) => p.id === barberId)),
    [services, barberId],
  );
  const service = barberServices.find((s) => s.id === serviceId);

  useEffect(() => {
    setTime(''); setSlots([]);
    if (!open || !service || barberId === '' || !date) return;
    let alive = true;
    api.get<Availability>(`/public/shops/${shopId}/availability?serviceId=${service.id}&date=${date}`)
      .then((r) => { if (alive) setSlots(r.professionals.find((p) => p.barberId === barberId)?.slots ?? []); })
      .catch((e) => { if (alive) setError(errorMessage(e)); });
    return () => { alive = false; };
  }, [open, service, barberId, date, shopId]);

  async function lookup() {
    setError(null); setFound(null); setConfirmed(false);
    try { setFound(await api.get<Lookup>(`/staff/clients/lookup?email=${encodeURIComponent(email.trim())}`)); }
    catch (e) { setError(errorMessage(e)); }
  }

  async function submit() {
    setBusy(true); setError(null);
    try {
      await api.post('/staff/appointments', {
        serviceId, date, startTime: time, ...(barberId !== '' ? { barberId } : {}),
        client: type === 'WALK_IN' ? { type, name, phone } : { type, email: email.trim(), confirmed: true },
      });
      toast.push('success', 'Agendamento criado.');
      setOpen(false); setName(''); setPhone(''); setEmail(''); setFound(null); setConfirmed(false); setServiceId('');
      onCreated();
    } catch (e) {
      setError(errorMessage(e));
      if (e instanceof ApiError && e.code === 'SLOT_TAKEN') setTime('');
    } finally { setBusy(false); }
  }

  const clientReady = type === 'WALK_IN' ? name.trim().length >= 2 && phone.trim().length >= 8 : found !== null && confirmed;
  const ready = barberId !== '' && serviceId !== '' && time !== '' && clientReady;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><CalendarPlus className="size-4" /> Agendar cliente</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogTitle>Agendar cliente</DialogTitle>
        <DialogDescription>Cliente avulso ou já cadastrado.</DialogDescription>
        {error && <Alert tone="error">{error}</Alert>}

        {barbers.length > 1 && (
          <Field label="Profissional">
            <Select value={barberId} onChange={(e) => { setBarberId(e.target.value ? Number(e.target.value) : ''); setServiceId(''); }}>
              <option value="">Selecione…</option>
              {barbers.map((b) => <option key={b.barberId} value={b.barberId}>{b.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Serviço">
          <Select value={serviceId} disabled={barberId === ''} onChange={(e) => setServiceId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Selecione…</option>
            {barberServices.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.durationMinutes} min · {brl(s.price)}</option>)}
          </Select>
        </Field>
        <Field label="Data">
          <Input type="date" value={date} min={todayInBrazil()} max={addDaysIso(todayInBrazil(), 20)} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Horário" hint={service && !slots.length ? 'Sem horários livres nesta data.' : undefined}>
          <Select value={time} disabled={!slots.length} onChange={(e) => setTime(e.target.value)}>
            <option value="">Selecione…</option>
            {slots.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>

        <div role="tablist" aria-label="Tipo de cliente" className="flex gap-2">
          <Button role="tab" aria-selected={type === 'WALK_IN'} size="sm" variant={type === 'WALK_IN' ? 'default' : 'outline'} onClick={() => setType('WALK_IN')}>Cliente avulso</Button>
          <Button role="tab" aria-selected={type === 'REGISTERED'} size="sm" variant={type === 'REGISTERED' ? 'default' : 'outline'} onClick={() => setType('REGISTERED')}>Cliente cadastrado</Button>
        </div>

        {type === 'WALK_IN' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome"><Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Telefone"><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="flex items-end gap-2">
              <div className="flex-1"><Field label="E-mail do cliente"><Input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setFound(null); setConfirmed(false); }} /></Field></div>
              <Button variant="outline" onClick={lookup} disabled={!email.includes('@')}>Buscar</Button>
            </div>
            {found && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex items-center gap-3">
                  <Avatar name={found.name} photoUrl={null} className="size-12" />
                  <div>
                    <p className="font-bold">{found.name}</p>
                    <p className="text-muted-foreground">Tel.: {found.phoneMasked || 'não informado'}</p>
                    <p className="text-muted-foreground">Cliente desde {formatDate(found.memberSince.slice(0, 10))} · {found.previousAppointments} atendimento(s) anteriores</p>
                  </div>
                </div>
                <label className="mt-3 flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="size-4 accent-[var(--primary)]" />
                  Confirmo que é este cliente.
                </label>
              </div>
            )}
          </div>
        )}
        <Button onClick={submit} loading={busy} disabled={!ready}>Criar agendamento</Button>
      </DialogContent>
    </Dialog>
  );
}
