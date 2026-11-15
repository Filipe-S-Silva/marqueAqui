import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Número que conta até o valor final quando aparece. Sem movimento se o usuário pediu menos animação. */
export function CountUp({ value, format = (n: number) => String(Math.round(n)), className }: {
  value: number; format?: (n: number) => string; className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce) { if (el) el.textContent = format(value); return; }
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.23, 1, 0.32, 1],
      onUpdate: (v) => { el.textContent = format(v); },
    });
    return () => controls.stop();
    // format costuma ser inline; só o valor deve reiniciar a contagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);
  return <span ref={ref} className={cn('tnum', className)}>{format(value)}</span>;
}

/** Item de lista com entrada escalonada (até 8 itens; os demais entram juntos). */
export function Rise({ index = 0, className, children, as: Tag = 'div' }: {
  index?: number; className?: string; children: ReactNode; as?: 'div' | 'li';
}) {
  const style = { '--i': Math.min(index, 8) } as CSSProperties;
  return <Tag className={cn('rise', className)} style={style}>{children}</Tag>;
}
