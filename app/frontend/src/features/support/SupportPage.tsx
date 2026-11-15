import { ArrowLeft, LifeBuoy, MessageSquarePlus, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Field } from '@/components/common/Field';
import { Pagination } from '@/components/common/Pagination';
import { Rise } from '@/components/common/motion';
import { Alert, EmptyState, ErrorState } from '@/components/common/states';
import { StarPicker } from '@/components/common/Stars';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, Textarea, Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage, useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Paged } from '@/features/client/types';
import { fieldErrors } from '@/features/auth/AuthShell';
import {
  FEEDBACK_CATEGORY_LABEL, TICKET_CATEGORY_LABEL, TICKET_STATUS_LABEL, TICKET_STATUS_TONE, formatDateTime,
  type FeedbackCategory, type TicketCategory, type TicketStatus,
} from './labels';

interface TicketRow { id: number; subject: string; category: TicketCategory; status: TicketStatus; lastMessageAt: string; lastMessageBy: 'USER' | 'ADMIN' }
interface TicketDetail { id: number; subject: string; category: TicketCategory; status: TicketStatus; createdAt: string; messages: Array<{ id: number; authorType: 'USER' | 'ADMIN'; body: string; createdAt: string }> }

type View = { name: 'list' } | { name: 'new' } | { name: 'ticket'; id: number } | { name: 'feedback' };

/** Suporte: chamados com a equipe da plataforma e feedback sobre o sistema. Usado por cliente, profissional e gestor. */
export function SupportPage() {
  const [view, setView] = useState<View>({ name: 'list' });
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Suporte</h1>
        {view.name === 'list' && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setView({ name: 'feedback' })}><MessageSquarePlus className="size-4" aria-hidden /> Enviar feedback</Button>
            <Button onClick={() => setView({ name: 'new' })}><LifeBuoy className="size-4" aria-hidden /> Abrir chamado</Button>
          </div>
        )}
      </div>
      {view.name === 'list' && <TicketList onOpen={(id) => setView({ name: 'ticket', id })} />}
      {view.name === 'new' && <NewTicket onDone={(id) => setView({ name: 'ticket', id })} onBack={() => setView({ name: 'list' })} />}
      {view.name === 'ticket' && <TicketView id={view.id} onBack={() => setView({ name: 'list' })} />}
      {view.name === 'feedback' && <FeedbackForm onBack={() => setView({ name: 'list' })} />}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return <Button variant="ghost" size="sm" className="w-fit" onClick={onClick}><ArrowLeft className="size-4" aria-hidden /> Voltar aos chamados</Button>;
}

