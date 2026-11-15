import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ShopAvatar } from '@/components/common/Logo';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, PageLoading } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { useConfirmedAction } from '@/contexts/ConfirmContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';

interface Row { id: number; name: string; logoUrl: string | null; active: boolean; professionals: number; managers: number }
interface Page { items: Row[]; page: number; totalPages: number; total: number }

export function ShopsList() {
  const toast = useToast();
  const confirm = useConfirmedAction();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const qs = new URLSearchParams({ page: String(page), pageSize: '10', ...(q ? { q } : {}), ...(status ? { status } : {}) }).toString();
  const r = useAsync(() => api.get<Page>(`/shops?${qs}`), [qs]);

  function toggle(s: Row) {
    const next = !s.active;
    confirm(next ? `Reativar ${s.name}?` : `Desativar ${s.name}? Todos os agendamentos futuros serão cancelados e clientes, gestores e profissionais serão avisados.`,
      (adminPassword) => api.post(`/shops/${s.id}/status`, { adminPassword, active: next }),
      () => { toast.push('success', next ? 'Empresa reativada.' : 'Empresa desativada.'); r.reload(); });
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Empresas</h1>
        <Button asChild><Link to="/shops/new"><Plus className="size-4" /> Nova empresa</Link></Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input placeholder="Buscar pelo nome ou ID" aria-label="Buscar empresa" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Todos os status</option><option value="active">Ativas</option><option value="inactive">Inativas</option>
        </Select>
      </div>
      {r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : r.loading || !r.data ? <PageLoading /> :
        !r.data.items.length ? <EmptyState title="Nenhuma empresa encontrada" /> : (
          <>
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full min-w-[44rem] text-sm">
                <thead><tr className="border-b text-left text-muted-foreground">
                  <th className="p-3">ID</th><th>Empresa</th><th>Status</th><th>Prof.</th><th>Gest.</th><th /></tr></thead>
                <tbody>
                  {r.data.items.map((s) => {
                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="p-3 tnum text-muted-foreground">#{s.id}</td>
                        <td className="p-3"><Link to={`/shops/${s.id}`} className="flex items-center gap-3 font-semibold hover:underline"><ShopAvatar name={s.name} logoUrl={s.logoUrl} className="size-9 text-xs" />{s.name}</Link></td>
                        <td><Badge tone={s.active ? 'success' : 'neutral'}>{s.active ? 'Ativa' : 'Inativa'}</Badge></td>
                        <td>{s.professionals}</td><td>{s.managers}</td>
                        <td className="pr-3 text-right"><Button size="sm" variant={s.active ? 'outline' : 'default'} onClick={() => toggle(s)}>{s.active ? 'Desativar' : 'Reativar'}</Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={r.data.page} totalPages={r.data.totalPages} onChange={setPage} />
          </>
        )}
    </div>
  );
}
