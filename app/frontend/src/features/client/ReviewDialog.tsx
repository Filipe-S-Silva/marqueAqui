import { useState, type FormEvent } from 'react';
import { Field } from '@/components/common/Field';
import { StarPicker } from '@/components/common/Stars';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage } from '@/hooks/useAsync';
import { api } from '@/lib/api';

/** Avaliação de um atendimento concluído (nota 1–5 + comentário opcional). */
export interface ReviewTarget { id: number; serviceName?: string; shopName?: string }

export function ReviewDialog({ target, onClose, onDone }: { target: ReviewTarget | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!target || !stars) { setError('Escolha uma nota de 1 a 5 estrelas.'); return; }
    setBusy(true); setError(null);
    try {
      await api.post(`/client/appointments/${target.id}/review`, { rating: stars, ...(comment.trim() ? { comment } : {}) });
      toast.push('success', 'Avaliação enviada. Obrigado!');
      setStars(0); setComment(''); onClose(); onDone();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogTitle>Como foi o atendimento?</DialogTitle>
        <DialogDescription>{target ? `${target.serviceName} em ${target.shopName}. A empresa vai ver sua nota e seu comentário.` : ''}</DialogDescription>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <StarPicker value={stars} onChange={setStars} label="Nota do atendimento" />
          <Field label="Comentário (opcional)"><Textarea value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} /></Field>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Agora não</Button>
            <Button type="submit" loading={busy}>Enviar avaliação</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
