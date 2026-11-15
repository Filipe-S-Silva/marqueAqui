import { useState, type FormEvent } from 'react';
import { Field } from '@/components/common/Field';
import { Alert } from '@/components/common/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/contexts/ToastContext';
import { errorMessage } from '@/hooks/useAsync';
import { api } from '@/lib/api';

export function BreakForm({ date, barberId, onCreated }: { date: string; barberId?: number | undefined; onCreated: () => void }) {
  const toast = useToast();
  const [start, setStart] = useState('12:00');
  const [end, setEnd] = useState('13:00');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.post('/staff/breaks', { date, startTime: start, endTime: end, ...(reason ? { reason } : {}), ...(barberId ? { barberId } : {}) });
      toast.push('success', 'Pausa criada.');
      setReason('');
      onCreated();
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader><CardTitle>Bloquear horário</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate>
          {error && <div className="sm:col-span-2"><Alert tone="error">{error}</Alert></div>}
          <Field label="Início"><Input type="time" step={1800} value={start} onChange={(e) => setStart(e.target.value)} required /></Field>
          <Field label="Fim"><Input type="time" step={1800} value={end} onChange={(e) => setEnd(e.target.value)} required /></Field>
          <div className="sm:col-span-2"><Field label="Motivo (opcional)"><Input value={reason} maxLength={120} onChange={(e) => setReason(e.target.value)} /></Field></div>
          <p className="text-xs text-muted-foreground sm:col-span-2">Vale para o dia selecionado. Não é possível bloquear horários que já têm cliente agendado.</p>
          <Button type="submit" loading={busy} className="sm:col-span-2">Criar pausa</Button>
        </form>
      </CardContent>
    </Card>
  );
}
