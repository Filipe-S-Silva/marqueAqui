import { and, asc, count, desc, eq, gte, inArray, isNull, ne, sql } from 'drizzle-orm';
import {
  appointments,
  barberServices,
  barbers,
  breaks,
  services,
  shopReviews,
  shops,
  users,
  workingHours,
  type AppointmentStatus,
  type CancelReason,
  type DbOrTx,
  type NewAppointment,
} from '@marqueaqui/database';

/* ---------------------------------------------------------------- catálogo */

/** Empresa ativa com ao menos um serviço ativo e um profissional ativo que o realize. */
const bookableShop = sql`EXISTS (
  SELECT 1 FROM services s
  JOIN barber_services bs ON bs.service_id = s.id
  JOIN barbers b ON b.id = bs.barber_id AND b.active = true
  JOIN users u ON u.id = b.user_id AND u.active = true
  WHERE s.shop_id = ${shops.id} AND s.active = true
)`;

export async function searchBookableShops(db: DbOrTx, query: string | undefined, limit: number) {
  const conditions = [eq(shops.active, true), bookableShop];
  if (query) {
    const escaped = query.replace(/[\\%_]/g, (m) => `\\${m}`);
    conditions.push(sql`${shops.name} ILIKE ${'%' + escaped + '%'}`);
  }
  return db
    .select({
      id: shops.id,
      name: shops.name,
      description: shops.description,
      address: shops.address,
      phone: shops.phone,
      logoUrl: shops.logoUrl,
    })
    .from(shops)
    .where(and(...conditions))
    .orderBy(asc(shops.name))
    .limit(limit);
}

/** Leitura com trava compartilhada: espera uma desativação de empresa em andamento terminar. */
export async function getShopForShare(db: DbOrTx, id: number) {
  const [row] = await db.select().from(shops).where(eq(shops.id, id)).for('share').limit(1);
  return row;
}

export async function getShop(db: DbOrTx, id: number) {
  const [row] = await db.select().from(shops).where(eq(shops.id, id)).limit(1);
  return row;
}

export async function listActiveServicesWithProfessionals(db: DbOrTx, shopId: number) {
  const rows = await db
    .select({
      serviceId: services.id,
      name: services.name,
      description: services.description,
      durationMinutes: services.durationMinutes,
      priceCents: services.priceCents,
      barberId: barbers.id,
      barberName: users.name,
      barberPhoto: users.photoUrl,
    })
    .from(services)
    .leftJoin(barberServices, eq(barberServices.serviceId, services.id))
    .leftJoin(barbers, and(eq(barbers.id, barberServices.barberId), eq(barbers.active, true)))
    .leftJoin(users, and(eq(users.id, barbers.userId), eq(users.active, true)))
    .where(and(eq(services.shopId, shopId), eq(services.active, true)))
    .orderBy(asc(services.name), asc(users.name));

  const map = new Map<
    number,
    {
      id: number;
      name: string;
      description: string | null;
      durationMinutes: number;
      priceCents: number;
      professionals: Array<{ id: number; name: string; photoUrl: string | null }>;
    }
  >();
  for (const r of rows) {
    let s = map.get(r.serviceId);
    if (!s) {
      s = {
        id: r.serviceId,
        name: r.name,
        description: r.description,
        durationMinutes: r.durationMinutes,
        priceCents: r.priceCents,
        professionals: [],
      };
      map.set(r.serviceId, s);
    }
    if (r.barberId !== null && r.barberName !== null) {
      s.professionals.push({ id: r.barberId, name: r.barberName, photoUrl: r.barberPhoto });
    }
  }
  return [...map.values()];
}

export async function getActiveServiceInShop(db: DbOrTx, serviceId: number, shopId: number) {
  const [row] = await db
    .select()
    .from(services)
    .where(and(eq(services.id, serviceId), eq(services.shopId, shopId), eq(services.active, true)))
    .limit(1);
  return row;
}

/** Profissionais ativos (conta e vínculo) da empresa que realizam o serviço. */
export async function listBarbersForService(db: DbOrTx, shopId: number, serviceId: number) {
  return db
    .select({
      barberId: barbers.id,
      name: users.name,
      photoUrl: users.photoUrl,
      description: users.description,
    })
    .from(barberServices)
    .innerJoin(barbers, eq(barbers.id, barberServices.barberId))
    .innerJoin(users, eq(users.id, barbers.userId))
    .where(
      and(
        eq(barberServices.serviceId, serviceId),
        eq(barbers.shopId, shopId),
        eq(barbers.active, true),
        eq(users.active, true),
      ),
    )
    .orderBy(asc(users.name));
}

