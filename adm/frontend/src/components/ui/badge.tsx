import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badge = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    tone: {
      neutral: 'bg-muted text-muted-foreground',
      success: 'bg-success/15 text-success',
      warning: 'bg-warning/15 text-warning',
      danger: 'bg-destructive/15 text-destructive',
      info: 'bg-ring/15 text-ring',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export const Badge = ({ className, tone, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) => (
  <span className={cn(badge({ tone }), className)} {...p} />
);

export const STATUS_TONE = { CONFIRMED: 'info', COMPLETED: 'success', CANCELLED: 'danger', NO_SHOW: 'warning' } as const;
