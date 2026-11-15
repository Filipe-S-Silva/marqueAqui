export interface ShopCard { id: number; name: string; description: string | null; address: string | null; phone: string | null; logoUrl: string | null }
export interface ServiceItem {
  id: number; name: string; description: string | null; durationMinutes: number; priceCents: number; price: number;
  professionals: Array<{ id: number; name: string; photoUrl: string | null }>;
}
export interface ShopServices { shop: Omit<ShopCard, 'logoUrl'>; services: ServiceItem[] }
export interface ProfessionalSlots { barberId: number; name: string; photoUrl: string | null; description: string | null; slots: string[] }
export interface Availability {
  shop: { id: number; name: string };
  service: { id: number; name: string; durationMinutes: number; priceCents: number; price: number };
  date: string;
  professionals: ProfessionalSlots[];
}
export interface AppointmentRow {
  id: number; date: string; startTime: string; endTime: string; durationMinutes: number; priceCents: number; price: number;
  status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'; canCancel: boolean; canReview?: boolean; reviewed?: boolean;
  serviceName?: string; shopName?: string; professionalName?: string; shopId?: number; serviceId?: number;
}
export interface ClientDashboardData {
  next: { id: number; date: string; startTime: string; serviceName: string; shopName: string; professionalName: string } | null;
  totalAppointments: number; completedAppointments: number; upcomingAppointments: number; pendingNotifications: number;
  lastBooking: { shopId: number; shopName: string; serviceId: number; serviceName: string; professionalName: string; durationMinutes: number; priceCents: number } | null;
  pendingReview: { id: number; date: string; serviceName: string; shopName: string } | null;
}
export interface Paged<T> { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
