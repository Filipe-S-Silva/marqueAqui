import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Estrelas somente leitura. */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex gap-0.5', className)} role="img" aria-label={`${value} de 5 estrelas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn('size-4', n <= value ? 'fill-warning text-warning' : 'text-muted-foreground/50')} aria-hidden />
      ))}
    </span>
  );
}

/** Seletor de nota 1–5 acessível (grupo de rádios). */
export function StarPicker({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
          onClick={() => onChange(n)} className="rounded p-1 transition-transform duration-150 active:scale-95">
          <Star className={cn('size-7 transition-colors', n <= value ? 'fill-warning text-warning' : 'text-muted-foreground/50')} aria-hidden />
        </button>
      ))}
    </div>
  );
}
