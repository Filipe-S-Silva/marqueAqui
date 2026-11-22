// Disponibilidade, criação de agendamentos e ações sobre a agenda (spec 6.3 a 6.5 e 7).
// O cálculo de horários vive no backend; o frontend só exibe o resultado.
import { annotateReviewed } from './support.service.ts';
import { and, eq, sql } from 'drizzle-orm';
import {
  LOCK_NS,
  MAX_DAYS_AHEAD,
  addDays,
  addDuration,
  checkSlot,
  listFreeSlots,
  minutesToTime,
  nowInBusinessTz,
  timeToMinutes,
  validateWorkingIntervals,
  weekdayOf,
  barbers as barbersTable,
  users as usersTable,
  type Appointment,
  type SlotRejection,
  type TimeInterval,
} from '@marqueaqui/database';
import type { z } from 'zod';
import { writeAudit } from '../repositories/audit.repository.ts';
import * as authRepo from '../repositories/auth.repository.ts';
import * as notificationsRepo from '../repositories/notifications.repository.ts';
import * as repo from '../repositories/scheduling.repository.ts';
import type { breakBody, staffBookingBody } from '../schemas/scheduling.schemas.ts';
import type { AppContext, AuthContext } from '../types/app-context.ts';
import { badRequest, conflict, forbidden, notFound, tooManyRequests, unprocessable } from '../utils/errors.ts';
import { maskPhone } from '../utils/documents.ts';

/* ---------------------------------------------------------------- helpers */

function slotRejectionToError(reason: SlotRejection) {
  switch (reason) {
    case 'CONFLICT':
      return conflict('Esse horário acabou de ser reservado. Escolha outro horário.', 'SLOT_TAKEN');
    case 'PAST':
      return unprocessable('Não é possível agendar em um horário que já passou.', 'SLOT_IN_PAST');
    case 'TOO_FAR':
      return unprocessable(`Escolha uma data dentro dos próximos ${MAX_DAYS_AHEAD} dias.`, 'DATE_TOO_FAR');
    case 'OUTSIDE_WORKING_HOURS':
      return unprocessable('Esse horário está fora do expediente do profissional.', 'OUTSIDE_WORKING_HOURS');
    case 'DURING_BREAK':
      return unprocessable('O profissional tem uma pausa nesse horário.', 'DURING_BREAK');
    case 'NOT_ON_GRID':
      return badRequest('Os horários seguem a grade de 30 minutos.', 'NOT_ON_GRID');
    default:
      return badRequest('Data, horário ou duração inválidos.', 'INVALID_SLOT');
  }
}

function hasStarted(appt: Pick<Appointment, 'date' | 'startTime'>, now = nowInBusinessTz()): boolean {
  return appt.date < now.date || (appt.date === now.date && timeToMinutes(appt.startTime) <= now.minutes);
}

function groupByBarber<T extends { barberId: number }>(rows: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const r of rows) {
    const list = map.get(r.barberId) ?? [];
    list.push(r);
    map.set(r.barberId, list);
  }
  return map;
}

const toInterval = (r: { startTime: string; endTime: string }): TimeInterval => ({
  startTime: r.startTime,
  endTime: r.endTime,
});

export function toMoney(cents: number): number {
  return Math.round(cents) / 100;
}

/* ---------------------------------------------------------------- catálogo */

export async function searchShops(ctx: AppContext, q: string | undefined) {
  return repo.searchBookableShops(ctx.db, q, 30);
}

export async function partners(ctx: AppContext) {
  const rows = await repo.searchBookableShops(ctx.db, undefined, 12);
  return rows.map((s) => ({ id: s.id, name: s.name, description: s.description, logoUrl: s.logoUrl }));
}

export async function shopServices(ctx: AppContext, shopId: number) {
  const shop = await repo.getShop(ctx.db, shopId);
  if (!shop || !shop.active) throw notFound('Empresa não encontrada.', 'SHOP_NOT_FOUND');
  return {
    shop: { id: shop.id, name: shop.name, description: shop.description, address: shop.address, phone: shop.phone, logoUrl: shop.logoUrl },
    services: (await repo.listActiveServicesWithProfessionals(ctx.db, shopId)).map((s) => ({
      ...s,
      price: toMoney(s.priceCents),
    })),
  };
}

/* ---------------------------------------------------------- disponibilidade */

