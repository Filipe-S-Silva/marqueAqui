import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addDaysIso, todayInBrazil } from '@/lib/format';

export function DayNav({ date, onChange }: { date: string; onChange: (d: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => onChange(addDaysIso(date, -1))} aria-label="Dia anterior"><ChevronLeft className="size-4" /></Button>
      <Input type="date" className="w-auto" aria-label="Data da agenda" value={date} onChange={(e) => e.target.value && onChange(e.target.value)} />
      <Button variant="outline" size="icon" onClick={() => onChange(addDaysIso(date, 1))} aria-label="Próximo dia"><ChevronRight className="size-4" /></Button>
      <Button variant="ghost" size="sm" onClick={() => onChange(todayInBrazil())}>Hoje</Button>
    </div>
  );
}
