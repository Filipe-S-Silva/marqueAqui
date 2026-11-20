import { CalendarCheck } from 'lucide-react';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-extrabold tracking-tight', className)}>
      {/* em: o ícone acompanha o tamanho do texto (menu, rodapé e o logo grande do hero) */}
      <span className="grid size-[1.75em] place-items-center rounded-md bg-primary text-primary-foreground shadow-card">
        <CalendarCheck className="size-[1em]" aria-hidden />
      </span>
      <span className="font-display text-[1.1em]">Marque<span className="text-primary">Aqui</span></span>
    </span>
  );
}

/** Logo da empresa; sem logo, até três iniciais do nome. */
export function ShopAvatar({ name, logoUrl, className }: { name: string; logoUrl?: string | null; className?: string }) {
  return logoUrl ? (
    <img src={logoUrl} alt="" referrerPolicy="no-referrer" className={cn('size-12 rounded-lg border object-cover', className)} />
  ) : (
    <span aria-hidden className={cn('grid size-12 place-items-center rounded-lg bg-secondary text-sm font-extrabold text-secondary-foreground', className)}>
      {initials(name)}
    </span>
  );
}
