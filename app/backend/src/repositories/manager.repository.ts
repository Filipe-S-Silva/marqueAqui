import { and, asc, count, desc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import {
  appointments,
  barberServices,
  barbers,
  services,
  shopManagers,
  shops,
  users,
  workingHours,
  type DbOrTx,
} from '@marqueaqui/database';

/* equipe */
export async function listTeam(db: DbOrTx, shopId: number) {
  const rows = await db
    .select({
      barberId: barbers.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      photoUrl: users.photoUrl,
      description: users.description,
      active: barbers.active,
    })
    .from(barbers)
    .innerJoin(users, eq(users.id, barbers.userId))
    .where(eq(barbers.shopId, shopId))
    .orderBy(desc(barbers.active), asc(users.name));
  const ids = rows.map((r) => r.barberId);
  if (!ids.length) return [];
  const [bs, wh] = await Promise.all([
    db.select().from(barberServices).where(inArray(barberServices.barberId, ids)),
    db.select().from(workingHours).where(inArray(workingHours.barberId, ids)).orderBy(asc(workingHours.startTime)),
  ]);
  return rows.map((r) => ({
    ...r,
    serviceIds: bs.filter((x) => x.barberId === r.barberId).map((x) => x.serviceId),
    workingHours: wh
      .filter((x) => x.barberId === r.barberId)
      .map((x) => ({ weekday: x.weekday, startTime: x.startTime, endTime: x.endTime })),
  }));
}

export async function findBarberLink(db: DbOrTx, userId: number, shopId: number) {
  const [row] = await db
    .select()
    .from(barbers)
    .where(and(eq(barbers.userId, userId), eq(barbers.shopId, shopId)))
    .limit(1);
  return row;
}

export async function insertBarber(db: DbOrTx, userId: number, shopId: number) {
  const [row] = await db.insert(barbers).values({ userId, shopId }).returning();
  return row!;
}

export async function setBarberActive(db: DbOrTx, barberId: number, active: boolean) {
  await db
    .update(barbers)
    .set({ active, deactivatedAt: active ? null : new Date() })
    .where(eq(barbers.id, barberId));
}

export async function validServiceIds(db: DbOrTx, shopId: number, ids: number[]): Promise<number[]> {
  if (!ids.length) return [];
  const rows = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.shopId, shopId), inArray(services.id, ids)));
  return rows.map((r) => r.id);
}

export async function replaceBarberServices(db: DbOrTx, barberId: number, serviceIds: number[]) {
  await db.delete(barberServices).where(eq(barberServices.barberId, barberId));
  if (serviceIds.length) {
    await db.insert(barberServices).values(serviceIds.map((serviceId) => ({ barberId, serviceId })));
  }
}

export async function replaceWorkingHours(
  db: DbOrTx,
  barberId: number,
  rows: Array<{ weekday: number; startTime: string; endTime: string }>,
) {
  await db.delete(workingHours).where(eq(workingHours.barberId, barberId));
  if (rows.length) await db.insert(workingHours).values(rows.map((r) => ({ barberId, ...r })));
}

export async function futureConfirmedOfBarber(db: DbOrTx, barberId: number, today: string, nowTime: string) {
  return db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.barberId, barberId),
        eq(appointments.status, 'CONFIRMED'),
        sql`(${appointments.date}, ${appointments.startTime}) > (${today}, ${nowTime})`,
      ),
    );
}

export async function cancelAppointmentsByIds(db: DbOrTx, ids: number[], reason: 'PROFESSIONAL_DEACTIVATED') {
  if (!ids.length) return;
  await db
    .update(appointments)
    .set({ status: 'CANCELLED', cancelReason: reason, cancelledAt: new Date() })
    .where(and(inArray(appointments.id, ids), eq(appointments.status, 'CONFIRMED')));
}

/* serviços */
export async function listServices(db: DbOrTx, shopId: number) {
  return db.select().from(services).where(eq(services.shopId, shopId)).orderBy(desc(services.active), asc(services.name));
}

export async function insertService(
  db: DbOrTx,
  v: { shopId: number; name: string; description: string | null; durationMinutes: number; priceCents: number },
) {
  const [row] = await db.insert(services).values(v).returning();
  return row!;
}

