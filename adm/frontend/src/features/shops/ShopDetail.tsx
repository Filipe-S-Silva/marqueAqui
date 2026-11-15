import { DefaultPassword } from '@/components/common/DefaultPassword';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { Field } from '@/components/common/Field';
import { Alert, ErrorState, PageLoading } from '@/components/common/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { useConfirmedAction } from '@/contexts/ConfirmContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync } from '@/hooks/useAsync';
import { api } from '@/lib/api';

interface Shop { id: number; name: string; description: string | null; address: string | null; phone: string | null; logoUrl: string | null; active: boolean }
interface Manager { userId: number; name: string; email: string; phone: string | null; userActive: boolean; linkActive: boolean }

export function ShopDetail() {
  const { id } = useParams();
  const toast = useToast();
  const confirm = useConfirmedAction();
  const r = useAsync(() => api.get<{ shop: Shop; managers: Manager[] }>(`/shops/${id}`), [id]);
  const [f, setF] = useState({ name: '', description: '', address: '', phone: '', logoUrl: '' });
  const [m, setM] = useState({ name: '', email: '', phone: '' });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const s = r.data?.shop;
    if (s) setF({ name: s.name, description: s.description ?? '', address: s.address ?? '', phone: s.phone ?? '', logoUrl: s.logoUrl ?? '' });
  }, [r.data]);

  if (r.error) return <ErrorState message={r.error} onRetry={r.reload} />;
  if (r.loading || !r.data) return <PageLoading />;
  const { shop, managers } = r.data;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const done = (msg: string) => () => { toast.push('success', msg); r.reload(); };

  function save(e: FormEvent) {
    e.preventDefault();
    if (f.name.trim().length < 2) { setErr('Informe o nome da empresa.'); return; }
    setErr(null);
    confirm(`Salvar as alterações de ${shop.name}?`, (adminPassword) => api.patch(`/shops/${shop.id}`, {
      adminPassword, name: f.name, description: f.description, address: f.address, phone: f.phone,
      logoUrl: f.logoUrl || null,
    }), done('Empresa atualizada.'));
  }
  function toggleShop() {
    const next = !shop.active;
    confirm(next ? `Reativar ${shop.name}?` : `Desativar ${shop.name}? Agendamentos futuros serão cancelados e todos serão avisados.`,
      (adminPassword) => api.post(`/shops/${shop.id}/status`, { adminPassword, active: next }), done(next ? 'Empresa reativada.' : 'Empresa desativada.'));
  }
  function toggleManager(x: Manager) {
    const next = !x.linkActive;
    confirm(`${next ? 'Reativar' : 'Desativar'} o gestor ${x.name} nesta empresa?`,
      (adminPassword) => api.post(`/shops/${shop.id}/managers/${x.userId}/status`, { adminPassword, active: next }), done('Gestor atualizado.'));
  }
  function addManager(e: FormEvent) {
    e.preventDefault();
    if (m.name.trim().length < 2 || !m.email.includes('@')) { setErr('Informe nome e e-mail do gestor.'); return; }
    setErr(null);
    confirm(`Adicionar ${m.name} como gestor de ${shop.name}?`,
      (adminPassword) => api.post(`/shops/${shop.id}/managers`, { adminPassword, name: m.name, email: m.email, ...(m.phone ? { phone: m.phone } : {}) }),
      () => { setM({ name: '', email: '', phone: '' }); done('Gestor adicionado.')(); });
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/shops" className="text-sm text-muted-foreground hover:underline">← Empresas</Link>
          <h1 className="text-2xl font-extrabold">{shop.name}</h1>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge tone={shop.active ? 'success' : 'neutral'}>{shop.active ? 'Ativa' : 'Inativa'}</Badge>
            <Badge tone="info">ID #{shop.id}</Badge>
          </div>
        </div>
        <Button variant={shop.active ? 'outline' : 'default'} onClick={toggleShop}>{shop.active ? 'Desativar empresa' : 'Reativar empresa'}</Button>
      </div>
      {err && <Alert tone="error">{err}</Alert>}
      <form onSubmit={save} noValidate>
        <Card>
          <CardHeader><CardTitle>Dados da empresa</CardTitle></CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Nome"><Input value={f.name} maxLength={120} onChange={set('name')} /></Field>
            <Field label="Descrição"><Textarea value={f.description} maxLength={1000} onChange={set('description')} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Endereço"><Input value={f.address} onChange={set('address')} /></Field>
              <Field label="Telefone"><Input type="tel" value={f.phone} onChange={set('phone')} /></Field>
            </div>
            <Field label="Logo (URL https)"><Input value={f.logoUrl} onChange={set('logoUrl')} /></Field>
            <div><Button type="submit">Salvar alterações</Button></div>
          </CardContent>
        </Card>
      </form>
      <Card>
        <CardHeader><CardTitle>Gestores</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <ul className="grid gap-2">
            {managers.map((x) => (
              <li key={x.userId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                <div>
                  <Link to={`/users/${x.userId}`} className="font-semibold hover:underline">{x.name}</Link>
                  <p className="text-muted-foreground">{x.email}{x.phone ? ` · ${x.phone}` : ''}</p>
                  <div className="mt-1 flex gap-2"><Badge tone={x.linkActive ? 'success' : 'neutral'}>{x.linkActive ? 'Ativo na empresa' : 'Inativo na empresa'}</Badge>{!x.userActive && <Badge tone="danger">Conta inativa</Badge>}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => toggleManager(x)}>{x.linkActive ? 'Desativar' : 'Reativar'}</Button>
              </li>
            ))}
          </ul>
          <div className="mb-3"><DefaultPassword /></div>
          <form onSubmit={addManager} className="grid gap-3 sm:grid-cols-4 sm:items-end" noValidate>
            <Field label="Nome"><Input value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} /></Field>
            <Field label="E-mail"><Input type="email" value={m.email} onChange={(e) => setM({ ...m, email: e.target.value })} /></Field>
            <Field label="Telefone"><Input type="tel" value={m.phone} onChange={(e) => setM({ ...m, phone: e.target.value })} /></Field>
            <Button type="submit" variant="outline">Adicionar gestor</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
