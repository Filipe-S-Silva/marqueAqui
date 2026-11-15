import type { FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../middlewares/authenticate.ts';
import { idParam } from '../schemas/scheduling.schemas.ts';
import * as s from '../schemas/support.schemas.ts';
import * as svc from '../services/support.service.ts';
import { created, ok } from '../utils/response.ts';
import { parse } from '../utils/validate.ts';

const c = (req: FastifyRequest) => req.server.ctx;

export async function sendFeedback(req: FastifyRequest, reply: FastifyReply) {
  return created(reply, await svc.sendFeedback(c(req), requireAuth(req), parse(s.feedbackBody, req.body)), 'Feedback enviado. Obrigado!');
}
export async function myFeedback(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await svc.myFeedback(c(req), requireAuth(req)));
}
export async function openTicket(req: FastifyRequest, reply: FastifyReply) {
  return created(reply, await svc.openTicket(c(req), requireAuth(req), parse(s.ticketCreateBody, req.body)), 'Chamado aberto.');
}
export async function myTickets(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await svc.myTickets(c(req), requireAuth(req), parse(s.pageQuery, req.query)));
}
export async function myTicket(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parse(idParam, req.params);
  return ok(reply, await svc.myTicket(c(req), requireAuth(req), id));
}
export async function replyTicket(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parse(idParam, req.params);
  await svc.replyToMyTicket(c(req), requireAuth(req), id, parse(s.ticketMessageBody, req.body));
  return created(reply, null, 'Mensagem enviada.');
}
export async function closeTicket(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parse(idParam, req.params);
  await svc.closeMyTicket(c(req), requireAuth(req), id);
  return ok(reply, null, 'Chamado encerrado.');
}
export async function reviewAppointment(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parse(idParam, req.params);
  return created(reply, await svc.reviewAppointment(c(req), requireAuth(req), id, parse(s.reviewBody, req.body)), 'Avaliação enviada. Obrigado!');
}
export async function shopReviews(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await svc.shopReviews(c(req), requireAuth(req), parse(s.pageQuery, req.query)));
}
export async function replyReview(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parse(idParam, req.params);
  await svc.replyToReview(c(req), requireAuth(req), id, parse(s.reviewReplyBody, req.body));
  return ok(reply, null, 'Resposta publicada.');
}
