import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Field } from '@/components/common/Field';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, PageLoading } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, Textarea } from '@/components/ui/input';
import { useConfirmedAction } from '@/contexts/ConfirmContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Paged<T> { items: T[]; page: number; totalPages: number; total: number }

const ROLE = { CLIENT: 'Cliente', PROFESSIONAL: 'Profissional', MANAGER: 'Gestor' } as const;
const FB_CATEGORY = { SUGGESTION: 'Sugestão', PRAISE: 'Elogio', COMPLAINT: 'Reclamação', BUG: 'Problema no sistema' } as const;
const FB_STATUS = { NEW: 'Novo', READ: 'Lido', ARCHIVED: 'Arquivado' } as const;
const TK_CATEGORY = { ACCOUNT: 'Conta', BOOKING: 'Agendamentos', SHOP: 'Empresa', BUG: 'Erro no sistema', OTHER: 'Outro' } as const;
const TK_STATUS = { OPEN: 'Aberto', IN_PROGRESS: 'Em atendimento', CLOSED: 'Encerrado' } as const;
const TK_TONE = { OPEN: 'info', IN_PROGRESS: 'warning', CLOSED: 'neutral' } as const;
const dt = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const stars = (n: number | null) => (n ? '★'.repeat(n) + '☆'.repeat(5 - n) : '–');

/* ------------------------------------------------------------------ feedbacks */

interface Feedback {
  id: number; category: keyof typeof FB_CATEGORY; rating: number | null; message: string; status: keyof typeof FB_STATUS;
  createdAt: string; userId: number; userName: string; userRole: keyof typeof ROLE;
}

