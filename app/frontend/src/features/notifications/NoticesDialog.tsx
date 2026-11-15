import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { errorMessage } from '@/hooks/useAsync';

interface Affected { appointmentId: number; date: string; startTime: string; clientName?: string; clientPhone?: string | null; serviceName: string; professionalName?: string }
interface Notice { id: number; title: string; message: string; createdAt: string; data?: { affected?: Affected[]; total?: number } | null }

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** .doc (HTML aceito pelo Word) gerado a partir dos dados persistidos no aviso. Todo conteúdo é escapado. */
function downloadDoc(n: Notice): void {
  const rows = (n.data?.affected ?? []).map((a) =>
    `<tr><td>${esc(a.date)}</td><td>${esc(a.startTime)}</td><td>${esc(a.clientName)}</td><td>${esc(a.clientPhone)}</td><td>${esc(a.serviceName)}</td><td>${esc(a.professionalName)}</td></tr>`).join('');
  const html = `<html><head><meta charset="utf-8"><title>${esc(n.title)}</title></head><body><h1>${esc(n.title)}</h1><p>${esc(n.message)}</p>` +
    `<table border="1" cellpadding="4" style="border-collapse:collapse"><thead><tr><th>Data</th><th>Horário</th><th>Cliente</th><th>Telefone</th><th>Serviço</th><th>Profissional</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  const url = URL.createObjectURL(new Blob(['\uFEFF', html], { type: 'application/msword' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'clientes-afetados.doc'; a.click();
  URL.revokeObjectURL(url);
}

/** Avisos obrigatórios após o login. O estado "visto" é do backend (ack por usuário). */
export function NoticesDialog() {
  const [items, setItems] = useState<Notice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.get<Notice[]>('/notifications/pending').then((r) => { if (alive) setItems(r); }).catch(() => { /* sem avisos */ });
    return () => { alive = false; };
  }, []);

  async function ack() {
    setBusy(true); setError(null);
    try {
      await Promise.all(items.map((n) => api.post(`/notifications/${n.id}/ack`)));
      setItems([]);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  return (
    <Dialog open={items.length > 0}>
      <DialogContent blocking>
        <DialogTitle>Avisos importantes</DialogTitle>
        <DialogDescription>Leia com atenção antes de continuar.</DialogDescription>
        <ul className="grid gap-3">
          {items.map((n) => (
            <li key={n.id} className="rounded-md border bg-muted/40 p-3">
              <p className="text-sm font-semibold">{n.title}</p>
              <p className="text-sm text-muted-foreground">{n.message}</p>
              {n.data?.affected && n.data.affected.length > 0 && (
                <>
                  <ul className="mt-2 max-h-32 overflow-y-auto text-xs">
                    {n.data.affected.map((a) => (
                      <li key={a.appointmentId}>{a.date} {a.startTime} · {a.serviceName}{a.clientName ? ` · ${a.clientName}` : ''}</li>
                    ))}
                  </ul>
                  {n.data.affected.some((a) => a.clientName) && (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => downloadDoc(n)}>Baixar lista (.doc)</Button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button onClick={ack} loading={busy}>Entendi</Button>
      </DialogContent>
    </Dialog>
  );
}
