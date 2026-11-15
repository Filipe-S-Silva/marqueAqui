import { Plus, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Avatar } from '@/components/common/Avatar';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Field } from '@/components/common/Field';
import { Alert, EmptyState, ErrorState, PageLoading } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync, errorMessage } from '@/hooks/useAsync';
import { api, download } from '@/lib/api';
import { brl } from '@/lib/format';
import { fieldErrors } from '@/features/auth/AuthShell';

interface Member {
  barberId: number; userId: number; name: string; email: string; phone: string | null; photoUrl?: string | null; active: boolean;
  serviceIds: number[]; workingHours: Array<{ weekday: number; startTime: string; endTime: string }>;
}
interface Svc { id: number; name: string; price: number; active: boolean }
const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export function TeamPage() {
  const { activeShopId, user } = useAuth();
  const toast = useToast();
  const team = useAsync(() => api.get<Member[]>('/manager/team'), [activeShopId]);
  const svcs = useAsync(() => api.get<Svc[]>('/manager/services'), [activeShopId]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [deactivating, setDeactivating] = useState<Member | null>(null);
  const [leaving, setLeaving] = useState<number | null>(null); // nº de agendamentos futuros afetados
  const meInTeam = team.data?.some((m) => m.userId === user?.id && m.active);

  async function enableSelf() {
    try { await api.post('/manager/me/professional'); toast.push('success', 'Você agora também atende nesta empresa. Defina seus serviços.'); team.reload(); }
    catch (e) { toast.push('error', errorMessage(e)); }
  }
  async function askLeave() {
    try { const r = await api.get<{ affected: number }>('/manager/me/professional/impact'); setLeaving(r.affected); }
    catch (e) { toast.push('error', errorMessage(e)); }
  }
  async function leave() {
    try {
      const r = await api.post<{ cancelledAppointments: number }>('/manager/me/professional/disable');
      toast.push('success', `Você deixou de atender. ${r.cancelledAppointments} agendamento(s) cancelado(s).`);
    } catch (e) { toast.push('error', errorMessage(e)); }
    team.reload();
  }
  async function reactivate(m: Member) {
    try { await api.post(`/manager/team/${m.barberId}/reactivate`); toast.push('success', 'Profissional reativado.'); team.reload(); }
    catch (e) { toast.push('error', errorMessage(e)); }
  }
  async function deactivate() {
    if (!deactivating) return;
    try {
      const r = await api.post<{ cancelledAppointments: number }>(`/manager/team/${deactivating.barberId}/deactivate`);
      toast.push('success', `Profissional desativado. ${r.cancelledAppointments} agendamento(s) cancelado(s).`);
      if (r.cancelledAppointments > 0) await download(`/manager/team/${deactivating.barberId}/affected.doc`, `clientes-afetados-${deactivating.name}.doc`);
    } catch (e) { toast.push('error', errorMessage(e)); }
    team.reload();
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Equipe</h1>
        <div className="flex gap-2">
          {team.data && !meInTeam && <Button variant="outline" onClick={() => void enableSelf()}>Atender também</Button>}
          {team.data && meInTeam && <Button variant="outline" onClick={() => void askLeave()}>Deixar de atender</Button>}
          <Button onClick={() => setAdding(true)}><UserPlus className="size-4" /> Adicionar profissional</Button>
        </div>
      </div>
      {team.error ? <ErrorState message={team.error} onRetry={team.reload} /> : team.loading || !team.data ? <PageLoading /> :
        !team.data.length ? <EmptyState title="Nenhum profissional ainda" /> : (
          <div className="grid gap-3">
            {team.data.map((m) => (
              <Card key={m.barberId} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3"><Avatar name={m.name} photoUrl={m.photoUrl} className="size-12" /><div>
                  <p className="font-bold">{m.name} {!m.active && <Badge tone="neutral">Inativo</Badge>}</p>
                  <p className="text-sm text-muted-foreground">{m.email}{m.phone ? ` · ${m.phone}` : ''}</p>
                  <p className="text-xs text-muted-foreground">{m.serviceIds.length} serviço(s)</p>
                  </div></div>
                </div>
                <div className="flex gap-2">
                  {m.active ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setEditing(m)}>Serviços e expediente</Button>
                      {m.userId !== user?.id && <Button size="sm" variant="outline" onClick={() => setDeactivating(m)}><UserMinus className="size-4" /> Desativar</Button>}
                    </>
                  ) : <Button size="sm" onClick={() => void reactivate(m)}>Reativar</Button>}
                </div>
              </Card>
            ))}
          </div>
        )}

      {adding && <AddDialog services={(svcs.data ?? []).filter((s) => s.active)} onClose={() => setAdding(false)} onDone={() => { setAdding(false); team.reload(); }} />}
      {editing && <EditDialog member={editing} services={(svcs.data ?? []).filter((s) => s.active)} onClose={() => setEditing(null)} onDone={() => { setEditing(null); team.reload(); }} />}
      <ConfirmDialog open={leaving !== null} onOpenChange={(o) => !o && setLeaving(null)} destructive confirmLabel="Deixar de atender"
        title="Deixar de atender nesta empresa?"
        description={leaving ? `Seus ${leaving} agendamento(s) futuro(s) serão cancelados e os clientes avisados. Você continua como gestor e pode voltar a atender quando quiser em "Atender também".` : 'Você continua como gestor e pode voltar a atender quando quiser em "Atender também". Não há agendamentos futuros seus para cancelar.'}
        onConfirm={leave} />
      <ConfirmDialog open={deactivating !== null} onOpenChange={(o) => !o && setDeactivating(null)} destructive confirmLabel="Desativar"
        title={`Desativar ${deactivating?.name ?? ''}?`}
        description="Os agendamentos futuros deste profissional serão cancelados, os clientes serão avisados e um documento .doc com os clientes afetados será baixado. O histórico é mantido."
        onConfirm={deactivate} />
    </div>
  );
}

