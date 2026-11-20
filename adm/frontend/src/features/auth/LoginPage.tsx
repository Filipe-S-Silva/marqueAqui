import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Alert } from '@/components/common/states';
import { Field } from '@/components/common/Field';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/hooks/useAsync';
import { Brand } from '@/layouts/Layouts';

export function LoginPage() {
  const { login, completeTwoFactor } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const r = await login(f.name, f.email, f.password);
      if (r) { setChallenge(r.challengeToken); setF((s) => ({ ...s, password: '' })); return; }
      nav((loc.state as { from?: string } | null)?.from ?? '/', { replace: true });
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setBusy(true); setError(null);
    try { await completeTwoFactor(challenge, code); nav((loc.state as { from?: string } | null)?.from ?? '/', { replace: true }); }
    catch (err) { setError(errorMessage(err)); setCode(''); } finally { setBusy(false); }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="absolute right-3 top-3"><ThemeToggle /></div>
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center text-xl"><Brand /></div>
        <Card>
          <CardHeader><CardTitle className="text-xl">Acesso administrativo</CardTitle></CardHeader>
          <CardContent>
            {challenge ? (
              <form onSubmit={submitCode} className="grid gap-4" noValidate>
                {error && <Alert tone="error">{error}</Alert>}
                <p className="text-sm text-muted-foreground">Digite o código de 6 dígitos do seu aplicativo autenticador ou um código de recuperação.</p>
                <Field label="Código"><Input inputMode="text" autoComplete="one-time-code" autoFocus value={code} maxLength={20} onChange={(e) => setCode(e.target.value)} required /></Field>
                <Button type="submit" loading={busy} disabled={code.trim().length < 6}>Verificar</Button>
                <Button type="button" variant="ghost" onClick={() => { setChallenge(null); setCode(''); setError(null); }}>Voltar</Button>
              </form>
            ) : (
            <form onSubmit={submit} className="grid gap-4" noValidate>
              {error && <Alert tone="error">{error}</Alert>}
              <Field label="Nome"><Input autoComplete="username" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
              <Field label="E-mail"><Input type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
              <Field label="Senha"><Input type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
              <Button type="submit" loading={busy}>Entrar</Button>
            </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
