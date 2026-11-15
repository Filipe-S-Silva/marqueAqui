import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Alert } from '@/components/common/states';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/hooks/useAsync';
import type { Portal } from '@/lib/api';
import { AuthShell } from './AuthShell';

/**
 * Dois logins, uma conta: o cliente entra por /login (área do cliente) e o parceiro (gestor ou profissional)
 * por /parceiro/login. Parceiro que entra como cliente tem acesso normal à área do cliente; o contrário
 * (cliente na área de parceiro) o backend recusa.
 */
function LoginForm({ portal }: { portal: Portal }) {
  const { login } = useAuth();
  const nav = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const partner = portal === 'partner';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const p = await login(email, password, portal);
      const sameArea = from && (partner ? !from.startsWith('/app') : from.startsWith('/app'));
      nav(p.mustChangePassword ? '/change-password' : sameArea ? from : p.redirectTo, { replace: true });
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <AuthShell
      title={partner ? 'Entrar como parceiro' : 'Entrar'}
      subtitle={partner ? 'Para gestores e profissionais de uma empresa.' : 'Acesse sua conta para agendar e acompanhar seus horários.'}
      footer={partner ? (
        <>É cliente? <Link className="font-semibold text-primary hover:underline" to="/login">Entre como cliente</Link></>
      ) : (
        <div className="grid gap-1">
          <span>Ainda não tem conta? <Link className="font-semibold text-primary hover:underline" to="/register">Cadastre-se</Link></span>
          <span>Gestor ou profissional? <Link className="font-semibold text-primary hover:underline" to="/parceiro/login">Entre como parceiro</Link></span>
        </div>
      )}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="E-mail"><Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Senha"><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <Button type="submit" loading={busy}>{partner ? 'Entrar como parceiro' : 'Entrar'}</Button>
        <Link to="/forgot-password" className="text-center text-sm text-muted-foreground hover:text-foreground hover:underline">Esqueci minha senha</Link>
      </form>
    </AuthShell>
  );
}

export const LoginPage = () => <LoginForm portal="client" />;
export const PartnerLoginPage = () => <LoginForm portal="partner" />;
