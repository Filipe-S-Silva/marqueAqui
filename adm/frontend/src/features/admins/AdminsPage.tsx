import { useState, type FormEvent } from 'react';
import { Field } from '@/components/common/Field';
import { Alert, EmptyState, ErrorState, PageLoading } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmedAction } from '@/contexts/ConfirmContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/format';

interface A { id: number; name: string; active: boolean; lastLoginAt: string | null; createdAt: string; locked: boolean; mustChangePassword: boolean; activeSessions: number; twoFactorEnabled: boolean }

export function AdminsPage() {
  const toast = useToast();
  const confirm = useConfirmedAction();
  const { admin } = useAuth();
  const r = useAsync(() => api.get<A[]>('/admins'), []);
  const [n, setN] = useState({ name: '', email: '', password: '' });
  const [edit, setEdit] = useState<{ id: number; name: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const done = (msg: string) => () => { toast.push('success', msg); r.reload(); };

  function create(e: FormEvent) {
    e.preventDefault();
    if (n.name.trim().length < 2 || !n.email.includes('@') || n.password.length < 12) { setErr('Informe nome, e-mail e senha com ao menos 12 caracteres. O novo administrador terá de trocá-la no primeiro acesso.'); return; }
    setErr(null);
    confirm(`Criar o administrador ${n.name}?`, (adminPassword) => api.post('/admins', { adminPassword, ...n }), () => { setN({ name: '', email: '', password: '' }); done('Administrador criado.')(); });
  }
  function rename(e: FormEvent) {
    e.preventDefault();
    if (!edit || edit.name.trim().length < 2) return;
    const target = edit;
    confirm(`Renomear o administrador para ${target.name}?`, (adminPassword) => api.patch(`/admins/${target.id}`, { adminPassword, name: target.name }), () => { setEdit(null); done('Nome atualizado.')(); });
  }
  const reset = (a: A) => confirm(`Redefinir a senha de ${a.name} para a padrão?`, (adminPassword) => api.post(`/admins/${a.id}/reset-password`, { adminPassword }), done('Senha redefinida.'));
  const revoke = (a: A) => confirm(`Encerrar todas as sessões de ${a.name}?`, (adminPassword) => api.post(`/admins/${a.id}/revoke-sessions`, { adminPassword }), done('Sessões encerradas.'));
  const resetTwoFactor = (a: A) => confirm(`Remover o 2FA de ${a.name}? Use quando ele(a) perder o dispositivo e os códigos de recuperação. As sessões serão encerradas.`, (adminPassword) => api.post(`/admins/${a.id}/reset-2fa`, { adminPassword }), done('2FA removido.'));
  const unlock = (a: A) => confirm(`Desbloquear a conta de ${a.name}?`, (adminPassword) => api.post(`/admins/${a.id}/unlock`, { adminPassword }), done('Conta desbloqueada.'));
  const toggle = (a: A) => confirm(`${a.active ? 'Desativar' : 'Reativar'} ${a.name}?`, (adminPassword) => api.post(`/admins/${a.id}/status`, { adminPassword, active: !a.active }), done('Administrador atualizado.'));

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-extrabold">Administradores</h1>
      {err && <Alert tone="error">{err}</Alert>}
      <Card>
        <CardHeader><CardTitle>Novo administrador</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-4 sm:items-end" noValidate>
            <Field label="Nome"><Input value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} /></Field>
            <Field label="E-mail"><Input type="email" value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} /></Field>
            <Field label="Senha (mín. 12)"><Input type="password" autoComplete="new-password" value={n.password} onChange={(e) => setN({ ...n, password: e.target.value })} /></Field>
            <Button type="submit">Criar</Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">O e-mail é guardado apenas como hash; depois de criado, não pode ser exibido nem alterado.</p>
        </CardContent>
      </Card>
      {r.error ? <ErrorState message={r.error} onRetry={r.reload} /> : r.loading || !r.data ? <PageLoading /> :
        !r.data.length ? <EmptyState title="Nenhum administrador" /> : (
          <ul className="grid gap-2">
            {r.data.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-4 text-sm">
                <div>
                  {edit?.id === a.id ? (
                    <form onSubmit={rename} className="flex items-center gap-2" noValidate>
                      <Input aria-label="Novo nome" value={edit.name} onChange={(e) => setEdit({ id: a.id, name: e.target.value })} />
                      <Button size="sm" type="submit">Salvar</Button><Button size="sm" type="button" variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
                    </form>
                  ) : <p className="font-semibold">{a.name}{a.id === admin?.id ? ' (você)' : ''}</p>}
                  <p className="text-muted-foreground">Criado em {formatDate(a.createdAt.slice(0, 10))}{a.lastLoginAt ? ` · último acesso ${formatDate(a.lastLoginAt.slice(0, 10))}` : ''}</p>
                  <div className="mt-1 flex flex-wrap gap-2"><Badge tone={a.active ? 'success' : 'neutral'}>{a.active ? 'Ativo' : 'Inativo'}</Badge>{a.locked && <Badge tone="danger">Bloqueado</Badge>}{a.mustChangePassword && <Badge tone="warning">Senha provisória</Badge>}<Badge tone={a.twoFactorEnabled ? 'success' : 'neutral'}>{a.twoFactorEnabled ? '2FA ativo' : 'Sem 2FA'}</Badge><Badge>{a.activeSessions} sessão(ões)</Badge></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEdit({ id: a.id, name: a.name })}>Renomear</Button>
                  <Button size="sm" variant="outline" onClick={() => reset(a)}>Redefinir senha</Button>
                  {a.twoFactorEnabled && a.id !== admin?.id && <Button size="sm" variant="outline" onClick={() => resetTwoFactor(a)}>Resetar 2FA</Button>}
                  {a.locked && <Button size="sm" variant="outline" onClick={() => unlock(a)}>Desbloquear</Button>}
                  {a.activeSessions > 0 && <Button size="sm" variant="outline" onClick={() => revoke(a)}>Encerrar sessões</Button>}
                  {a.id !== admin?.id && <Button size="sm" variant="outline" onClick={() => toggle(a)}>{a.active ? 'Desativar' : 'Reativar'}</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
