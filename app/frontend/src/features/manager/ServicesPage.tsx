import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Field } from '@/components/common/Field';
import { Alert, EmptyState, ErrorState, PageLoading } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input, Select, Textarea } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync, errorMessage } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { brl, formatDuration } from '@/lib/format';
import { fieldErrors } from '@/features/auth/AuthShell';

interface Svc { id: number; name: string; description: string | null; durationMinutes: number; priceCents: number; price: number; active: boolean }

export function ServicesPage() {
  const { activeShopId } = useAuth();
  const toast = useToast();
  const list = useAsync(() => api.get<Svc[]>('/manager/services'), [activeShopId]);
  const [editing, setEditing] = useState<Svc | 'new' | null>(null);
  const [removing, setRemoving] = useState<Svc | null>(null);

  async function remove() {
    if (!removing) return;
    try {
      const r = await api.del<{ deleted: boolean }>(`/manager/services/${removing.id}`);
      toast.push('success', r.deleted ? 'Serviço excluído.' : 'Este serviço tem histórico de agendamentos e foi desativado.');
    } catch (e) { toast.push('error', errorMessage(e)); }
    list.reload();
  }
  async function toggle(s: Svc) {
    try { await api.patch(`/manager/services/${s.id}`, { active: !s.active }); list.reload(); }
    catch (e) { toast.push('error', errorMessage(e)); }
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Serviços</h1>
        <Button onClick={() => setEditing('new')}><Plus className="size-4" /> Novo serviço</Button>
      </div>
      {list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.loading || !list.data ? <PageLoading /> :
        !list.data.length ? <EmptyState title="Nenhum serviço cadastrado" /> : (
          <div className="grid gap-3">
            {list.data.map((s) => (
              <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-bold">{s.name} {!s.active && <Badge>Inativo</Badge>}</p>
                  {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                  <p className="text-sm font-semibold">{formatDuration(s.durationMinutes)} · {brl(s.price)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void toggle(s)}>{s.active ? 'Desativar' : 'Ativar'}</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(s)} aria-label={`Editar ${s.name}`}><Pencil className="size-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setRemoving(s)} aria-label={`Excluir ${s.name}`}><Trash2 className="size-4" /></Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      {editing && <ServiceDialog service={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); list.reload(); }} />}
      <ConfirmDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)} destructive confirmLabel="Excluir"
        title={`Excluir ${removing?.name ?? ''}?`}
        description="Se o serviço já tiver agendamentos, ele será apenas desativado para preservar o histórico."
        onConfirm={remove} />
    </div>
  );
}

function ServiceDialog({ service, onClose, onDone }: { service: Svc | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [duration, setDuration] = useState(service?.durationMinutes ?? 30);
  const [price, setPrice] = useState(service ? String(service.price.toFixed(2)) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const cents = Math.round(Number(price.replace(',', '.')) * 100);
    if (!Number.isFinite(cents) || cents < 0) { setErrors({ priceCents: 'Informe um valor válido.' }); return; }
    setBusy(true); setError(null); setErrors({});
    const body = { name, description, durationMinutes: duration, priceCents: cents };
    try {
      if (service) await api.patch(`/manager/services/${service.id}`, body); else await api.post('/manager/services', body);
      toast.push('success', service ? 'Serviço atualizado.' : 'Serviço criado.');
      onDone();
    } catch (err) { setErrors(fieldErrors(err)); setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogTitle>{service ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
        <form onSubmit={submit} className="grid gap-3" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Nome" error={errors.name}><Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Descrição" error={errors.description}><Textarea value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Duração" error={errors.durationMinutes}>
              <Select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {Array.from({ length: 16 }, (_, i) => (i + 1) * 30).map((m) => <option key={m} value={m}>{formatDuration(m)}</option>)}
              </Select>
            </Field>
            <Field label="Preço (R$)" error={errors.priceCents}><Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" required /></Field>
          </div>
          <Button type="submit" loading={busy}>Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
