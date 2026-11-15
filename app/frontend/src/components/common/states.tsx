import { AlertTriangle, CalendarX2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card/50 p-8 text-center">
      <span className="mb-1 grid size-12 place-items-center rounded-full bg-secondary text-secondary-foreground"><CalendarX2 className="size-6" aria-hidden /></span>
      <p className="font-semibold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
      <AlertTriangle className="size-6 text-destructive" aria-hidden />
      <p className="text-sm">{message}</p>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Tentar novamente</Button>}
    </div>
  );
}

export function PageLoading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
      <span className="pole pole-move h-1.5 w-24 overflow-hidden rounded-full" aria-hidden /> {label}
    </div>
  );
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const cls = { info: 'border-ring/40 bg-ring/10', error: 'border-destructive/40 bg-destructive/10', success: 'border-success/40 bg-success/10' }[tone];
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md border p-3 text-sm ${cls}`}>{children}</div>;
}
