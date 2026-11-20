import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;
export const DialogTitle = ({ className, ...p }: ComponentProps<typeof D.Title>) => (
  <D.Title className={cn('text-lg font-bold', className)} {...p} />
);
export const DialogDescription = ({ className, ...p }: ComponentProps<typeof D.Description>) => (
  <D.Description className={cn('text-sm text-muted-foreground', className)} {...p} />
);

interface ContentProps extends ComponentProps<typeof D.Content> {
  /** Sem botão de fechar nem fechamento por clique fora / Esc (diálogos obrigatórios). */
  blocking?: boolean;
  children: ReactNode;
}

export function DialogContent({ className, children, blocking, ...p }: ContentProps) {
  return (
    <D.Portal>
      <D.Overlay className="dlg-overlay fixed inset-0 z-50 bg-[#111827]/60 backdrop-blur-sm" />
      <D.Content
        onInteractOutside={blocking ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={blocking ? (e) => e.preventDefault() : undefined}
        className={cn(
          'dlg-content fixed left-1/2 top-1/2 z-50 grid max-h-[90vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-lg border bg-card p-6 shadow-float',
          className,
        )}
        {...p}
      >
        {children}
        {!blocking && (
          <D.Close aria-label="Fechar" className="absolute right-4 top-4 rounded-sm text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </D.Close>
        )}
      </D.Content>
    </D.Portal>
  );
}