export async function availability(ctx: AppContext, input: { shopId: number; serviceId: number; date: string }) {
  const now = nowInBusinessTz();
  if (input.date < now.date) throw unprocessable('Escolha uma data a partir de hoje.', 'DATE_IN_PAST');
  if (input.date > addDays(now.date, MAX_DAYS_AHEAD - 1)) {
    throw unprocessable(`Escolha uma data dentro dos próximos ${MAX_DAYS_AHEAD} dias.`, 'DATE_TOO_FAR');
  }

  const shop = await repo.getShop(ctx.db, input.shopId);
  if (!shop || !shop.active) throw notFound('Empresa não encontrada.', 'SHOP_NOT_FOUND');
  const service = await repo.getActiveServiceInShop(ctx.db, input.serviceId, input.shopId);
  if (!service) throw notFound('Serviço não encontrado.', 'SERVICE_NOT_FOUND');

  const barberList = await repo.listBarbersForService(ctx.db, input.shopId, input.serviceId);
  const ids = barberList.map((b) => b.barberId);
  const weekday = weekdayOf(input.date);
  const [wh, brk, appts] = await Promise.all([
    repo.workingHoursFor(ctx.db, ids, weekday),
    repo.breaksFor(ctx.db, ids, input.date),
    repo.activeAppointmentsFor(ctx.db, ids, input.date),
  ]);
  const whBy = groupByBarber(wh);
  const brkBy = groupByBarber(brk);
  const apBy = groupByBarber(appts);

  return {
    shop: { id: shop.id, name: shop.name },
    service: {
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      priceCents: service.priceCents,
      price: toMoney(service.priceCents),
    },
    date: input.date,
    professionals: barberList.map((b) => ({
      barberId: b.barberId,
      name: b.name,
      photoUrl: b.photoUrl,
      description: b.description,
      slots: listFreeSlots({
        date: input.date,
        durationMinutes: service.durationMinutes,
        working: (whBy.get(b.barberId) ?? []).map(toInterval),
        breaks: (brkBy.get(b.barberId) ?? []).map(toInterval),
        appointments: (apBy.get(b.barberId) ?? []).map(toInterval),
        now,
      }),
    })),
  };
}

/* ------------------------------------------------- criação (núcleo crítico) */

export interface BookParams {
  shopId: number;
  barberId: number;
  serviceId: number;
  date: string;
  startTime: string;
  client: { userId: number | null; name: string; phone: string | null };
  createdByUserId: number;
  notes?: string | undefined;
}

/**
 * Cria o agendamento dentro de uma transação, serializando reservas do mesmo profissional
 * com pg_advisory_xact_lock. Após obter a trava, TUDO é revalidado a partir do banco (spec 7.3).
 */
