import { z } from 'zod';
import {
  dateSchema,
  emailSchema,
  idSchema,
  nameSchema,
  paginationSchema,
  phoneSchema,
  timeSchema,
} from './common.ts';

export const shopSearchQuery = z.object({ q: z.string().trim().max(80).optional() });
export const shopIdParam = z.object({ shopId: idSchema });
export const idParam = z.object({ id: idSchema });

export const availabilityQuery = z.object({
  serviceId: idSchema,
  date: dateSchema,
});

export const clientBookingBody = z.object({
  shopId: idSchema,
  serviceId: idSchema,
  barberId: idSchema,
  date: dateSchema,
  startTime: timeSchema,
});

export const myAppointmentsQuery = paginationSchema.extend({
  status: z.enum(['ALL', 'CONFIRMED', 'COMPLETED', 'CANCELLED']).default('ALL'),
});

export const agendaQuery = z.object({ date: dateSchema.optional() });
export const managerAgendaQuery = z.object({ date: dateSchema.optional(), barberId: idSchema.optional() });

const walkInClient = z.object({
  type: z.literal('WALK_IN'),
  name: nameSchema,
  phone: phoneSchema,
});
const registeredClient = z.object({
  type: z.literal('REGISTERED'),
  email: emailSchema,
  // Confirmação explícita de identidade exigida pelo spec 6.4
  confirmed: z.literal(true, { error: 'Confirme que é este cliente.' }),
});

export const staffBookingBody = z.object({
  serviceId: idSchema,
  date: dateSchema,
  startTime: timeSchema,
  /** Obrigatório para gestor; ignorado para profissional (usa a própria agenda). */
  barberId: idSchema.optional(),
  client: z.discriminatedUnion('type', [walkInClient, registeredClient]),
  notes: z.string().trim().max(500).optional(),
});

export const lookupClientQuery = z.object({ email: emailSchema });

export const breakBody = z.object({
  date: dateSchema,
  startTime: timeSchema,
  endTime: timeSchema,
  reason: z.string().trim().max(120).optional(),
  barberId: idSchema.optional(),
});
