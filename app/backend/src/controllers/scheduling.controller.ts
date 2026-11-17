import { publicReviews } from '../services/support.service.ts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middlewares/authenticate.ts';
import { paginationSchema } from '../schemas/common.ts';
import * as s from '../schemas/scheduling.schemas.ts';
import * as svc from '../services/scheduling.service.ts';
import * as notif from '../services/notifications.service.ts';
import { created, ok } from '../utils/response.ts';
import { parse } from '../utils/validate.ts';

const ctxOf = (req: FastifyRequest) => req.server.ctx;

/* públicos */
export async function partners(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await svc.partners(ctxOf(req)));
}
export async function searchShops(req: FastifyRequest, reply: FastifyReply) {
  const { q } = parse(s.shopSearchQuery, req.query);
  return ok(reply, await svc.searchShops(ctxOf(req), q));
}
export async function shopServices(req: FastifyRequest, reply: FastifyReply) {
  const { shopId } = parse(s.shopIdParam, req.params);
  return ok(reply, await svc.shopServices(ctxOf(req), shopId));
}
export async function shopReviewsPublic(req: FastifyRequest, reply: FastifyReply) {
  const { shopId } = parse(s.shopIdParam, req.params);
  return ok(reply, await publicReviews(ctxOf(req), shopId));
}
export async function availability(req: FastifyRequest, reply: FastifyReply) {
  const { shopId } = parse(s.shopIdParam, req.params);
  const { serviceId, date } = parse(s.availabilityQuery, req.query);
  return ok(reply, await svc.availability(ctxOf(req), { shopId, serviceId, date }));
}

/* cliente */
export async function book(req: FastifyRequest, reply: FastifyReply) {
  const { shopId, serviceId, barberId, date, startTime } = parse(s.clientBookingBody, req.body);
  return created(reply, await svc.bookAsClient(ctxOf(req), requireAuth(req), { shopId, serviceId, barberId, date, startTime }), 'Agendamento confirmado.');
}
export async function myAppointments(req: FastifyRequest, reply: FastifyReply) {
  const { status, page, pageSize } = parse(s.myAppointmentsQuery, req.query);
  return ok(reply, await svc.myAppointments(ctxOf(req), requireAuth(req), { status, page, pageSize }));
}
export async function clientDashboard(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await svc.clientDashboard(ctxOf(req), requireAuth(req)));
}
export async function cancelMine(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parse(s.idParam, req.params);
  return ok(reply, await svc.cancelByClient(ctxOf(req), requireAuth(req), id), 'Agendamento cancelado.');
}

/* equipe */
export async function staffAgenda(req: FastifyRequest, reply: FastifyReply) {
  const { date } = parse(s.agendaQuery, req.query);
  return ok(reply, await svc.staffAgenda(ctxOf(req), requireAuth(req), date));
}
export async function managerAgenda(req: FastifyRequest, reply: FastifyReply) {
  const q = parse(s.managerAgendaQuery, req.query);
  return ok(reply, await svc.managerAgenda(ctxOf(req), requireAuth(req), q.date, q.barberId));
}
export async function staffBook(req: FastifyRequest, reply: FastifyReply) {
  const body = parse(s.staffBookingBody, req.body);
  return created(reply, await svc.bookAsStaff(ctxOf(req), requireAuth(req), body), 'Agendamento criado.');
}
export async function lookupClient(req: FastifyRequest, reply: FastifyReply) {
  const { email } = parse(s.lookupClientQuery, req.query);
  return ok(reply, await svc.lookupClient(ctxOf(req), requireAuth(req), email));
}
export async function staffCancel(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parse(s.idParam, req.params);
  return ok(reply, await svc.cancelByStaff(ctxOf(req), requireAuth(req), id), 'Agendamento cancelado.');
}
export async function staffComplete(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parse(s.idParam, req.params);
  return ok(reply, await svc.finishAppointment(ctxOf(req), requireAuth(req), id, 'COMPLETED'), 'Atendimento concluído.');
}
export async function staffNoShow(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parse(s.idParam, req.params);
  return ok(reply, await svc.finishAppointment(ctxOf(req), requireAuth(req), id, 'NO_SHOW'), 'Falta registrada.');
}

const barberQuery = z.object({ barberId: s.idParam.shape.id.optional() });
export async function createBreak(req: FastifyRequest, reply: FastifyReply) {
  const body = parse(s.breakBody, req.body);
  return created(reply, await svc.createBreak(ctxOf(req), requireAuth(req), body), 'Pausa criada.');
}
export async function listBreaks(req: FastifyRequest, reply: FastifyReply) {
  const { barberId } = parse(barberQuery, req.query);
  return ok(reply, await svc.listBreaks(ctxOf(req), requireAuth(req), barberId));
}
export async function deleteBreak(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parse(s.idParam, req.params);
  const { barberId } = parse(barberQuery, req.query);
  await svc.deleteBreak(ctxOf(req), requireAuth(req), id, barberId);
  return ok(reply, null, 'Pausa removida.');
}

/* notificações */
export async function notificationsPending(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await notif.pending(ctxOf(req), requireAuth(req)));
}
export async function notificationsList(req: FastifyRequest, reply: FastifyReply) {
  const { page, pageSize } = parse(paginationSchema, req.query);
  return ok(reply, await notif.list(ctxOf(req), requireAuth(req), page, pageSize));
}
export async function notificationAck(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parse(s.idParam, req.params);
  await notif.ack(ctxOf(req), requireAuth(req), id);
  return ok(reply, null, 'Aviso confirmado.');
}
export async function notificationRead(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parse(s.idParam, req.params);
  await notif.read(ctxOf(req), requireAuth(req), id);
  return ok(reply, null);
}
