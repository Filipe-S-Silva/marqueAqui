import { useState, type FormEvent } from 'react';
import { Field } from '@/components/common/Field';
import { Alert, ErrorState, PageLoading } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmedAction } from '@/contexts/ConfirmContext';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage, useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { qrDataUrl } from '@/lib/qr';

interface Sess { id: string; createdAt: string; expiresAt: string; ip: string | null; userAgent: string | null; current: boolean }

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function AccountPage() {
  const { admin, markPasswordChanged } = useAuth();
  const toast = useToast();
  const confirm = useConfirmedAction();
  const sessions = useAsync(() => api.get<Sess[]>('/auth/sessions'), []);
  const [f, setF] = useState({ currentPassword: '', newPassword: '', repeat: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function change(e: FormEvent) {
    e.preventDefault();
    if (f.newPassword.length < 8 || !/[A-Za-z]/.test(f.newPassword) || !/\d/.test(f.newPassword)) { setErr('A nova senha precisa de 8+ caracteres, com letra e número.'); return; }
    if (f.newPassword !== f.repeat) { setErr('As senhas novas não conferem.'); return; }
    setBusy(true); setErr(null);
    try {
      await api.post('/auth/change-password', { currentPassword: f.currentPassword, newPassword: f.newPassword });
      setF({ currentPassword: '', newPassword: '', repeat: '' });
      markPasswordChanged();
      toast.push('success', 'Senha alterada. As outras sessões foram encerradas.');
      sessions.reload();
    } catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
  }

  const revokeOthers = () => confirm('Encerrar todas as outras sessões desta conta?',
    (adminPassword) => api.post('/auth/sessions/revoke-others', { adminPassword }),
    () => { toast.push('success', 'Outras sessões encerradas.'); sessions.reload(); });

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-extrabold">Segurança</h1>
      {admin?.mustChangePassword && <Alert tone="error">Sua senha é provisória. Troque-a para liberar o restante do painel.</Alert>}
      {admin?.twoFactorSetupRequired && <Alert tone="error">O 2FA é obrigatório. Ative-o abaixo para liberar o restante do painel.</Alert>}
      <form onSubmit={change} noValidate>
        <Card>
          <CardHeader><CardTitle>Trocar senha</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            {err && <div className="sm:col-span-3"><Alert tone="error">{err}</Alert></div>}
            <Field label="Senha atual"><Input type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} /></Field>
            <Field label="Nova senha"><Input type="password" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} /></Field>
            <Field label="Repita a nova senha"><Input type="password" autoComplete="new-password" value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value })} /></Field>
            <div className="sm:col-span-3"><Button type="submit" loading={busy} disabled={!f.currentPassword || !f.newPassword}>Trocar senha</Button></div>
          </CardContent>
        </Card>
      </form>
      <TwoFactorCard />
      <Card>
        <CardHeader><CardTitle>Sessões ativas</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {sessions.error ? <ErrorState message={sessions.error} onRetry={sessions.reload} /> : sessions.loading || !sessions.data ? <PageLoading /> : (
            <>
              <ul className="grid gap-2">
                {sessions.data.map((s) => (
                  <li key={s.id} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{s.userAgent ?? 'Navegador desconhecido'}</span>{s.current && <Badge tone="success">Esta sessão</Badge>}</div>
                    <p className="text-muted-foreground">IP {s.ip ?? '—'} · iniciada {when(s.createdAt)} · expira {when(s.expiresAt)}</p>
                  </li>
                ))}
              </ul>
              {sessions.data.length > 1 && <div><Button variant="outline" onClick={revokeOthers}>Encerrar as outras sessões</Button></div>}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ 2FA */

interface TfStatus { enabled: boolean; enabledAt: string | null; pendingSetup: boolean; required: boolean; recoveryCodesRemaining: number }

export function TwoFactorCard() {
  const { refresh } = useAuth();
  const toast = useToast();
  const confirm = useConfirmedAction();
  const st = useAsync(() => api.get<TfStatus>('/auth/2fa'), []);
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const startSetup = () => confirm('Gerar um novo segredo 2FA para esta conta?', async (adminPassword) => {
    const r = await api.post<{ secret: string; otpauthUrl: string }>('/auth/2fa/setup', { adminPassword });
    // O QR é gerado no navegador: o segredo não passa por nenhum serviço de terceiros
    setSetup({ secret: r.secret, qr: qrDataUrl(r.otpauthUrl) });
    setCode(''); setErr(null);
  });

  async function enable(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await api.post<{ recoveryCodes: string[] }>('/auth/2fa/enable', { code });
      setCodes(r.recoveryCodes); setSetup(null); setCode('');
      toast.push('success', '2FA ativado.');
      st.reload(); await refresh();
    } catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
  }

  const regenerate = () => confirm('Gerar 8 códigos novos? Os anteriores deixam de valer.', async (adminPassword) => {
    const r = await api.post<{ recoveryCodes: string[] }>('/auth/2fa/recovery-codes', { adminPassword, code });
    setCodes(r.recoveryCodes); setCode(''); st.reload();
  });
  const disable = () => confirm('Desativar o 2FA desta conta?', async (adminPassword) => {
    await api.post('/auth/2fa/disable', { adminPassword, code });
    setCode(''); toast.push('success', '2FA desativado.'); st.reload(); await refresh();
  });

  function downloadCodes() {
    if (!codes) return;
    const blob = new Blob([`Códigos de recuperação do MarqueAqui ADM\n(cada um vale uma vez)\n\n${codes.join('\n')}\n`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'codigos-recuperacao.txt'; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader><CardTitle>Verificação em duas etapas (2FA)</CardTitle></CardHeader>
      <CardContent className="grid gap-4 text-sm">
        {st.error ? <ErrorState message={st.error} onRetry={st.reload} /> : st.loading || !st.data ? <PageLoading /> : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={st.data.enabled ? 'success' : 'warning'}>{st.data.enabled ? 'Ativo' : 'Desativado'}</Badge>
              {st.data.required && <Badge tone="info">Obrigatório neste ambiente</Badge>}
              {st.data.enabled && <span className="text-muted-foreground">{st.data.recoveryCodesRemaining} código(s) de recuperação restante(s)</span>}
            </div>
            {err && <Alert tone="error">{err}</Alert>}

            {codes && (
              <div className="grid gap-2 rounded-md border border-warning p-3">
                <p className="font-semibold">Guarde estes códigos agora. Eles não serão mostrados de novo.</p>
                <ul className="grid grid-cols-2 gap-1 font-mono sm:grid-cols-4">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(codes.join('\n'))}>Copiar</Button>
                  <Button size="sm" variant="outline" onClick={downloadCodes}>Baixar .txt</Button>
                  <Button size="sm" onClick={() => setCodes(null)}>Já guardei</Button>
                </div>
              </div>
            )}

            {!st.data.enabled && !setup && <div><Button onClick={startSetup}>Ativar 2FA</Button></div>}
            {!st.data.enabled && setup && (
              <form onSubmit={enable} className="grid gap-3" noValidate>
                <p>Leia o QR code com um aplicativo autenticador (Google Authenticator, Authy, 1Password…) e digite o código de 6 dígitos.</p>
                <img src={setup.qr} alt="QR code para o aplicativo autenticador" width={220} height={220} className="rounded-md border bg-white p-1" />
                <p className="text-muted-foreground">Sem câmera? Digite a chave: <span className="select-all font-mono">{setup.secret}</span></p>
                <Field label="Código de 6 dígitos"><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} /></Field>
                <div><Button type="submit" loading={busy} disabled={code.length !== 6}>Confirmar e ativar</Button></div>
              </form>
            )}

            {st.data.enabled && (
              <div className="grid gap-3">
                <Field label="Código atual (6 dígitos) ou de recuperação" hint="Necessário para gerar novos códigos ou desativar.">
                  <Input autoComplete="one-time-code" maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" disabled={code.trim().length < 6} onClick={regenerate}>Gerar novos códigos de recuperação</Button>
                  {!st.data.required && <Button variant="outline" disabled={code.trim().length < 6} onClick={disable}>Desativar 2FA</Button>}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
