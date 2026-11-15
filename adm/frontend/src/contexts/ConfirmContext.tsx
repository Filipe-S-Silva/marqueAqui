import { createContext, useCallback, useContext, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Field } from '@/components/common/Field';
import { Alert } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/hooks/useAsync';

type Action = (adminPassword: string) => Promise<unknown>;
interface Pending { description: string; action: Action; onDone?: () => void }
const Ctx = createContext<((description: string, action: Action, onDone?: () => void) => void) | null>(null);

/**
 * Toda alteração passa por aqui (spec 8.2): abre "Confirme com sua senha." e só então executa a ação,
 * enviando a senha à API, que a valida de novo. Um erro (senha errada etc.) mantém o modal aberto.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);

  const ask = useCallback((description: string, action: Action, onDone?: () => void) => {
    setPassword(''); setError(null); setPending(onDone ? { description, action, onDone } : { description, action });
  }, []);
  const close = () => { if (!busy) { setPending(null); setPassword(''); } };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pending) return;
    setBusy(true); setError(null);
    try {
      await pending.action(password);
      const done = pending.onDone;
      setPending(null); setPassword('');
      done?.();
    } catch (err) { setError(errorMessage(err)); setErrorKey((k) => k + 1); } finally { setBusy(false); }
  }

  const value = useMemo(() => ask, [ask]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <Dialog open={pending !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogTitle>Confirme com sua senha.</DialogTitle>
          <DialogDescription>{pending?.description}</DialogDescription>
          <form onSubmit={submit} className="grid gap-4" noValidate>
            {error && <div key={errorKey} className="shake"><Alert tone="error">{error}</Alert></div>}
            <Field label="Sua senha de administrador">
              <Input type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close} disabled={busy}>Cancelar</Button>
              <Button type="submit" loading={busy} disabled={!password}>Confirmar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export function useConfirmedAction() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useConfirmedAction fora do ConfirmProvider');
  return v;
}
