import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BrandMark } from '@/components/common/Logo';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api';

export function AuthShell({ title, subtitle, children, footer, hideBack }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; hideBack?: boolean }) {
  return (
    // Barra superior no fluxo (não absoluta): no celular o "Voltar ao início" não sobrepõe mais o logo
    <div className="flex min-h-screen flex-col p-4">
      <div className="flex items-center justify-between">
        {!hideBack ? (
          <Button asChild variant="ghost" size="sm">
            <Link to="/"><ArrowLeft className="size-4" aria-hidden /> Voltar ao início</Link>
          </Button>
        ) : <span />}
        <ThemeToggle />
      </div>
      <div className="mx-auto my-auto w-full max-w-md py-6">
        <Link to="/" className="mb-6 flex justify-center text-xl"><BrandMark /></Link>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </CardHeader>
          <CardContent className="grid gap-4">{children}</CardContent>
        </Card>
        {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

/** Erros de validação do backend por campo. */
export function fieldErrors(e: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (e instanceof ApiError) for (const it of e.errors) if (!out[it.path]) out[it.path] = it.message;
  return out;
}