export async function updateService(
  db: DbOrTx,
  id: number,
  shopId: number,
  v: Partial<{ name: string; description: string | null; durationMinutes: number; priceCents: number; active: boolean }>,
) {
  const [row] = await db
    .update(services)
    .set(v)
    .where(and(eq(services.id, id), eq(services.shopId, shopId)))
    .returning();
  return row;
}

/* empresa */
export async function updateShop(
  db: DbOrTx,
  id: number,
  v: Partial<{ name: string; description: string | null; address: string | null; phone: string | null; logoUrl: string | null }>,
) {
  const [row] = await db.update(shops).set(v).where(eq(shops.id, id)).returning();
  return row;
}

/* relatórios */
export async function monthAppointments(db: DbOrTx, shopId: number, start: string, end: string) {
  return db
    .select({
      id: appointments.id,
      barberId: appointments.barberId,
      serviceId: appointments.serviceId,
      clientId: appointments.clientId,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      priceCents: appointments.priceCents,
      clientName: appointments.clientName,
      clientPhone: appointments.clientPhone,
      serviceName: services.name,
      barberName: users.name,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(barbers, eq(barbers.id, appointments.barberId))
    .innerJoin(users, eq(users.id, barbers.userId))
    .where(and(eq(appointments.shopId, shopId), gte(appointments.date, start), lte(appointments.date, end)))
    .orderBy(asc(appointments.date), asc(appointments.startTime));
}

export async function countByStatus(db: DbOrTx, shopId: number, start: string, end: string) {
  return db
    .select({ status: appointments.status, n: count(), revenue: sql<number>`coalesce(sum(${appointments.priceCents}),0)::int` })
    .from(appointments)
    .where(and(eq(appointments.shopId, shopId), gte(appointments.date, start), lte(appointments.date, end), ne(appointments.status, 'CANCELLED')))
    .groupBy(appointments.status);
}

/* gestores */
export async function listManagers(db: DbOrTx, shopId: number) {
  return db
    .select({ userId: users.id, name: users.name, email: users.email, phone: users.phone, active: shopManagers.active })
    .from(shopManagers)
    .innerJoin(users, eq(users.id, shopManagers.userId))
    .where(eq(shopManagers.shopId, shopId))
    .orderBy(asc(users.name));
}

export async function managerUserIds(db: DbOrTx, shopId: number): Promise<number[]> {
  const rows = await db
    .select({ id: shopManagers.userId })
    .from(shopManagers)
    .innerJoin(users, eq(users.id, shopManagers.userId))
    .where(and(eq(shopManagers.shopId, shopId), eq(shopManagers.active, true), eq(users.active, true)));
  return rows.map((r) => r.id);
}

export async function insertManagerLink(db: DbOrTx, shopId: number, userId: number) {
  await db.insert(shopManagers).values({ shopId, userId }).onConflictDoUpdate({
    target: [shopManagers.shopId, shopManagers.userId],
    set: { active: true },
  });
}

/* serviços: exclusão */
export async function serviceHasAppointments(db: DbOrTx, serviceId: number): Promise<boolean> {
  const [row] = await db.select({ n: count() }).from(appointments).where(eq(appointments.serviceId, serviceId));
  return (row?.n ?? 0) > 0;
}

export async function deleteService(db: DbOrTx, id: number, shopId: number) {
  const rows = await db.delete(services).where(and(eq(services.id, id), eq(services.shopId, shopId))).returning({ id: services.id });
  return rows.length === 1;
}

/** Clientes afetados por uma desativação (para o documento .doc). */
export async function cancelledByDeactivation(db: DbOrTx, barberId: number) {
  return db
    .select({
      date: appointments.date,
      startTime: appointments.startTime,
      clientName: appointments.clientName,
      clientPhone: appointments.clientPhone,
      clientId: appointments.clientId,
      serviceName: services.name,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(and(eq(appointments.barberId, barberId), eq(appointments.status, 'CANCELLED'), eq(appointments.cancelReason, 'PROFESSIONAL_DEACTIVATED')))
    .orderBy(asc(appointments.date), asc(appointments.startTime));
}
