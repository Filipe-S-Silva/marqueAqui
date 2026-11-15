import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert } from '@/components/common/states';
import { Field } from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { errorMessage } from '@/hooks/useAsync';
import { AuthShell, fieldErrors } from './AuthShell';

export function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (f.password !== f.confirm) { setErrors({ confirm: 'As senhas não coincidem.' }); return; }
    setErrors({}); setBusy(true);
    try {
      const p = await register({ name: f.name, email: f.email, ...(f.phone ? { phone: f.phone } : {}), password: f.password });
      nav(p.redirectTo, { replace: true }); // cadastro sempre cria cliente
    } catch (err) { setErrors(fieldErrors(err)); setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <AuthShell title="Criar conta" subtitle="Cadastro gratuito para clientes."
      footer={<>Já tem conta? <Link className="font-semibold text-primary hover:underline" to="/login">Entrar</Link></>}>
      <form onSubmit={submit} className="grid gap-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Nome completo" error={errors.name}><Input autoComplete="name" value={f.name} onChange={set('name')} required /></Field>
        <Field label="E-mail" error={errors.email}><Input type="email" autoComplete="email" value={f.email} onChange={set('email')} required /></Field>
        <Field label="Telefone (opcional)" error={errors.phone}><Input type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Senha" error={errors.password} hint="Mínimo de 8 caracteres, com letra e número."><Input type="password" autoComplete="new-password" value={f.password} onChange={set('password')} required /></Field>
        <Field label="Confirmar senha" error={errors.confirm}><Input type="password" autoComplete="new-password" value={f.confirm} onChange={set('confirm')} required /></Field>
        <Button type="submit" loading={busy}>Criar conta</Button>
      </form>
    </AuthShell>
  );
}