export function FeedbacksPage() {
  const confirm = useConfirmedAction();
  const toast = useToast();
  const [f, setF] = useState({ status: '', category: '' });
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), pageSize: '10' });
  for (const [k, v] of Object.entries(f)) if (v) qs.set(k, v);
  const r = useAsync(() => api.get<Paged<Feedback>>(`/feedbacks?${qs.toString()}`), [qs.toString()]);

  function setStatus(x: Feedback, status: keyof typeof FB_STATUS) {
    confirm(`Marcar o feedback #${x.id} como "${FB_STATUS[status]}"?`, async (adminPassword) => {
      await api.post(`/feedbacks/${x.id}/status`, { adminPassword, status });
      toast.push('success', 'Feedback atualizado.');
    }, r.reload);
  }

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-extrabold">Feedbacks dos usuários</h1>
      <p className="text-sm text-muted-foreground">Sugestões, elogios e problemas enviados por clientes, profissionais e gestores sobre a plataforma.</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:max-w-xl">
        <Select aria-label="Status" value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setPage(1); }}>
          <option value="">Todos os status</option>
          {Object.entries(FB_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select aria-label="Tipo" value={f.category} onChange={(e) => { setF({ ...f, category: e.target.value }); setPage(1); }}>
          <option value="">Todos os tipos</option>
          {Object.entries(FB_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      {r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : r.loading || !r.data ? <PageLoading /> :
        !r.data.items.length ? <EmptyState title="Nenhum feedback" /> : (
          <>
            <ul className="grid gap-3">
              {r.data.items.map((x) => (
                <li key={x.id}>
                  <Card className={cn('grid gap-2 p-4', x.status === 'ARCHIVED' && 'opacity-70')}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm">
                        <Link to={`/users/${x.userId}`} className="font-semibold hover:underline">{x.userName}</Link>
                        <span className="text-muted-foreground"> · {ROLE[x.userRole]} · {dt(x.createdAt)}</span>
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge tone={x.category === 'PRAISE' ? 'success' : x.category === 'SUGGESTION' ? 'info' : 'warning'}>{FB_CATEGORY[x.category]}</Badge>
                        <Badge tone={x.status === 'NEW' ? 'danger' : 'neutral'}>{FB_STATUS[x.status]}</Badge>
                      </div>
                    </div>
                    {x.rating !== null && <p className="text-warning" aria-label={`${x.rating} de 5 estrelas`}>{stars(x.rating)}</p>}
                    <p className="whitespace-pre-wrap break-words text-sm">{x.message}</p>
                    <div className="flex flex-wrap gap-2">
                      {x.status !== 'READ' && <Button size="sm" variant="outline" onClick={() => setStatus(x, 'READ')}>Marcar como lido</Button>}
                      {x.status !== 'ARCHIVED' && <Button size="sm" variant="ghost" onClick={() => setStatus(x, 'ARCHIVED')}>Arquivar</Button>}
                      {x.status !== 'NEW' && <Button size="sm" variant="ghost" onClick={() => setStatus(x, 'NEW')}>Voltar para novo</Button>}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
            <Pagination page={r.data.page} totalPages={r.data.totalPages} onChange={setPage} />
          </>
        )}
    </div>
  );
}

/* -------------------------------------------------------------------- chamados */

interface Ticket {
  id: number; subject: string; category: keyof typeof TK_CATEGORY; status: keyof typeof TK_STATUS; lastMessageAt: string; lastMessageBy: 'USER' | 'ADMIN';
  userId: number; userName: string; userRole: keyof typeof ROLE; shopId: number | null; shopName: string | null;
}

export function TicketsPage() {
  const [f, setF] = useState({ status: '', category: '', waiting: '' });
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), pageSize: '12' });
  for (const [k, v] of Object.entries(f)) if (v) qs.set(k, v);
  const r = useAsync(() => api.get<Paged<Ticket>>(`/tickets?${qs.toString()}`), [qs.toString()]);

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-extrabold">Chamados</h1>
      <div className="grid gap-2 sm:grid-cols-3 lg:max-w-2xl">
        <Select aria-label="Status" value={f.status} onChange={(e) => { setF({ ...f, status: e.target.value }); setPage(1); }}>
          <option value="">Todos os status</option>
          {Object.entries(TK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select aria-label="Categoria" value={f.category} onChange={(e) => { setF({ ...f, category: e.target.value }); setPage(1); }}>
          <option value="">Todas as categorias</option>
          {Object.entries(TK_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select aria-label="Fila" value={f.waiting} onChange={(e) => { setF({ ...f, waiting: e.target.value }); setPage(1); }}>
          <option value="">Todos</option>
          <option value="1">Aguardando a equipe</option>
        </Select>
      </div>
      {r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : r.loading || !r.data ? <PageLoading /> :
        !r.data.items.length ? <EmptyState title="Nenhum chamado" /> : (
          <>
            <ul className="grid gap-3">
              {r.data.items.map((t) => (
                <li key={t.id}>
                  <Card className="lift p-0">
                    <Link to={`/tickets/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="font-bold"><span className="tnum text-muted-foreground">#{t.id}</span> {t.subject}</p>
                        <p className="text-sm text-muted-foreground">{t.userName} · {ROLE[t.userRole]}{t.shopName ? ` · ${t.shopName}` : ''} · {TK_CATEGORY[t.category]} · {dt(t.lastMessageAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.lastMessageBy === 'USER' && t.status !== 'CLOSED' && <Badge tone="danger">Aguardando resposta</Badge>}
                        <Badge tone={TK_TONE[t.status]}>{TK_STATUS[t.status]}</Badge>
                      </div>
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
            <Pagination page={r.data.page} totalPages={r.data.totalPages} onChange={setPage} />
          </>
        )}
    </div>
  );
}

interface TicketFull extends Omit<Ticket, 'lastMessageBy'> {
  createdAt: string; userEmail: string; messages: Array<{ id: number; authorType: 'USER' | 'ADMIN'; body: string; createdAt: string }>;
}

export function TicketDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const confirm = useConfirmedAction();
  const toast = useToast();
  const r = useAsync(() => api.get<TicketFull>(`/tickets/${id}`), [id]);
  const [text, setText] = useState('');

  function reply(e: FormEvent) {
    e.preventDefault();
    if (text.trim().length < 2) return;
    confirm(`Enviar esta resposta ao usuário no chamado #${id}?`, async (adminPassword) => {
      await api.post(`/tickets/${id}/messages`, { adminPassword, message: text });
      setText(''); toast.push('success', 'Resposta enviada. O usuário foi notificado.');
    }, r.reload);
  }
  function status(s: keyof typeof TK_STATUS) {
    confirm(`Alterar o chamado #${id} para "${TK_STATUS[s]}"?`, async (adminPassword) => {
      await api.post(`/tickets/${id}/status`, { adminPassword, status: s });
      toast.push('success', 'Chamado atualizado.');
    }, r.reload);
  }

  if (r.error) return <ErrorState message={r.error} onRetry={r.reload} />;
  if (r.loading && !r.data) return <PageLoading />;
  if (!r.data) return null;
  const t = r.data;
  return (
    <div className="grid gap-4">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => nav('/tickets')}><ArrowLeft className="size-4" aria-hidden /> Chamados</Button>
      <Card className="grid gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold"><span className="tnum text-muted-foreground">#{t.id}</span> {t.subject}</h1>
            <p className="text-sm text-muted-foreground">
              <Link to={`/users/${t.userId}`} className="font-semibold hover:underline">{t.userName}</Link> ({t.userEmail}) · {ROLE[t.userRole]}
              {t.shopId ? <> · <Link to={`/shops/${t.shopId}`} className="hover:underline"><span className="tnum">#{t.shopId}</span> {t.shopName}</Link></> : null}
              {' '}· {TK_CATEGORY[t.category]} · aberto em {dt(t.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={TK_TONE[t.status]}>{TK_STATUS[t.status]}</Badge>
            {t.status === 'CLOSED' ? <Button size="sm" variant="outline" onClick={() => status('OPEN')}>Reabrir</Button>
              : <Button size="sm" variant="outline" onClick={() => status('CLOSED')}>Encerrar</Button>}
          </div>
        </div>
        <ul className="grid gap-3" aria-label="Mensagens">
          {t.messages.map((m) => (
            <li key={m.id} className={cn('max-w-[85%] rounded-lg px-4 py-3 text-sm', m.authorType === 'ADMIN' ? 'justify-self-end bg-primary text-primary-foreground' : 'bg-secondary')}>
              <p className="mb-1 text-xs font-semibold opacity-80">{m.authorType === 'ADMIN' ? 'Equipe' : t.userName} · {dt(m.createdAt)}</p>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
            </li>
          ))}
        </ul>
        {t.status !== 'CLOSED' ? (
          <form onSubmit={reply} className="grid gap-2">
            <Field label="Responder"><Textarea value={text} maxLength={4000} rows={4} onChange={(e) => setText(e.target.value)} /></Field>
            <Button type="submit" className="w-fit" disabled={text.trim().length < 2}>Enviar resposta</Button>
          </form>
        ) : <p className="text-sm text-muted-foreground">Chamado encerrado. Reabra para responder.</p>}
      </Card>
    </div>
  );
}
