import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { ShopAvatar } from '@/components/common/Logo';
import { Field } from '@/components/common/Field';
import { Alert, ErrorState, PageLoading } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync, errorMessage } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { fieldErrors } from '@/features/auth/AuthShell';

interface ShopInfo { shop: { id: number; name: string; description: string | null; address: string | null; phone: string | null; logoUrl?: string | null } }
interface Manager { userId: number; name: string; email: string; active: boolean }

/** Reduz e otimiza a imagem no navegador (máx. 256 px, WebP) antes de enviar. */
async function shrinkImage(file: File, max = 256): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Use uma imagem PNG, JPEG ou WebP.');
  const bmp = await createImageBitmap(file);
  const ratio = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * ratio);
  canvas.height = Math.round(bmp.height * ratio);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.85);
}

export function ShopPage() {
  const { activeShopId } = useAuth();
  const toast = useToast();
  const info = useAsync(() => api.get<ShopInfo>(`/public/shops/${activeShopId}/services`), [activeShopId]);
  const mgrs = useAsync(() => api.get<Manager[]>('/manager/managers'), [activeShopId]);
  const [f, setF] = useState({ name: '', description: '', address: '', phone: '', logoUrl: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mgr, setMgr] = useState({ name: '', email: '', phone: '' });
  const [mgrBusy, setMgrBusy] = useState(false);

  useEffect(() => {
    const s = info.data?.shop;
    if (s) setF((p) => ({ name: s.name, description: s.description ?? '', address: s.address ?? '', phone: s.phone ?? '', logoUrl: s.logoUrl ?? p.logoUrl }));
  }, [info.data]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try { const url = await shrinkImage(file); setF((p) => ({ ...p, logoUrl: url })); }
    catch (err) { setError(err instanceof Error ? err.message : 'Imagem inválida.'); }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setErrors({});
    try {
      await api.patch('/manager/shop', { name: f.name, description: f.description, address: f.address, phone: f.phone, logoUrl: f.logoUrl || null });
      toast.push('success', 'Empresa atualizada.');
      info.reload();
    } catch (err) { setErrors(fieldErrors(err)); setError(errorMessage(err)); } finally { setBusy(false); }
  }

  async function addManager(e: FormEvent) {
    e.preventDefault();
    setMgrBusy(true);
    try {
      await api.post('/manager/managers', { name: mgr.name, email: mgr.email, ...(mgr.phone ? { phone: mgr.phone } : {}) });
      toast.push('success', 'Gestor adicionado. Se a conta é nova, a senha inicial é a padrão e deve ser trocada no primeiro acesso.');
      setMgr({ name: '', email: '', phone: '' });
      mgrs.reload();
    } catch (err) { toast.push('error', errorMessage(err)); } finally { setMgrBusy(false); }
  }

  if (info.error) return <ErrorState message={info.error} onRetry={info.reload} />;
  if (info.loading || !info.data) return <PageLoading />;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-extrabold">Empresa</h1>
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={save} className="grid gap-4" noValidate>
            {error && <Alert tone="error">{error}</Alert>}
            <div className="flex items-center gap-4">
              <ShopAvatar name={f.name || 'Empresa'} logoUrl={f.logoUrl || null} className="size-16" />
              <div className="grid flex-1 gap-2">
                <Field label="Logo (URL https)" error={errors.logoUrl}><Input value={f.logoUrl.startsWith('data:') ? '' : f.logoUrl} placeholder="https://…" onChange={(e) => setF({ ...f, logoUrl: e.target.value })} /></Field>
                <Field label="Ou envie uma imagem" hint="Será reduzida no navegador antes do envio."><Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void onFile(e)} /></Field>
              </div>
            </div>
            <Field label="Nome" error={errors.name}><Input value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
            <Field label="Descrição" error={errors.description}><Textarea value={f.description} maxLength={1000} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Endereço" error={errors.address}><Input value={f.address} maxLength={255} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
              <Field label="Telefone" error={errors.phone}><Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            </div>
            <Button type="submit" loading={busy}>Salvar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Gestores</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {mgrs.data && <ul className="grid gap-1 text-sm">{mgrs.data.map((m) => <li key={m.userId}>{m.name} · <span className="text-muted-foreground">{m.email}</span>{!m.active && ' (inativo)'}</li>)}</ul>}
          <form onSubmit={addManager} className="grid gap-3 sm:grid-cols-3">
            <Field label="Nome"><Input value={mgr.name} onChange={(e) => setMgr({ ...mgr, name: e.target.value })} required /></Field>
            <Field label="E-mail"><Input type="email" value={mgr.email} onChange={(e) => setMgr({ ...mgr, email: e.target.value })} required /></Field>
            <Field label="Telefone"><Input type="tel" value={mgr.phone} onChange={(e) => setMgr({ ...mgr, phone: e.target.value })} /></Field>
            <Button type="submit" loading={mgrBusy} className="sm:col-span-3">Adicionar gestor</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
