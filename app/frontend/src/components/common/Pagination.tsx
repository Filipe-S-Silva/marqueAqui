import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-2">
      <Button variant="outline" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>
        <ChevronLeft className="size-4" aria-hidden /> Anterior
      </Button>
      <span className="text-sm text-muted-foreground" aria-current="page">Página {page} de {totalPages}</span>
      <Button variant="outline" size="sm" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>
        Próxima <ChevronRight className="size-4" aria-hidden />
      </Button>
    </nav>
  );
}
