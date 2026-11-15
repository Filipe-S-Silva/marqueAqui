import { assetUrl } from '@/lib/api';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Foto de pessoa (profissional/gestor); sem foto, mostra as iniciais. */
export function Avatar({ name, photoUrl, className }: { name: string; photoUrl?: string | null; className?: string }) {
  const src = assetUrl(photoUrl);
  return src ? (
    <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className={cn('size-10 shrink-0 rounded-full border object-cover', className)} />
  ) : (
    <span aria-hidden className={cn('grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-xs font-extrabold text-secondary-foreground', className)}>
      {initials(name)}
    </span>
  );
}
