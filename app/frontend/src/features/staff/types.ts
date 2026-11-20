export interface AgendaAppointment {
  id: number; barberId: number; startTime: string; endTime: string; durationMinutes: number; price: number;
  status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  clientName: string; clientPhone: string | null; serviceName: string; notes: string | null;
}
export interface AgendaBreak { id: number; startTime: string; endTime: string; reason: string | null }
export interface BarberAgenda {
  barberId: number; name: string; photoUrl: string | null;
  working: Array<{ startTime: string; endTime: string }>;
  breaks: AgendaBreak[]; appointments: AgendaAppointment[];
}
export interface StaffAgenda extends BarberAgenda { date: string }
export interface ManagerAgenda { date: string; barbers: BarberAgenda[] }
