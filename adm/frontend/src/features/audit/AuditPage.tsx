import { useState } from 'react';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, PageLoading } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/input';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';

interface Row { id: number; type: string; action: string; adminId: number | null; adminName: string | null; targetType: string | null; targetId: string | null; metadata: Record<string, unknown> | null; ip: string | null; createdAt: string }
interface AdminOpt { id: number; name: string }
const TYPE_LABEL: Record<string, string> = { AUTH: 'Entradas', SECURITY: 'Segurança', USER: 'Usuários', SHOP: 'Empresas', SUPPORT: 'Chamados e feedbacks', ANNOUNCEMENT: 'Comunicados', ADMIN: 'Administradores' };
const TYPE_TONE: Record<string, 'neutral' | 'danger' | 'info' | 'success' | 'warning'> = { SECURITY: 'danger', AUTH: 'info', SUPPORT: 'warning', ANNOUNCEMENT: 'success' };
interface Page { items: Row[]; page: number; totalPages: number; total: number }

export function AuditPage() {
  const [f, setF] = useState({ type: '', adminId: '', action: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), pageSize: '20' });
  for (const [k, v] of Object.entries(f)) if (v) qs.set(k, v);
  const r = useAsync(() => api.get<Page>(`/audit?${qs.toString()}`), [qs.toString()]);
  const admins = useAsync(() => api.get<AdminOpt[]>('/admins'), []);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF((s) => ({ ...s, [k]: e.target.value })); setPage(1); };

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-extrabold">Auditoria</h1>
      <p className="text-sm text-muted-foreground">Ações do painel (usuários, empresas, chamados, comunicados, administradores), entradas e eventos de segurança. Senhas, tokens, códigos e textos de mensagens nunca são gravados.</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Select aria-label="Tipo" value={f.type} onChange={set('type')}>
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select aria-label="Administrador" value={f.adminId} onChange={set('adminId')}>
          <option value="">Todos os administradores</option>
          {(admins.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Input placeholder="Ação (ex.: user.)" aria-label="Ação" value={f.action} onChange={set('action')} />
        <Input type="date" aria-label="De" value={f.from} onChange={set('from')} />
        <Input type="date" aria-label="Até" value={f.to} onChange={set('to')} />
      </div>
      {r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : r.loading || !r.data ? <PageLoading /> :
        !r.data.items.length ? <EmptyState title="Nenhum registro" /> : (
          <>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[48rem] text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Quando</th><th>Tipo</th><th>Administrador</th><th>Ação</th><th>Alvo</th><th>IP</th></tr></thead>
                <tbody>
                  {r.data.items.map((x) => (
                    <tr key={x.id} className="border-b align-top last:border-0">
                      <td className="p-3 whitespace-nowrap">{new Date(x.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}</td>
                      <td><Badge tone={TYPE_TONE[x.type] ?? 'neutral'}>{TYPE_LABEL[x.type] ?? x.type}</Badge></td>
                      <td>{x.adminName ?? '—'}</td>
                      <td className="font-mono text-xs">{x.action}{x.metadata ? <span className="block text-muted-foreground">{JSON.stringify(x.metadata)}</span> : null}</td>
                      <td>{x.targetType ? `${x.targetType} ${x.targetId ?? ''}` : '—'}</td>
                      <td>{x.ip ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">{r.data.total} registro(s)</p>
            <Pagination page={r.data.page} totalPages={r.data.totalPages} onChange={setPage} />
          </>
        )}
    </div>
  );
}
