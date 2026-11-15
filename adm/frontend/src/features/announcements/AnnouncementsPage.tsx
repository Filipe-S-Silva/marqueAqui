import { useState, type FormEvent } from 'react';
import { Field } from '@/components/common/Field';
import { Alert } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Select, Textarea } from '@/components/ui/input';
import { useConfirmedAction } from '@/contexts/ConfirmContext';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';

const AUDIENCE_LABEL: Record<string, string> = { ALL: 'todos os usuários ativos', CLIENT: 'todos os clientes', PROFESSIONAL: 'todos os profissionais', MANAGER: 'todos os gestores', SHOP: 'a equipe de uma empresa' };

export function AnnouncementsPage() {
  const toast = useToast();
  const confirm = useConfirmedAction();
  const [f, setF] = useState({ title: '', message: '', audience: 'ALL', shopId: '', requiresAck: false });
  const [err, setErr] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const shopId = Number(f.shopId);
    if (f.title.trim().length < 3 || f.message.trim().length < 3) { setErr('Informe título e mensagem.'); return; }
    if (f.audience === 'SHOP' && (!Number.isInteger(shopId) || shopId <= 0)) { setErr('Informe o ID da empresa.'); return; }
    setErr(null);
    confirm(`Enviar "${f.title}" para ${AUDIENCE_LABEL[f.audience]}${f.requiresAck ? ', exigindo confirmação de leitura' : ''}?`,
      async (adminPassword) => {
        const r = await api.post<{ recipients: number }>('/announcements', {
          adminPassword, title: f.title, message: f.message, audience: f.audience, requiresAck: f.requiresAck,
          ...(f.audience === 'SHOP' ? { shopId } : {}),
        });
        toast.push('success', `Comunicado enviado a ${r.recipients} usuário(s).`);
        setF({ title: '', message: '', audience: 'ALL', shopId: '', requiresAck: false });
      });
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <h1 className="text-2xl font-extrabold">Comunicados</h1>
      {err && <Alert tone="error">{err}</Alert>}
      <Card>
        <CardHeader><CardTitle>Novo comunicado</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Título"><Input value={f.title} maxLength={160} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Mensagem" hint="Texto simples; é exibido sem formatação."><Textarea value={f.message} maxLength={2000} rows={5} onChange={(e) => setF({ ...f, message: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Público">
              <Select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}>
                <option value="ALL">Todos os usuários ativos</option><option value="CLIENT">Clientes</option><option value="PROFESSIONAL">Profissionais</option><option value="MANAGER">Gestores</option><option value="SHOP">Equipe de uma empresa</option>
              </Select>
            </Field>
            {f.audience === 'SHOP' && <Field label="ID da empresa"><Input inputMode="numeric" value={f.shopId} onChange={(e) => setF({ ...f, shopId: e.target.value })} /></Field>}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.requiresAck} onChange={(e) => setF({ ...f, requiresAck: e.target.checked })} className="size-4" />
            Exigir confirmação (aparece na janela pós-login até o usuário clicar em "Entendi")
          </label>
          <div><Button type="submit">Enviar comunicado</Button></div>
        </CardContent>
      </Card>
    </form>
  );
}
