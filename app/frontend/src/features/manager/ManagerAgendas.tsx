import { useState } from 'react';
import { ErrorState, PageLoading } from '@/components/common/states';
import { Select } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAsync, errorMessage } from '@/hooks/useAsync';
import { api } from '@/lib/api';
import { todayInBrazil } from '@/lib/format';
import { AgendaColumn } from '@/features/staff/AgendaView';
import { BreakForm } from '@/features/staff/BreaksPanel';
import { DayNav } from '@/features/staff/DayNav';
import { StaffBookingDialog } from '@/features/staff/StaffBookingDialog';
import type { ManagerAgenda } from '@/features/staff/types';

export function ManagerAgendas() {
  const { activeShopId } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState(todayInBrazil());
  const [barberId, setBarberId] = useState<number | ''>('');
  const all = useAsync(() => api.get<ManagerAgenda>(`/manager/agenda?date=${date}`), [date, activeShopId]);
  const list = all.data?.barbers ?? [];
  const shown = barberId === '' ? list : list.filter((b) => b.barberId === barberId);

  async function deleteBreak(bid: number, id: number) {
    try { await api.del(`/staff/breaks/${id}?barberId=${bid}`); toast.push('success', 'Pausa removida.'); all.reload(); }
    catch (e) { toast.push('error', errorMessage(e)); }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Agendas da equipe</h1>
        {activeShopId !== null && list.length > 0 && (
          <StaffBookingDialog shopId={activeShopId} barbers={list.map((b) => ({ barberId: b.barberId, name: b.name }))} initialDate={date} onCreated={all.reload} />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <DayNav date={date} onChange={setDate} />
        <Select className="w-auto" aria-label="Filtrar por profissional" value={barberId} onChange={(e) => setBarberId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">Toda a equipe</option>
          {list.map((b) => <option key={b.barberId} value={b.barberId}>{b.name}</option>)}
        </Select>
      </div>
      {all.error ? <ErrorState message={all.error} onRetry={all.reload} /> : all.loading ? <PageLoading /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {shown.map((b) => <AgendaColumn key={b.barberId} agenda={b} date={date} onChanged={all.reload} onDeleteBreak={(id) => void deleteBreak(b.barberId, id)} />)}
        </div>
      )}
      {barberId !== '' && <BreakForm date={date} barberId={barberId} onCreated={all.reload} />}
    </div>
  );
}
