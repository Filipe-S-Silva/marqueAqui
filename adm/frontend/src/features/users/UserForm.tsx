import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Field } from '@/components/common/Field';
import { Alert } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/input';
import { useConfirmedAction } from '@/contexts/ConfirmContext';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';

interface Created { kind: 'USER' | 'ADMIN'; id: number }

export function NewUserPage() {
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirmedAction();
  const [f, setF] = useState({ role: 'CLIENT', name: '', email: '', phone: '', password: '', shopIds: '' });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const needsShop = f.role === 'PROFESSIONAL' || f.role === 'MANAGER';

  function submit(e: FormEvent) {
    e.preventDefault();
    const shopIds = f.shopIds.split(',').map((x) => x.trim()).filter(Boolean).map(Number);
    if (f.name.trim().length < 2 || !f.email.includes('@')) { setErr('Informe nome e e-mail.'); return; }
    if (shopIds.some((n) => !Number.isInteger(n) || n <= 0)) { setErr('IDs de empresa inválidos. Use números separados por vírgula.'); return; }
    if (needsShop && !shopIds.length) { setErr('Informe ao menos uma empresa para esta classe.'); return; }
    setErr(null);
    confirm(`Criar ${f.name} como ${f.role === 'ADMIN' ? 'administrador' : 'usuário'}?`, async (adminPassword) => {
      const r = await api.post<Created>('/users', {
        adminPassword, role: f.role, name: f.name, email: f.email,
        ...(f.phone ? { phone: f.phone } : {}), ...(f.password ? { password: f.password } : {}), shopIds,
      });
      toast.push('success', 'Conta criada. Sem senha informada, vale a senha padrão e a troca é exigida no primeiro acesso.');
      nav(r.kind === 'ADMIN' ? '/admins' : `/users/${r.id}`);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <h1 className="text-2xl font-extrabold">Novo usuário</h1>
      {err && <Alert tone="error">{err}</Alert>}
      <Card>
        <CardHeader><CardTitle>Dados da conta</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Classe">
            <Select value={f.role} onChange={set('role')}>
              <option value="CLIENT">Cliente</option><option value="PROFESSIONAL">Profissional</option><option value="MANAGER">Gestor</option><option value="ADMIN">Administrador</option>
            </Select>
          </Field>
          <Field label="Nome"><Input value={f.name} onChange={set('name')} /></Field>
          <Field label="E-mail"><Input type="email" value={f.email} onChange={set('email')} /></Field>
          <Field label="Telefone"><Input type="tel" value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Senha inicial (opcional)" hint={f.role === 'ADMIN' ? 'Administrador: mínimo de 12 caracteres, conforme a política da API.' : 'Vazio = senha padrão com troca obrigatória.'}>
            <Input type="password" autoComplete="new-password" value={f.password} onChange={set('password')} />
          </Field>
          {f.role !== 'ADMIN' && f.role !== 'CLIENT' && (
            <Field label="IDs das empresas" hint="Separe por vírgula. Os IDs aparecem na lista de empresas.">
              <Input value={f.shopIds} inputMode="numeric" onChange={set('shopIds')} />
            </Field>
          )}
        </CardContent>
      </Card>
      <Button type="submit" size="lg">Criar conta</Button>
    </form>
  );
}
