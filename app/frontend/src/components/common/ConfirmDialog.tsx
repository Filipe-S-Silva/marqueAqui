import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = 'Confirmar', destructive, onConfirm }: Props) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try { await onConfirm(); onOpenChange(false); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription asChild><div>{description}</div></DialogDescription>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Voltar</Button>
          <Button variant={destructive ? 'destructive' : 'default'} onClick={run} loading={busy}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
