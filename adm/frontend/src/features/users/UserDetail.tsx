import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Field } from '@/components/common/Field';
import { Alert, ErrorState, PageLoading } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { useConfirmedAction } from '@/contexts/ConfirmContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { ROLE_LABEL } from './UsersList';

interface Sess { id: string; createdAt: string; expiresAt: string; ip: string | null; userAgent: string | null }
interface U { security: { failedLoginAttempts: number; locked: boolean; lockedUntil: string | null; sessions: Sess[] }; id: number; name: string; email: string; phone: string | null; role: string; active: boolean; createdAt: string; lastLoginAt: string | null; mustChangePassword: boolean; shops: Array<{ id: number; name: string; as: string }> }

export function UserDetail() {
  const { id } = useParams();
  const toast = useToast();
  const confirm = useConfirmedAction();
  const r = useAsync(() => api.get<U>(`/users/${id}`), [id]);
  const [f, setF] = useState({ name: '', phone: '', role: 'CLIENT' });
  const [shopId, setShopId] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (r.data) setF({ name: r.data.name, phone: r.data.phone ?? '', role: r.data.role }); }, [r.data]);
  if (r.error) return <ErrorState message={r.error} onRetry={r.reload} />;
  if (r.loading || !r.data) return <PageLoading />;
  const u = r.data;
  const done = (msg: string) => () => { toast.push('success', msg); r.reload(); };

  function save(e: FormEvent) {
    e.preventDefault();
    if (f.name.trim().length < 2) { setErr('Informe o nome.'); return; }
    setErr(null);
    confirm(`Salvar as alterações de ${u.name}?`, (adminPassword) => api.patch(`/users/${u.id}`, {
      adminPassword, name: f.name, ...(f.phone ? { phone: f.phone } : {}), ...(f.role !== u.role ? { role: f.role } : {}),
    }), done('Usuário atualizado.'));
  }
  function addShop(e: FormEvent) {
    e.preventDefault();
    const n = Number(shopId);
    if (!Number.isInteger(n) || n <= 0) { setErr('Informe o ID numérico da empresa.'); return; }
    setErr(null);
    confirm(`Vincular ${u.name} à empresa ${n}?`, (adminPassword) => api.post(`/users/${u.id}/shops`, { adminPassword, shopId: n }), () => { setShopId(''); done('Vínculo criado.')(); });
  }
  function removeShop(s: { id: number; name: string }) {
    confirm(`Remover o vínculo de ${u.name} com ${s.name}?`, (adminPassword) => api.post(`/users/${u.id}/shops/remove`, { adminPassword, shopId: s.id }), done('Vínculo removido.'));
  }
  function reset(e: FormEvent) {
    e.preventDefault();
    if (!resetEmail.includes('@')) { setErr('Digite o e-mail da conta para conferência.'); return; }
    setErr(null);
    confirm(`Redefinir a senha de ${u.name} para a padrão? A troca será exigida no próximo acesso e as sessões serão encerradas.`,
      (adminPassword) => api.post(`/users/${u.id}/reset-password`, { adminPassword, email: resetEmail }), () => { setResetEmail(''); done('Senha redefinida.')(); });
  }
  const revokeSessions = () => confirm(`Encerrar todas as sessões de ${u.name}? Ele(a) terá de entrar de novo.`,
    (adminPassword) => api.post(`/users/${u.id}/revoke-sessions`, { adminPassword }), done('Sessões encerradas.'));
  const unlock = () => confirm(`Desbloquear a conta de ${u.name}?`, (adminPassword) => api.post(`/users/${u.id}/unlock`, { adminPassword }), done('Conta desbloqueada.'));
  function toggle() {
    const next = !u.active;
    confirm(next ? `Reativar ${u.name}?` : `Desativar ${u.name}? Agendamentos futuros serão cancelados e as sessões encerradas.`,
      (adminPassword) => api.post(`/users/${u.id}/status`, { adminPassword, active: next }), done(next ? 'Usuário reativado.' : 'Usuário desativado.'));
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/users" className="text-sm text-muted-foreground hover:underline">← Usuários</Link>
          <h1 className="text-2xl font-extrabold">{u.name}</h1>
          <p className="text-sm text-muted-foreground">{u.email} · cadastro em {formatDate(u.createdAt.slice(0, 10))}{u.lastLoginAt ? ` · último acesso ${formatDate(u.lastLoginAt.slice(0, 10))}` : ''}</p>
          <div className="mt-1 flex gap-2"><Badge tone={u.active ? 'success' : 'neutral'}>{u.active ? 'Ativo' : 'Inativo'}</Badge><Badge>{ROLE_LABEL[u.role] ?? u.role}</Badge>{u.mustChangePassword && <Badge tone="warning">Troca de senha pendente</Badge>}</div>
        </div>
        <Button variant={u.active ? 'outline' : 'default'} onClick={toggle}>{u.active ? 'Desativar' : 'Reativar'}</Button>
      </div>
      {err && <Alert tone="error">{err}</Alert>}
      <form onSubmit={save} noValidate>
        <Card>
          <CardHeader><CardTitle>Dados</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Nome"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Telefone"><Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Classe"><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="CLIENT">Cliente</option><option value="PROFESSIONAL">Profissional</option><option value="MANAGER">Gestor</option></Select></Field>
            <div className="sm:col-span-3"><Button type="submit">Salvar alterações</Button></div>
          </CardContent>
        </Card>
      </form>
      <Card>
        <CardHeader><CardTitle>Empresas vinculadas</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {!u.shops.length ? <p className="text-sm text-muted-foreground">Nenhum vínculo ativo.</p> : (
            <ul className="grid gap-2">
              {u.shops.map((s) => (
                <li key={`${s.id}-${s.as}`} className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
                  <span><Link to={`/shops/${s.id}`} className="font-semibold hover:underline">{s.name}</Link> · {s.as === 'MANAGER' ? 'Gestor' : 'Profissional'}</span>
                  <Button size="sm" variant="outline" onClick={() => removeShop(s)}>Remover</Button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addShop} className="flex flex-wrap items-end gap-2" noValidate>
            <Field label="ID da empresa"><Input inputMode="numeric" value={shopId} onChange={(e) => setShopId(e.target.value)} /></Field>
            <Button type="submit" variant="outline">Vincular</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Segurança da conta</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={u.security.locked ? 'danger' : 'success'}>{u.security.locked ? `Bloqueada até ${new Date(u.security.lockedUntil ?? '').toLocaleTimeString('pt-BR', { timeStyle: 'short' })}` : 'Sem bloqueio'}</Badge>
            <span className="text-muted-foreground">{u.security.failedLoginAttempts} senha(s) errada(s) seguidas</span>
            {u.security.locked && <Button size="sm" variant="outline" onClick={unlock}>Desbloquear</Button>}
          </div>
          {!u.security.sessions.length ? <p className="text-muted-foreground">Nenhuma sessão ativa.</p> : (
            <ul className="grid gap-1">
              {u.security.sessions.map((x) => (
                <li key={x.id} className="rounded-md border p-2"><span className="font-medium">{x.userAgent ?? 'Navegador desconhecido'}</span><span className="block text-muted-foreground">IP {x.ip ?? '—'} · iniciada {new Date(x.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span></li>
              ))}
            </ul>
          )}
          <div><Button size="sm" variant="outline" disabled={!u.security.sessions.length} onClick={revokeSessions}>Encerrar todas as sessões</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Redefinir senha</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={reset} className="flex flex-wrap items-end gap-2" noValidate>
            <Field label="E-mail da conta (conferência)"><Input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} /></Field>
            <Button type="submit" variant="outline">Redefinir para a senha padrão</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