export async function bookSlot(ctx: AppContext, p: BookParams): Promise<Appointment> {
  return ctx.db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_NS.barberBooking}::int, ${p.barberId}::int)`);

    // Empresa desativada (ou sendo desativada pelo ADM) não aceita novas reservas
    const shop = await repo.getShopForShare(tx, p.shopId);
    if (!shop || !shop.active) throw notFound('Empresa não encontrada.', 'SHOP_NOT_FOUND');
    const barber = await repo.getBarberInShop(tx, p.barberId, p.shopId);
    if (!barber) throw notFound('Profissional não encontrado nesta empresa.', 'BARBER_NOT_FOUND');
    const service = await repo.getActiveServiceInShop(tx, p.serviceId, p.shopId);
    if (!service) throw notFound('Serviço não encontrado.', 'SERVICE_NOT_FOUND');
    if (!(await repo.barberHasService(tx, p.barberId, p.serviceId))) {
      throw unprocessable('Este profissional não realiza este serviço.', 'SERVICE_NOT_OFFERED');
    }

    const weekday = weekdayOf(p.date);
    const [wh, brk, appts] = await Promise.all([
      repo.workingHoursFor(tx, [p.barberId], weekday),
      repo.breaksFor(tx, [p.barberId], p.date),
      repo.activeAppointmentsFor(tx, [p.barberId], p.date),
    ]);

    const check = checkSlot({
      date: p.date,
      startTime: p.startTime,
      durationMinutes: service.durationMinutes,
      working: wh.map(toInterval),
      breaks: brk.map(toInterval),
      appointments: appts.map(toInterval),
      now: nowInBusinessTz(),
    });
    if (check.ok === false) throw slotRejectionToError(check.reason);

    try {
      return await repo.insertAppointment(tx, {
        shopId: p.shopId,
        barberId: p.barberId,
        serviceId: p.serviceId,
        clientId: p.client.userId,
        clientName: p.client.name,
        clientPhone: p.client.phone,
        date: p.date,
        startTime: p.startTime,
        endTime: addDuration(p.startTime, service.durationMinutes),
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
        status: 'CONFIRMED',
        createdByUserId: p.createdByUserId,
        notes: p.notes ?? null,
      });
    } catch (error) {
      // Rede de proteção do índice único parcial; na prática a trava já impede este caminho
      const code = (error as { code?: string; cause?: { code?: string } }).code ?? (error as { cause?: { code?: string } }).cause?.code;
      if (code === '23505') throw conflict('Esse horário acabou de ser reservado. Escolha outro horário.', 'SLOT_TAKEN');
      throw error;
    }
  });
}

function toAppointmentView(a: Appointment) {
  return {
    id: a.id,
    shopId: a.shopId,
    barberId: a.barberId,
    serviceId: a.serviceId,
    date: a.date,
    startTime: a.startTime,
    endTime: a.endTime,
    durationMinutes: a.durationMinutes,
    priceCents: a.priceCents,
    price: toMoney(a.priceCents),
    status: a.status,
  };
}

export async function bookAsClient(
  ctx: AppContext,
  auth: AuthContext,
  input: { shopId: number; serviceId: number; barberId: number; date: string; startTime: string },
) {
  const user = await authRepo.findUserById(ctx.db, auth.userId);
  if (!user) throw notFound('Usuário não encontrado.');
  const appt = await bookSlot(ctx, {
    ...input,
    client: { userId: user.id, name: user.name, phone: user.phone },
    createdByUserId: user.id,
  });
  await writeAudit(ctx.db, { actorType: 'USER', actorId: user.id, action: 'appointment.create', entityType: 'appointment', entityId: appt.id });
  return toAppointmentView(appt);
}

export async function bookAsStaff(ctx: AppContext, auth: AuthContext, input: z.infer<typeof staffBookingBody>) {
  if (auth.shopId === null) throw forbidden('Nenhuma empresa ativa vinculada à sua conta.', 'NO_ACTIVE_SHOP');
  let barberId: number;
  if (auth.role === 'PROFESSIONAL') {
    if (auth.barberId === null) throw forbidden('Você não atende nesta empresa.', 'NOT_A_BARBER');
    barberId = auth.barberId; // profissional só agenda na própria agenda
  } else {
    if (!input.barberId) throw badRequest('Informe o profissional.', 'BARBER_REQUIRED');
    barberId = input.barberId; // a empresa é revalidada em bookSlot (getBarberInShop)
  }

  let client: BookParams['client'];
  if (input.client.type === 'WALK_IN') {
    client = { userId: null, name: input.client.name, phone: input.client.phone };
  } else {
    const found = await authRepo.findUserByEmail(ctx.db, input.client.email);
    if (!found || found.role !== 'CLIENT' || !found.active) {
      throw notFound('Nenhum cliente encontrado com este e-mail.', 'CLIENT_NOT_FOUND');
    }
    client = { userId: found.id, name: found.name, phone: found.phone };
  }

  const appt = await bookSlot(ctx, {
    shopId: auth.shopId,
    barberId,
    serviceId: input.serviceId,
    date: input.date,
    startTime: input.startTime,
    client,
    createdByUserId: auth.userId,
    notes: input.notes,
  });
  await writeAudit(ctx.db, {
    actorType: 'USER',
    actorId: auth.userId,
    action: 'appointment.create_by_staff',
    entityType: 'appointment',
    entityId: appt.id,
    metadata: { walkIn: client.userId === null },
  });
  return toAppointmentView(appt);
}

export async function lookupClient(ctx: AppContext, auth: AuthContext, email: string) {
  if (auth.shopId === null) throw forbidden('Nenhuma empresa ativa vinculada à sua conta.', 'NO_ACTIVE_SHOP');
  const limit = await ctx.limiters.lookup.hit(`lookup|${auth.userId}`);
  if (limit.limited) throw tooManyRequests(limit.retryAfterSeconds);

  const user = await authRepo.findUserByEmail(ctx.db, email);
  if (!user || user.role !== 'CLIENT' || !user.active) {
    throw notFound('Nenhum cliente encontrado com este e-mail.', 'CLIENT_NOT_FOUND');
  }
  const previousAppointments = await repo.countCompletedForClientInShop(ctx.db, user.id, auth.shopId);
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'client.lookup', entityType: 'user', entityId: user.id, metadata: { shopId: auth.shopId } });
  // Necessidade (LGPD, Art. 6º, III): empresa sem histórico com o cliente vê só o primeiro nome
  if (!previousAppointments) {
    return { id: user.id, name: user.name.split(' ')[0] ?? '', photoUrl: null, phoneMasked: null, memberSince: null, previousAppointments };
  }
  // Dados mínimos para o cartão de conferência (spec 6.4): telefone mascarado, sem e-mail completo
  return {
    id: user.id,
    name: user.name,
    photoUrl: user.photoUrl,
    phoneMasked: maskPhone(user.phone),
    memberSince: user.createdAt,
    previousAppointments,
  };
}

/* ------------------------------------------------ consultas de agendamentos */

export async function myAppointments(
  ctx: AppContext,
  auth: AuthContext,
  q: { status: 'ALL' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'; page: number; pageSize: number },
) {
  const { items, total } = await repo.listClientAppointments(
    ctx.db,
    auth.userId, // o cliente só enxerga o que é dele
    q.status === 'ALL' ? undefined : q.status,
    q.page,
    q.pageSize,
  );
  const now = nowInBusinessTz();
  const annotated = await annotateReviewed(ctx, items);
  return {
    items: annotated.map((i) => ({
      ...i,
      price: toMoney(i.priceCents),
      canCancel: i.status === 'CONFIRMED' && !hasStarted(i, now),
    })),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

export async function clientDashboard(ctx: AppContext, auth: AuthContext) {
  const now = nowInBusinessTz();
  const s = await repo.clientSummary(ctx.db, auth.userId, now.date, minutesToTime(now.minutes));
  return {
    next: s.next ?? null,
    totalAppointments: s.total,
    completedAppointments: s.completed,
    upcomingAppointments: s.upcoming,
    pendingNotifications: await notificationsRepo.countPending(ctx.db, auth.userId),
    lastBooking: (await repo.lastClientBooking(ctx.db, auth.userId)) ?? null,
    pendingReview: (await repo.pendingReviewFor(ctx.db, auth.userId, addDays(now.date, -30))) ?? null,
  };
}

async function loadScoped(ctx: AppContext, auth: AuthContext, id: number): Promise<Appointment> {
  const appt = await repo.findAppointment(ctx.db, id);
  // 404 (e não 403) para não revelar a existência de agendamentos alheios
  if (!appt || auth.shopId === null || appt.shopId !== auth.shopId) throw notFound('Agendamento não encontrado.');
  if (auth.role === 'PROFESSIONAL' && appt.barberId !== auth.barberId) throw notFound('Agendamento não encontrado.');
  if (auth.role === 'CLIENT') throw forbidden();
  return appt;
}

/* ------------------------------------------------------------ cancelamento */

export async function cancelByClient(ctx: AppContext, auth: AuthContext, id: number) {
  const appt = await repo.findAppointment(ctx.db, id);
  if (!appt || appt.clientId !== auth.userId) throw notFound('Agendamento não encontrado.');
  if (appt.status !== 'CONFIRMED') {
    throw conflict('Apenas agendamentos confirmados podem ser cancelados.', 'NOT_CANCELLABLE');
  }
  if (hasStarted(appt)) throw unprocessable('Este horário já começou ou passou.', 'ALREADY_STARTED');

  const updated = await repo.setAppointmentStatus(ctx.db, id, 'CONFIRMED', 'CANCELLED', {
    reason: 'CLIENT',
    byUserId: auth.userId,
  });
  if (!updated) throw conflict('Este agendamento já foi alterado.', 'NOT_CANCELLABLE');
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'appointment.cancel_by_client', entityType: 'appointment', entityId: id });
  return toAppointmentView(updated);
}

export async function cancelByStaff(ctx: AppContext, auth: AuthContext, id: number) {
  const appt = await loadScoped(ctx, auth, id);
  if (appt.status !== 'CONFIRMED') {
    throw conflict('Apenas agendamentos confirmados podem ser cancelados.', 'NOT_CANCELLABLE');
  }
  const updated = await repo.setAppointmentStatus(ctx.db, id, 'CONFIRMED', 'CANCELLED', {
    reason: 'STAFF',
    byUserId: auth.userId,
  });
  if (!updated) throw conflict('Este agendamento já foi alterado.', 'NOT_CANCELLABLE');

  if (appt.clientId !== null) {
    await notificationsRepo.insertNotifications(ctx.db, [
      {
        userId: appt.clientId,
        type: 'APPOINTMENT_CANCELLED',
        title: 'Agendamento cancelado',
        message: `Seu agendamento de ${appt.date} às ${appt.startTime} foi cancelado pela empresa.`,
        data: { appointmentId: appt.id, date: appt.date, startTime: appt.startTime },
        requiresAck: true,
        sourceKey: `appt-cancel:${appt.id}`,
      },
    ]);
  }
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: 'appointment.cancel_by_staff', entityType: 'appointment', entityId: id });
  return toAppointmentView(updated);
}

/** Concluir e marcar falta só valem depois que o horário começou; validado aqui, no backend (spec 6.4). */
export async function finishAppointment(
  ctx: AppContext,
  auth: AuthContext,
  id: number,
  outcome: 'COMPLETED' | 'NO_SHOW',
) {
  const appt = await loadScoped(ctx, auth, id);
  if (appt.status !== 'CONFIRMED') {
    throw conflict('Apenas agendamentos confirmados podem ser finalizados.', 'NOT_FINISHABLE');
  }
  if (!hasStarted(appt)) {
    throw unprocessable('O atendimento ainda não começou.', 'NOT_STARTED');
  }
  const updated = await repo.setAppointmentStatus(ctx.db, id, 'CONFIRMED', outcome);
  if (!updated) throw conflict('Este agendamento já foi alterado.', 'NOT_FINISHABLE');
  await writeAudit(ctx.db, { actorType: 'USER', actorId: auth.userId, action: `appointment.${outcome.toLowerCase()}`, entityType: 'appointment', entityId: id });
  // Corte concluído: convida o cliente a avaliar (aparece nas notificações e no início da área do cliente)
  if (outcome === 'COMPLETED' && updated.clientId !== null) {
    await notificationsRepo.insertNotifications(ctx.db, [{
      userId: updated.clientId, type: 'INFO', title: 'Como foi seu atendimento?',
      message: 'Seu atendimento foi concluído. Conte como foi em Meus agendamentos > Avaliar.',
      data: { appointmentId: id }, requiresAck: false, sourceKey: `review-invite:${id}`,
    }]);
  }
  return toAppointmentView(updated);
}

/* ------------------------------------------------------------------ agendas */

async function buildAgenda(ctx: AppContext, barberList: Array<{ id: number; name: string; photoUrl: string | null }>, date: string) {
  const ids = barberList.map((b) => b.id);
  const weekday = weekdayOf(date);
  const [wh, brk, rows] = await Promise.all([
    repo.workingHoursFor(ctx.db, ids, weekday),
    repo.breaksFor(ctx.db, ids, date),
    repo.listAgendaRows(ctx.db, ids, date),
  ]);
  const whBy = groupByBarber(wh);
  const brkBy = groupByBarber(brk);
  const rowsBy = groupByBarber(rows);
  return barberList.map((b) => ({
    barberId: b.id,
    name: b.name,
    photoUrl: b.photoUrl,
    working: (whBy.get(b.id) ?? []).map(toInterval),
    breaks: (brkBy.get(b.id) ?? []).map((x) => ({ id: x.id, ...toInterval(x), reason: x.reason })),
    appointments: (rowsBy.get(b.id) ?? []).map((r) => ({ ...r, price: toMoney(r.priceCents) })),
  }));
}

export async function staffAgenda(ctx: AppContext, auth: AuthContext, date: string | undefined) {
  if (auth.shopId === null || auth.barberId === null) throw forbidden('Você não atende nesta empresa.', 'NOT_A_BARBER');
  const day = date ?? nowInBusinessTz().date;
  const barber = await repo.getBarberInShop(ctx.db, auth.barberId, auth.shopId);
  if (!barber) throw forbidden('Você não atende nesta empresa.', 'NOT_A_BARBER');
  const [agenda] = await buildAgenda(ctx, [{ id: barber.id, name: barber.name, photoUrl: barber.photoUrl }], day);
  return { date: day, ...agenda! };
}

export async function managerAgenda(ctx: AppContext, auth: AuthContext, date: string | undefined, barberId?: number) {
  if (auth.shopId === null) throw forbidden('Nenhuma empresa ativa vinculada à sua conta.', 'NO_ACTIVE_SHOP');
  const day = date ?? nowInBusinessTz().date;
  const rows = await ctx.db
    .select({ id: barbersTable.id, name: usersTable.name, photoUrl: usersTable.photoUrl })
    .from(barbersTable)
    .innerJoin(usersTable, eq(usersTable.id, barbersTable.userId))
    .where(
      and(
        eq(barbersTable.shopId, auth.shopId), // sempre a empresa da sessão, nunca um parâmetro do cliente
        eq(barbersTable.active, true),
        ...(barberId ? [eq(barbersTable.id, barberId)] : []),
      ),
    )
    .orderBy(usersTable.name);
  if (barberId && !rows.length) throw notFound('Profissional não encontrado nesta empresa.', 'BARBER_NOT_FOUND');
  return { date: day, barbers: await buildAgenda(ctx, rows, day) };
}

/* ------------------------------------------------------------------- pausas */

export async function createBreak(ctx: AppContext, auth: AuthContext, input: z.infer<typeof breakBody>) {
  if (auth.shopId === null) throw forbidden('Nenhuma empresa ativa vinculada à sua conta.', 'NO_ACTIVE_SHOP');
  let barberId: number;
  if (auth.role === 'PROFESSIONAL') {
    if (auth.barberId === null) throw forbidden('Você não atende nesta empresa.', 'NOT_A_BARBER');
    barberId = auth.barberId;
  } else {
    if (!input.barberId) throw badRequest('Informe o profissional.', 'BARBER_REQUIRED');
    barberId = input.barberId;
  }

  const valid = validateWorkingIntervals([{ startTime: input.startTime, endTime: input.endTime }]);
  if (valid.ok === false) throw unprocessable(valid.message, 'INVALID_BREAK');
  const now = nowInBusinessTz();
  if (input.date < now.date) throw unprocessable('Não é possível criar pausas em datas passadas.', 'DATE_IN_PAST');
  if (input.date === now.date && timeToMinutes(input.endTime) <= now.minutes) {
    throw unprocessable('Esse período já terminou.', 'DATE_IN_PAST');
  }

  return ctx.db.transaction(async (tx) => {
    // Mesma trava das reservas: pausa e agendamento nunca se atropelam
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${LOCK_NS.barberBooking}::int, ${barberId}::int)`);
    const barber = await repo.getBarberInShop(tx, barberId, auth.shopId!);
    if (!barber) throw notFound('Profissional não encontrado nesta empresa.', 'BARBER_NOT_FOUND');

    const appts = await repo.activeAppointmentsFor(tx, [barberId], input.date);
    const s = timeToMinutes(input.startTime);
    const e = timeToMinutes(input.endTime);
    if (appts.some((a) => s < timeToMinutes(a.endTime) && e > timeToMinutes(a.startTime))) {
      throw conflict('Existem clientes agendados nesse período. Cancele os agendamentos antes de bloquear.', 'BREAK_CONFLICT');
    }
    const created = await repo.insertBreak(tx, {
      barberId,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      reason: input.reason ?? null,
    });
    return { id: created.id, barberId, date: created.date, startTime: created.startTime, endTime: created.endTime, reason: created.reason };
  });
}