function TicketList({ onOpen }: { onOpen: (id: number) => void }) {
  const [page, setPage] = useState(1);
  const r = useAsync(() => api.get<Paged<TicketRow>>(`/tickets?page=${page}&pageSize=8`), [page]);
  if (r.error) return <ErrorState message={r.error} onRetry={r.reload} />;
  if (r.loading || !r.data) return <div className="grid gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  if (!r.data.items.length) return <EmptyState title="Nenhum chamado aberto" description="Precisa de ajuda com a plataforma? Abra um chamado e a equipe responde por aqui." />;
  return (
    <>
      <ul className="grid gap-3">
        {r.data.items.map((t, i) => (
          <Rise as="li" key={t.id} index={i}>
            <Card className="lift p-0">
              <button type="button" onClick={() => onOpen(t.id)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left">
                <div className="min-w-0">
                  <p className="font-bold">{t.subject}</p>
                  <p className="text-sm text-muted-foreground">{TICKET_CATEGORY_LABEL[t.category]} · atualizado em {formatDateTime(t.lastMessageAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {t.lastMessageBy === 'ADMIN' && t.status !== 'CLOSED' && <Badge tone="success">Nova resposta</Badge>}
                  <Badge tone={TICKET_STATUS_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Badge>
                </div>
              </button>
            </Card>
          </Rise>
        ))}
      </ul>
      <Pagination page={r.data.page} totalPages={r.data.totalPages} onChange={setPage} />
    </>
  );
}

function NewTicket({ onDone, onBack }: { onDone: (id: number) => void; onBack: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ subject: '', category: 'OTHER' as TicketCategory, message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setErrors({});
    try {
      const r = await api.post<{ id: number }>('/tickets', f);
      toast.push('success', 'Chamado aberto. Você será avisado quando a equipe responder.');
      onDone(r.id);
    } catch (err) { setErrors(fieldErrors(err)); setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4">
      <BackButton onClick={onBack} />
      <Card className="max-w-2xl p-5">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <h2 className="text-lg font-bold">Abrir chamado</h2>
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Assunto" error={errors.subject}><Input value={f.subject} maxLength={150} onChange={(e) => setF({ ...f, subject: e.target.value })} required /></Field>
          <Field label="Categoria" error={errors.category}>
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as TicketCategory })}>
              {Object.entries(TICKET_CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field label="Descreva o problema" error={errors.message} hint="Conte o que aconteceu e o que você esperava. Não envie senhas.">
            <Textarea value={f.message} maxLength={4000} className="min-h-36" onChange={(e) => setF({ ...f, message: e.target.value })} required />
          </Field>
          <Button type="submit" loading={busy} className="w-fit">Abrir chamado</Button>
        </form>
      </Card>
    </div>
  );
}

function TicketView({ id, onBack }: { id: number; onBack: () => void }) {
  const toast = useToast();
  const r = useAsync(() => api.get<TicketDetail>(`/tickets/${id}`), [id]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await api.post(`/tickets/${id}/messages`, { message: text }); setText(''); r.reload(); }
    catch (err) { toast.push('error', errorMessage(err)); } finally { setBusy(false); }
  }
  async function close() {
    try { await api.post(`/tickets/${id}/close`); toast.push('success', 'Chamado encerrado.'); r.reload(); }
    catch (err) { toast.push('error', errorMessage(err)); }
  }

  if (r.error) return <div className="grid gap-4"><BackButton onClick={onBack} /><ErrorState message={r.error} onRetry={r.reload} /></div>;
  if (r.loading && !r.data) return <Skeleton className="h-64" />;
  if (!r.data) return null;
  const t = r.data;
  return (
    <div className="grid gap-4">
      <BackButton onClick={onBack} />
      <Card className="grid gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{t.subject}</h2>
            <p className="text-sm text-muted-foreground">{TICKET_CATEGORY_LABEL[t.category]} · aberto em {formatDateTime(t.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={TICKET_STATUS_TONE[t.status]}>{TICKET_STATUS_LABEL[t.status]}</Badge>
            {t.status !== 'CLOSED' && <Button size="sm" variant="outline" onClick={() => setConfirmClose(true)}>Encerrar</Button>}
          </div>
        </div>
        <ul className="grid gap-3" aria-label="Mensagens do chamado">
          {t.messages.map((m) => (
            <li key={m.id} className={cn('max-w-[85%] rounded-lg px-4 py-3 text-sm', m.authorType === 'USER' ? 'justify-self-end bg-primary text-primary-foreground' : 'bg-secondary')}>
              <p className="mb-1 text-xs font-semibold opacity-80">{m.authorType === 'USER' ? 'Você' : 'Equipe EasyService'} · {formatDateTime(m.createdAt)}</p>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
            </li>
          ))}
        </ul>
        {t.status !== 'CLOSED' ? (
          <form onSubmit={send} className="grid gap-2">
            <Field label="Responder"><Textarea value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} required /></Field>
            <Button type="submit" loading={busy} disabled={text.trim().length < 2} className="w-fit"><Send className="size-4" aria-hidden /> Enviar</Button>
          </form>
        ) : <p className="text-sm text-muted-foreground">Este chamado está encerrado. Se precisar de mais ajuda, abra um novo chamado.</p>}
      </Card>
      <ConfirmDialog open={confirmClose} onOpenChange={setConfirmClose} confirmLabel="Encerrar chamado" title="Encerrar este chamado?"
        description="Depois de encerrado não é possível enviar novas mensagens." onConfirm={close} />
    </div>
  );
}

function FeedbackForm({ onBack }: { onBack: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ category: 'SUGGESTION' as FeedbackCategory, rating: 0, message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setErrors({});
    try {
      await api.post('/feedback', { category: f.category, message: f.message, ...(f.rating ? { rating: f.rating } : {}) });
      toast.push('success', 'Feedback enviado. Obrigado por ajudar a melhorar a plataforma!');
      onBack();
    } catch (err) { setErrors(fieldErrors(err)); setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4">
      <BackButton onClick={onBack} />
      <Card className="max-w-2xl p-5">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div>
            <h2 className="text-lg font-bold">Enviar feedback à equipe</h2>
            <p className="text-sm text-muted-foreground">Sugestões, elogios e problemas sobre o EasyService&Cia. Para pedir ajuda com um caso específico, abra um chamado.</p>
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Tipo" error={errors.category}>
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as FeedbackCategory })}>
              {Object.entries(FEEDBACK_CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Como você avalia a plataforma? (opcional)</span>
            <StarPicker value={f.rating} onChange={(n) => setF({ ...f, rating: f.rating === n ? 0 : n })} label="Nota da plataforma" />
          </div>
          <Field label="Sua mensagem" error={errors.message} hint="Mínimo de 10 caracteres.">
            <Textarea value={f.message} maxLength={2000} className="min-h-32" onChange={(e) => setF({ ...f, message: e.target.value })} required />
          </Field>
          <Button type="submit" loading={busy} className="w-fit">Enviar feedback</Button>
        </form>
      </Card>
    </div>
  );
}