/** Profissional ativo (vínculo e conta) em empresa ativa, ou undefined. Sempre filtra pela empresa. */
export async function getBarberInShop(db: DbOrTx, barberId: number, shopId: number) {
  const [row] = await db
    .select({ id: barbers.id, userId: barbers.userId, shopId: barbers.shopId, name: users.name })
    .from(barbers)
    .innerJoin(users, eq(users.id, barbers.userId))
    .innerJoin(shops, eq(shops.id, barbers.shopId))
    .where(
      and(
        eq(barbers.id, barberId),
        eq(barbers.shopId, shopId),
        eq(barbers.active, true),
        eq(users.active, true),
        eq(shops.active, true),
      ),
    )
    .limit(1);
  return row;
}

export async function barberHasService(db: DbOrTx, barberId: number, serviceId: number): Promise<boolean> {
  const [row] = await db
    .select({ n: count() })
    .from(barberServices)
    .where(and(eq(barberServices.barberId, barberId), eq(barberServices.serviceId, serviceId)));
  return (row?.n ?? 0) > 0;
}

/* ---------------------------------------------- agenda (leituras em lote) */

export async function workingHoursFor(db: DbOrTx, barberIds: number[], weekday: number) {
  if (!barberIds.length) return [];
  return db
    .select({ barberId: workingHours.barberId, startTime: workingHours.startTime, endTime: workingHours.endTime })
    .from(workingHours)
    .where(and(inArray(workingHours.barberId, barberIds), eq(workingHours.weekday, weekday)))
    .orderBy(asc(workingHours.startTime));
}

export async function breaksFor(db: DbOrTx, barberIds: number[], date: string) {
  if (!barberIds.length) return [];
  return db
    .select({
      id: breaks.id,
      barberId: breaks.barberId,
      date: breaks.date,
      startTime: breaks.startTime,
      endTime: breaks.endTime,
      reason: breaks.reason,
    })
    .from(breaks)
    .where(and(inArray(breaks.barberId, barberIds), eq(breaks.date, date)))
    .orderBy(asc(breaks.startTime));
}

/** Agendamentos NÃO cancelados (bloqueiam horário). */
export async function activeAppointmentsFor(db: DbOrTx, barberIds: number[], date: string) {
  if (!barberIds.length) return [];
  return db
    .select({ barberId: appointments.barberId, startTime: appointments.startTime, endTime: appointments.endTime })
    .from(appointments)
    .where(
      and(
        inArray(appointments.barberId, barberIds),
        eq(appointments.date, date),
        ne(appointments.status, 'CANCELLED'),
      ),
    );
}

