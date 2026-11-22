import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/common/Field';
import { Alert } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage } from '@/hooks/useAsync';
import { Avatar } from '@/components/common/Avatar';
import { MAX_PHOTO_BYTES, api, uploadImage } from '@/lib/api';
import { fieldErrors } from '@/features/auth/AuthShell';

export function ProfilePage() {
  const { user, patchUser, logout } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const isStaff = user?.role !== 'CLIENT';
  const [f, setF] = useState({ name: user?.name ?? '', phone: user?.phone ?? '', description: user?.description ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [pw, setPw] = useState({ cur: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwBusy, setPwBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delError, setDelError] = useState<string | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  // Cópia dos dados (LGPD, Art. 18, II e V)
  async function exportData() {
    setExporting(true);
    try {
      const data = await api.get<unknown>('/auth/account/export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'meus-dados-marqueaqui.json'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { toast.push('error', errorMessage(err)); } finally { setExporting(false); }
  }

  // Exclusão da conta (LGPD, Art. 18, VI)
  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    setDelBusy(true); setDelError(null);
    try {
      await api.post('/auth/account/delete', { password: delPw });
      await logout();
      toast.push('success', 'Conta excluída. Seus dados pessoais foram removidos.');
      nav('/', { replace: true });
    } catch (err) { setDelError(errorMessage(err)); } finally { setDelBusy(false); }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setErrors({});
    try {
      const body: Record<string, unknown> = { name: f.name, phone: f.phone };
      if (user?.role === 'PROFESSIONAL') body.description = f.description;
      const u = await api.patch<{ name: string; phone: string | null; photoUrl: string | null; description: string | null }>('/profile', body);
      patchUser(u);
      toast.push('success', 'Perfil atualizado.');
    } catch (err) { setErrors(fieldErrors(err)); setError(errorMessage(err)); } finally { setBusy(false); }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast.push('error', 'Use uma imagem PNG, JPEG ou WebP.'); return; }
    if (file.size > MAX_PHOTO_BYTES) { toast.push('error', 'A foto deve ter no máximo 5 MB.'); return; }
    setPhotoBusy(true);
    try {
      const r = await uploadImage<{ photoUrl: string }>('/profile/photo', file);
      patchUser({ photoUrl: r.photoUrl });
      toast.push('success', 'Foto atualizada.');
    } catch (err) { toast.push('error', errorMessage(err)); } finally { setPhotoBusy(false); }
  }
  async function removePhoto() {
    setPhotoBusy(true);
    try { await api.del('/profile/photo'); patchUser({ photoUrl: null }); toast.push('success', 'Foto removida.'); }
    catch (err) { toast.push('error', errorMessage(err)); } finally { setPhotoBusy(false); }
  }

  async function changePw(e: FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.confirm) { setPwErrors({ confirm: 'As senhas não coincidem.' }); return; }
    setPwBusy(true); setPwErrors({});
    try {
      await api.post('/auth/change-password', { currentPassword: pw.cur, newPassword: pw.next });
      toast.push('success', 'Senha alterada com sucesso.');
      setPw({ cur: '', next: '', confirm: '' });
    } catch (err) { setPwErrors({ ...fieldErrors(err), form: errorMessage(err) }); } finally { setPwBusy(false); }
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-extrabold">Meu perfil</h1>
      {isStaff && (
        <Card>
          <CardHeader><CardTitle>Foto</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4">
            <Avatar name={user?.name ?? ''} photoUrl={user?.photoUrl} className="size-20 text-lg" />
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">Os clientes veem sua foto ao escolher o profissional. PNG, JPEG ou WebP, até 5 MB.</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm" disabled={photoBusy}>
                  <label className="cursor-pointer">
                    {photoBusy ? 'Enviando…' : user?.photoUrl ? 'Trocar foto' : 'Anexar foto'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={photoBusy}
                      onChange={(e) => { void onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                </Button>
                {user?.photoUrl && <Button variant="ghost" size="sm" disabled={photoBusy} onClick={() => void removePhoto()}>Remover</Button>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle>Dados pessoais</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4" noValidate>
            {error && <Alert tone="error">{error}</Alert>}
            <Field label="Nome" error={errors.name}><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
            <Field label="E-mail" hint="O e-mail não pode ser alterado por aqui."><Input value={user?.email ?? ''} readOnly disabled /></Field>
            <Field label="Telefone" error={errors.phone}><Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
                        {user?.role === 'PROFESSIONAL' && <Field label="Descrição pública" error={errors.description}><Textarea value={f.description} maxLength={500} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>}
            <Button type="submit" loading={busy}>Salvar</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Alterar senha</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={changePw} className="grid gap-4" noValidate>
            {pwErrors.form && !pwErrors.currentPassword && !pwErrors.newPassword && <Alert tone="error">{pwErrors.form}</Alert>}
            <Field label="Senha atual" error={pwErrors.currentPassword}><Input type="password" autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} required /></Field>
            <Field label="Nova senha" error={pwErrors.newPassword} hint="Mínimo de 8 caracteres, com letra e número."><Input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></Field>
            <Field label="Confirmar nova senha" error={pwErrors.confirm}><Input type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required /></Field>
            <Button type="submit" loading={pwBusy}>Alterar senha</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Privacidade e dados</CardTitle></CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <p className="text-muted-foreground">
            Baixe uma cópia de tudo o que guardamos sobre você. Saiba mais na <Link className="font-semibold text-primary hover:underline" to="/privacidade">Política de Privacidade</Link>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" loading={exporting} onClick={() => void exportData()}>Baixar meus dados</Button>
            {user?.role === 'CLIENT' && <Button variant="destructive" onClick={() => { setDelPw(''); setDelError(null); setDelOpen(true); }}>Excluir minha conta</Button>}
          </div>
          {isStaff && <p className="text-muted-foreground">Para excluir uma conta de profissional ou gestor, abra um chamado no Suporte: ela está ligada a uma empresa.</p>}
        </CardContent>
      </Card>
      <Dialog open={delOpen} onOpenChange={(o) => !delBusy && setDelOpen(o)}>
        <DialogContent>
          <DialogTitle>Excluir minha conta</DialogTitle>
          <DialogDescription asChild>
            <div className="grid gap-2 text-sm">
              <p>Seus agendamentos futuros serão cancelados e seus dados pessoais serão removidos. Essa ação não pode ser desfeita.</p>
              <p className="text-muted-foreground">Registros de acesso (IP, data e hora) são guardados por 6 meses, por obrigação legal.</p>
            </div>
          </DialogDescription>
          <form onSubmit={deleteAccount} className="grid gap-4" noValidate>
            {delError && <Alert tone="error">{delError}</Alert>}
            <Field label="Confirme com a sua senha"><Input type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} required /></Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={delBusy} onClick={() => setDelOpen(false)}>Voltar</Button>
              <Button type="submit" variant="destructive" loading={delBusy} disabled={!delPw}>Excluir conta</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