export async function listBreaks(ctx: AppContext, auth: AuthContext, barberIdParam?: number) {
  if (auth.shopId === null) throw forbidden('Nenhuma empresa ativa vinculada à sua conta.', 'NO_ACTIVE_SHOP');
  const barberId = auth.role === 'PROFESSIONAL' ? auth.barberId : (barberIdParam ?? auth.barberId);
  if (barberId === null || barberId === undefined) throw badRequest('Informe o profissional.', 'BARBER_REQUIRED');
  const barber = await repo.getBarberInShop(ctx.db, barberId, auth.shopId);
  if (!barber) throw notFound('Profissional não encontrado nesta empresa.', 'BARBER_NOT_FOUND');
  return repo.listUpcomingBreaks(ctx.db, barberId, nowInBusinessTz().date);
}

export async function deleteBreak(ctx: AppContext, auth: AuthContext, id: number, barberIdParam?: number) {
  if (auth.shopId === null) throw forbidden('Nenhuma empresa ativa vinculada à sua conta.', 'NO_ACTIVE_SHOP');
  const barberId = auth.role === 'PROFESSIONAL' ? auth.barberId : (barberIdParam ?? auth.barberId);
  if (barberId === null || barberId === undefined) throw badRequest('Informe o profissional.', 'BARBER_REQUIRED');
  const barber = await repo.getBarberInShop(ctx.db, barberId, auth.shopId);
  if (!barber) throw notFound('Profissional não encontrado nesta empresa.', 'BARBER_NOT_FOUND');
  const found = await repo.findBreakOfBarber(ctx.db, id, barberId);
  if (!found) throw notFound('Pausa não encontrada.');
  await repo.deleteBreak(ctx.db, id);
}
