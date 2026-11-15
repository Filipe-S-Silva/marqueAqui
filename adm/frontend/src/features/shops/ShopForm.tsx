import { DefaultPassword } from '@/components/common/DefaultPassword';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Field } from '@/components/common/Field';
import { Alert } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { useConfirmedAction } from '@/contexts/ConfirmContext';
import { useToast } from '@/contexts/ToastContext';
import { ApiError, api } from '@/lib/api';

export function NewShopPage() {
  const nav = useNavigate();
  const toast = useToast();
  const confirm = useConfirmedAction();
  const [f, setF] = useState({ name: '', description: '', address: '', phone: '', logoUrl: '', mName: '', mEmail: '', mPhone: '' });
  const [localError, setLocalError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (f.name.trim().length < 2 || f.mName.trim().length < 2 || !f.mEmail.includes('@')) { setLocalError('Preencha o nome da empresa e os dados do primeiro gestor.'); return; }
    setLocalError(null);
    confirm(`Cadastrar a empresa ${f.name} com o gestor ${f.mName}?`, async (adminPassword) => {
      try {
        const r = await api.post<{ shop: { id: number } }>('/shops', {
          adminPassword, name: f.name, description: f.description, address: f.address, phone: f.phone,
          logoUrl: f.logoUrl || null,
          manager: { name: f.mName, email: f.mEmail, ...(f.mPhone ? { phone: f.mPhone } : {}) },
        });
        toast.push('success', 'Empresa criada. Se o gestor é novo, a senha inicial é a padrão e deve ser trocada no primeiro acesso.');
        nav(`/shops/${r.shop.id}`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 400) setLocalError(err.errors.map((x) => `${x.path}: ${x.message}`).join(' · ') || err.message);
        throw err;
      }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <h1 className="text-2xl font-extrabold">Nova empresa</h1>
      {localError && <Alert tone="error">{localError}</Alert>}
      <Card>
        <CardHeader><CardTitle>Dados da empresa</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Nome"><Input value={f.name} maxLength={120} onChange={set('name')} required /></Field>
          <Field label="Descrição"><Textarea value={f.description} maxLength={1000} onChange={set('description')} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Endereço"><Input value={f.address} onChange={set('address')} /></Field>
            <Field label="Telefone"><Input type="tel" value={f.phone} onChange={set('phone')} /></Field>
          </div>
          <Field label="Logo (URL https)"><Input value={f.logoUrl} placeholder="https://…" onChange={set('logoUrl')} /></Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Primeiro gestor</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3"><DefaultPassword /></div>
          <Field label="Nome"><Input value={f.mName} onChange={set('mName')} required /></Field>
          <Field label="E-mail"><Input type="email" value={f.mEmail} onChange={set('mEmail')} required /></Field>
          <Field label="Telefone"><Input type="tel" value={f.mPhone} onChange={set('mPhone')} /></Field>
        </CardContent>
      </Card>
      <Button type="submit" size="lg">Cadastrar empresa</Button>
    </form>
  );
}
