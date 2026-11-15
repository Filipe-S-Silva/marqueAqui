import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Alert, PageLoading } from '@/components/common/states';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { homeFor, useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { AuthShell, fieldErrors } from './AuthShell';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.post('/auth/forgot-password', { email }, { auth: false });
      // Mensagem neutra: não revela se o e-mail existe
      setDone('Se o e-mail estiver cadastrado, enviaremos as instruções de redefinição.');
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Recuperar senha" subtitle="Informe seu e-mail para receber o link de redefinição."
      footer={<Link to="/login" className="font-semibold text-primary hover:underline">Voltar ao login</Link>}>
      {done ? <Alert tone="success">{done}</Alert> : (
        <form onSubmit={submit} className="grid gap-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="E-mail"><Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Button type="submit" loading={busy}>Enviar instruções</Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const nav = useNavigate();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) return <Navigate to="/forgot-password" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setErrors({});
    try {
      await api.post('/auth/reset-password', { token, newPassword: pw }, { auth: false });
      toast.push('success', 'Senha redefinida. Entre com a nova senha.');
      nav('/login', { replace: true });
    } catch (err) { setErrors(fieldErrors(err)); setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Nova senha" subtitle="Escolha uma senha forte.">
      <form onSubmit={submit} className="grid gap-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Nova senha" error={errors.newPassword} hint="Mínimo de 8 caracteres, com letra e número."><Input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required /></Field>
        <Button type="submit" loading={busy}>Redefinir senha</Button>
      </form>
    </AuthShell>
  );
}

/** Tela obrigatória enquanto a conta usa a senha padrão. As demais rotas redirecionam para cá. */
export function ChangePasswordPage() {
  const { status, user, portal, mustChangePassword, reload, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'loading') return <PageLoading />;
  if (status === 'anonymous' || !user) return <Navigate to="/login" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setErrors({});
    try {
      await api.post('/auth/change-password', { currentPassword: cur, newPassword: next });
      await reload();
      toast.push('success', 'Senha alterada com sucesso.');
      nav(homeFor(user!, portal), { replace: true });
    } catch (err) { setErrors(fieldErrors(err)); setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <AuthShell hideBack title={mustChangePassword ? 'Troque sua senha' : 'Alterar senha'}
      subtitle={mustChangePassword ? 'Sua conta usa uma senha padrão. Defina uma nova para continuar.' : undefined}
      footer={mustChangePassword ? <button type="button" className="hover:underline" onClick={() => void logout()}>Sair</button> : undefined}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Senha atual" error={errors.currentPassword}><Input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required /></Field>
        <Field label="Nova senha" error={errors.newPassword} hint="Mínimo de 8 caracteres, com letra e número."><Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></Field>
        <Button type="submit" loading={busy}>Salvar nova senha</Button>
      </form>
    </AuthShell>
  );
}