export async function listAgendaRows(db: DbOrTx, barberIds: number[], date: string) {
  if (!barberIds.length) return [];
  return db
    .select({
      id: appointments.id,
      barberId: appointments.barberId,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      durationMinutes: appointments.durationMinutes,
      priceCents: appointments.priceCents,
      status: appointments.status,
      clientId: appointments.clientId,
      clientName: appointments.clientName,
      clientPhone: appointments.clientPhone,
      serviceName: services.name,
      notes: appointments.notes,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(and(inArray(appointments.barberId, barberIds), eq(appointments.date, date)))
    .orderBy(asc(appointments.startTime));
}

/* ------------------------------------------------------- agendamentos */

export async function insertAppointment(db: DbOrTx, values: NewAppointment) {
  const [row] = await db.insert(appointments).values(values).returning();
  return row!;
}

export async function findAppointment(db: DbOrTx, id: number) {
  const [row] = await db.select().from(appointments).where(eq(appointments.id, id)).limit(1);
  return row;
}

export async function setAppointmentStatus(
  db: DbOrTx,
  id: number,
  from: AppointmentStatus,
  to: AppointmentStatus,
  cancel?: { reason: CancelReason; byUserId: number | null },
) {
  const [row] = await db
    .update(appointments)
    .set({
      status: to,
      cancelReason: cancel?.reason ?? null,
      cancelledAt: cancel ? new Date() : null,
      cancelledByUserId: cancel?.byUserId ?? null,
    })
    .where(and(eq(appointments.id, id), eq(appointments.status, from)))
    .returning();
  return row;
}

export async function listClientAppointments(
  db: DbOrTx,
  clientId: number,
  status: AppointmentStatus | undefined,
  page: number,
  pageSize: number,
) {
  const where = status
    ? and(eq(appointments.clientId, clientId), eq(appointments.status, status))
    : eq(appointments.clientId, clientId);

  const items = await db
    .select({
      id: appointments.id,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      durationMinutes: appointments.durationMinutes,
      priceCents: appointments.priceCents,
      status: appointments.status,
      cancelReason: appointments.cancelReason,
      serviceId: services.id,
      serviceName: services.name,
      shopId: shops.id,
      shopName: shops.name,
      professionalName: users.name,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(shops, eq(shops.id, appointments.shopId))
    .innerJoin(barbers, eq(barbers.id, appointments.barberId))
    .innerJoin(users, eq(users.id, barbers.userId))
    .where(where)
    .orderBy(desc(appointments.date), desc(appointments.startTime), desc(appointments.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [total] = await db.select({ n: count() }).from(appointments).where(where);
  return { items, total: total?.n ?? 0 };
}

export async function clientSummary(db: DbOrTx, clientId: number, today: string, nowTime: string) {
  const [next] = await db
    .select({
      id: appointments.id,
      date: appointments.date,
      startTime: appointments.startTime,
      serviceName: services.name,
      shopName: shops.name,
      professionalName: users.name,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(shops, eq(shops.id, appointments.shopId))
    .innerJoin(barbers, eq(barbers.id, appointments.barberId))
    .innerJoin(users, eq(users.id, barbers.userId))
    .where(
      and(
        eq(appointments.clientId, clientId),
        eq(appointments.status, 'CONFIRMED'),
        sql`(${appointments.date}, ${appointments.startTime}) > (${today}::date, ${nowTime})`,
      ),
    )
    .orderBy(asc(appointments.date), asc(appointments.startTime))
    .limit(1);

  const [stats] = await db
    .select({
      total: count(),
      completed: sql<number>`count(*) filter (where ${appointments.status} = 'COMPLETED')::int`,
      upcoming: sql<number>`count(*) filter (where ${appointments.status} = 'CONFIRMED' and (${appointments.date}, ${appointments.startTime}) > (${today}::date, ${nowTime}))::int`,
    })
    .from(appointments)
    .where(eq(appointments.clientId, clientId));

  return { next, total: stats?.total ?? 0, completed: stats?.completed ?? 0, upcoming: stats?.upcoming ?? 0 };
}

export async function countCompletedForClientInShop(db: DbOrTx, clientId: number, shopId: number): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(appointments)
    .where(
      and(eq(appointments.clientId, clientId), eq(appointments.shopId, shopId), eq(appointments.status, 'COMPLETED')),
    );
  return row?.n ?? 0;
}

/* ----------------------------------------------------------------- pausas */

export async function insertBreak(
  db: DbOrTx,
  v: { barberId: number; date: string; startTime: string; endTime: string; reason?: string | null },
) {
  const [row] = await db.insert(breaks).values(v).returning();
  return row!;
}

export async function listUpcomingBreaks(db: DbOrTx, barberId: number, fromDate: string) {
  return db
    .select()
    .from(breaks)
    .where(and(eq(breaks.barberId, barberId), gte(breaks.date, fromDate)))
    .orderBy(asc(breaks.date), asc(breaks.startTime))
    .limit(200);
}

export async function findBreakOfBarber(db: DbOrTx, id: number, barberId: number) {
  const [row] = await db
    .select()
    .from(breaks)
    .where(and(eq(breaks.id, id), eq(breaks.barberId, barberId)))
    .limit(1);
  return row;
}

export async function deleteBreak(db: DbOrTx, id: number): Promise<void> {
  await db.delete(breaks).where(eq(breaks.id, id));
}


/** Última reserva do cliente cuja empresa e serviço continuam ativos: base do "agendar de novo" (só local e serviço são reaproveitados). */
export async function lastClientBooking(db: DbOrTx, clientId: number) {
  const [row] = await db
    .select({
      shopId: shops.id, shopName: shops.name, serviceId: services.id, serviceName: services.name,
      durationMinutes: services.durationMinutes, priceCents: services.priceCents, professionalName: users.name, date: appointments.date,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(shops, eq(shops.id, appointments.shopId))
    .innerJoin(barbers, eq(barbers.id, appointments.barberId))
    .innerJoin(users, eq(users.id, barbers.userId))
    .where(and(eq(appointments.clientId, clientId), eq(services.active, true), eq(shops.active, true)))
    .orderBy(desc(appointments.createdAt))
    .limit(1);
  return row;
}

/** Atendimento concluído mais recente (últimos 30 dias) ainda sem avaliação: convite para avaliar. */
export async function pendingReviewFor(db: DbOrTx, clientId: number, sinceDate: string) {
  const [row] = await db
    .select({ id: appointments.id, date: appointments.date, serviceName: services.name, shopName: shops.name })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(shops, eq(shops.id, appointments.shopId))
    .leftJoin(shopReviews, eq(shopReviews.appointmentId, appointments.id))
    .where(and(eq(appointments.clientId, clientId), eq(appointments.status, 'COMPLETED'), gte(appointments.date, sinceDate), isNull(shopReviews.id)))
    .orderBy(desc(appointments.date), desc(appointments.startTime))
    .limit(1);
  return row;
}