function AddDialog({ services, onClose, onDone }: { services: Svc[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', phone: '' });
  const [ids, setIds] = useState<number[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = (id: number) => setIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setErrors({});
    try {
      const r = await api.post<{ linkedExisting: boolean }>('/manager/team', { ...(f.name ? { name: f.name } : {}), email: f.email, ...(f.phone ? { phone: f.phone } : {}), serviceIds: ids });
      toast.push('success', r.linkedExisting
        ? 'Profissional já cadastrado vinculado à sua empresa. Ele continua com o mesmo login e agora vê as duas empresas.'
        : 'Profissional adicionado. Expediente padrão: segunda a sexta, 09:00–18:00. A senha inicial é a padrão da plataforma e será trocada no primeiro acesso.');
      onDone();
    } catch (err) { setErrors(fieldErrors(err)); setError(errorMessage(err)); } finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>Adicionar profissional</DialogTitle>
        <DialogDescription>Informe o e-mail. Se o profissional já tem cadastro (inclusive em outra empresa), ele é só vinculado à sua empresa e o nome pode ficar em branco. Sem cadastro, uma conta nova é criada com a senha inicial padrão, trocada no primeiro acesso.</DialogDescription>
        <form onSubmit={submit} className="grid gap-3" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="E-mail" error={errors.email}><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
          <Field label="Nome (só para quem ainda não tem cadastro)" error={errors.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Telefone" error={errors.phone}><Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <fieldset className="grid gap-2"><legend className="text-sm font-medium">Serviços que realiza</legend>
            {services.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={ids.includes(s.id)} onChange={() => toggle(s.id)} /> {s.name} <span className="text-muted-foreground">{brl(s.price)}</span></label>
            ))}
            {!services.length && <p className="text-xs text-muted-foreground">Cadastre serviços primeiro.</p>}
          </fieldset>
          <Button type="submit" loading={busy}>Adicionar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ member, services, onClose, onDone }: { member: Member; services: Svc[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [ids, setIds] = useState<number[]>(member.serviceIds);
  const [hours, setHours] = useState(member.workingHours);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = (id: number) => setIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const addHour = (weekday: number) => setHours((h) => [...h, { weekday, startTime: '09:00', endTime: '18:00' }]);
  const setHour = (i: number, k: 'startTime' | 'endTime', v: string) => setHours((h) => h.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  async function save() {
    setBusy(true); setError(null);
    try {
      await api.put(`/manager/team/${member.barberId}/services`, { serviceIds: ids });
      await api.put(`/manager/team/${member.barberId}/working-hours`, { hours });
      toast.push('success', 'Alterações salvas.');
      onDone();
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogTitle>{member.name}</DialogTitle>
        <DialogDescription>Serviços e expediente por dia da semana (múltiplos intervalos permitidos, em múltiplos de 30 min).</DialogDescription>
        {error && <Alert tone="error">{error}</Alert>}
        <fieldset className="grid gap-2"><legend className="text-sm font-semibold">Serviços</legend>
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-[var(--primary)]" checked={ids.includes(s.id)} onChange={() => toggle(s.id)} /> {s.name}</label>
          ))}
        </fieldset>
        <div className="grid gap-3">
          <p className="text-sm font-semibold">Expediente</p>
          {DAYS.map((label, wd) => (
            <div key={wd} className="grid gap-1 rounded-md border p-2">
              <div className="flex items-center justify-between"><span className="text-sm font-medium">{label}</span>
                <Button size="sm" variant="ghost" onClick={() => addHour(wd)}><Plus className="size-4" /> Intervalo</Button></div>
              {hours.map((h, i) => h.weekday !== wd ? null : (
                <div key={i} className="flex items-center gap-2">
                  <Input type="time" step={1800} aria-label={`${label} início`} value={h.startTime} onChange={(e) => setHour(i, 'startTime', e.target.value)} />
                  <span>às</span>
                  <Input type="time" step={1800} aria-label={`${label} fim`} value={h.endTime} onChange={(e) => setHour(i, 'endTime', e.target.value)} />
                  <Button size="icon" variant="ghost" aria-label="Remover intervalo" onClick={() => setHours((l) => l.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                </div>
              ))}
            </div>
          ))}
        </div>
        <Button onClick={save} loading={busy}>Salvar</Button>
      </DialogContent>
    </Dialog>
  );
}

