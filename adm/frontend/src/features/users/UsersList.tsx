import { Download, Plus, Printer } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, PageLoading } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { useToast } from '@/contexts/ToastContext';
import { useAsync, errorMessage } from '@/hooks/useAsync';
import { api, download } from '@/lib/api';
import { formatDate } from '@/lib/format';

export const ROLE_LABEL: Record<string, string> = { CLIENT: 'Cliente', PROFESSIONAL: 'Profissional', MANAGER: 'Gestor' };
interface Row { id: number; name: string; email: string; role: string; active: boolean; createdAt: string; shops: Array<{ id: number; name: string; as: string }> }
interface Page { items: Row[]; page: number; totalPages: number; total: number }

export function UsersList() {
  const toast = useToast();
  const [flt, setFlt] = useState({ name: '', email: '', role: '', status: '', shopId: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const filters = new URLSearchParams(Object.entries(flt).filter(([, v]) => v !== '')).toString();
  const qs = new URLSearchParams({ page: String(page), pageSize: '10' });
  for (const [k, v] of Object.entries(flt)) if (v) qs.set(k, v);
  const r = useAsync(() => api.get<Page>(`/users?${qs.toString()}`), [qs.toString()]);
  const set = (k: keyof typeof flt) => (e: { target: { value: string } }) => { setFlt((s) => ({ ...s, [k]: e.target.value })); setPage(1); };

  async function exportAs(format: 'csv' | 'doc') {
    try { await download(`/users/export?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(filters)), format }).toString()}`, `usuarios.${format}`); }
    catch (e) { toast.push('error', errorMessage(e)); }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Usuários</h1>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" onClick={() => void exportAs('csv')}><Download className="size-4" /> CSV</Button>
          <Button variant="outline" onClick={() => void exportAs('doc')}><Download className="size-4" /> Word (.doc)</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Imprimir / PDF</Button>
          <Button asChild><Link to="/users/new"><Plus className="size-4" /> Novo usuário</Link></Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground print:hidden">A exportação inclui todos os registros do filtro atual, até 5.000 linhas.</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        <Input placeholder="Nome" aria-label="Nome" value={flt.name} onChange={set('name')} />
        <Input placeholder="E-mail" aria-label="E-mail" value={flt.email} onChange={set('email')} />
        <Select aria-label="Classe" value={flt.role} onChange={set('role')}><option value="">Todas as classes</option><option value="CLIENT">Cliente</option><option value="PROFESSIONAL">Profissional</option><option value="MANAGER">Gestor</option></Select>
        <Select aria-label="Status" value={flt.status} onChange={set('status')}><option value="">Todos os status</option><option value="active">Ativos</option><option value="inactive">Inativos</option></Select>
        <Input placeholder="ID da empresa" aria-label="ID da empresa" inputMode="numeric" value={flt.shopId} onChange={set('shopId')} />
        <Input type="date" aria-label="Cadastrado a partir de" value={flt.from} onChange={set('from')} />
        <Input type="date" aria-label="Cadastrado até" value={flt.to} onChange={set('to')} />
      </div>
      {r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : r.loading || !r.data ? <PageLoading /> :
        !r.data.items.length ? <EmptyState title="Nenhum usuário encontrado" /> : (
          <>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[46rem] text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="p-3">Nome</th><th>E-mail</th><th>Classe</th><th>Empresas</th><th>Status</th><th>Cadastro</th></tr></thead>
                <tbody>
                  {r.data.items.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="p-3"><Link to={`/users/${u.id}`} className="font-semibold hover:underline">{u.name}</Link></td>
                      <td>{u.email}</td><td>{ROLE_LABEL[u.role] ?? u.role}</td>
                      <td>{u.shops.map((s) => s.name).join(', ') || '—'}</td>
                      <td><Badge tone={u.active ? 'success' : 'neutral'}>{u.active ? 'Ativo' : 'Inativo'}</Badge></td>
                      <td>{formatDate(u.createdAt.slice(0, 10))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">{r.data.total} usuário(s)</p>
            <Pagination page={r.data.page} totalPages={r.data.totalPages} onChange={setPage} />
          </>
        )}
    </div>
  );
}
