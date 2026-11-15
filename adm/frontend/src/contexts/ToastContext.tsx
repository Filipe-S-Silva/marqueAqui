import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Kind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: Kind; message: string }
interface ToastCtx { push: (kind: Kind, message: string) => void }
const Ctx = createContext<ToastCtx | null>(null);
let seq = 0;

const ICON = { success: CheckCircle2, error: XCircle, info: Info } as const;
const TONE: Record<Kind, string> = {
  success: 'text-success',
  error: 'text-destructive',
  info: 'text-ring',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: Kind, message: string) => {
    const id = ++seq;
    setItems((l) => [...l.slice(-3), { id, kind, message }]);
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);
  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
        {items.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <motion.div key={t.id} layout
              initial={{ opacity: 0, transform: 'translateY(16px) scale(0.97)' }}
              animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
              exit={{ opacity: 0, transform: 'translateY(16px) scale(0.97)', transition: { duration: 0.15 } }}
              transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border bg-card p-3 text-sm shadow-float">
              <Icon className={cn('mt-0.5 size-4 shrink-0', TONE[t.kind])} aria-hidden />
              <p className="flex-1">{t.message}</p>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Fechar aviso" className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </motion.div>
          );
        })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast fora do ToastProvider');
  return v;
}
