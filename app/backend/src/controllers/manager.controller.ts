import type { FastifyReply, FastifyRequest } from 'fastify';
import { requireAuth } from '../middlewares/authenticate.ts';
import * as m from '../schemas/manager.schemas.ts';
import { idParam } from '../schemas/scheduling.schemas.ts';
import * as svc from '../services/manager.service.ts';
import { created, ok, sendFile } from '../utils/response.ts';
import { parse } from '../utils/validate.ts';

const c = (req: FastifyRequest) => req.server.ctx;

export async function team(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await svc.team(c(req), requireAuth(req)));
}
export async function createProfessional(req: FastifyRequest, reply: FastifyReply) {
  const body = parse(m.createProfessionalBody, req.body);
  const r = await svc.createProfessional(c(req), requireAuth(req), body);
  return created(reply, r, r.linkedExisting ? 'Profissional já cadastrado vinculado à empresa.' : 'Profissional adicionado.');
}
export async function setServices(req: FastifyRequest, reply: FastifyReply) {
  const { barberId } = parse(m.barberIdParam, req.params);
  await svc.setServices(c(req), requireAuth(req), barberId, parse(m.barberServicesBody, req.body));
  return ok(reply, null, 'Serviços atualizados.');
}
export async function setWorkingHours(req: FastifyRequest, reply: FastifyReply) {
  const { barberId } = parse(m.barberIdParam, req.params);
  await svc.setWorkingHours(c(req), requireAuth(req), barberId, parse(m.workingHoursBody, req.body));
  return ok(reply, null, 'Horários atualizados.');
}
export async function deactivateProfessional(req: FastifyRequest, reply: FastifyReply) {
  const { barberId } = parse(m.barberIdParam, req.params);
  return ok(reply, await svc.deactivateProfessional(c(req), requireAuth(req), barberId), 'Profissional desativado.');
}
export async function reactivateProfessional(req: FastifyRequest, reply: FastifyReply) {
  const { barberId } = parse(m.barberIdParam, req.params);
  await svc.reactivateProfessional(c(req), requireAuth(req), barberId);
  return ok(reply, null, 'Profissional reativado.');
}

export async function listServices(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await svc.listServices(c(req), requireAuth(req)));
}
export async function createService(req: FastifyRequest, reply: FastifyReply) {
  return created(reply, await svc.createService(c(req), requireAuth(req), parse(m.createServiceBody, req.body)), 'Serviço criado.');
}
export async function updateService(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parse(idParam, req.params);
  return ok(reply, await svc.updateService(c(req), requireAuth(req), id, parse(m.updateServiceBody, req.body)), 'Serviço atualizado.');
}

export async function updateShop(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await svc.updateShop(c(req), requireAuth(req), parse(m.updateShopBody, req.body)), 'Empresa atualizada.');
}
export async function report(req: FastifyRequest, reply: FastifyReply) {
  const { month } = parse(m.reportQuery, req.query);
  return ok(reply, await svc.report(c(req), requireAuth(req), month));
}
export async function exportMonth(req: FastifyRequest, reply: FastifyReply) {
  const q = parse(m.exportQuery, req.query);
  const f = await svc.exportMonth(c(req), requireAuth(req), q.month, q.format);
  return sendFile(reply, f.filename, f.contentType, f.body);
}
export async function updateProfile(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await svc.updateProfile(c(req), requireAuth(req), parse(m.updateProfileBody, req.body)), 'Perfil atualizado.');
}

export async function enableSelf(req: FastifyRequest, reply: FastifyReply) {
  return created(reply, await svc.enableSelfAsProfessional(c(req), requireAuth(req)), 'Perfil de profissional habilitado.');
}
export async function disableSelf(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await svc.disableSelfAsProfessional(c(req), requireAuth(req)), 'Você deixou de atender nesta empresa.');
}
export async function selfDisableImpact(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await svc.selfDisableImpact(c(req), requireAuth(req)));
}
export async function listManagers(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await svc.listManagers(c(req), requireAuth(req)));
}
export async function addManager(req: FastifyRequest, reply: FastifyReply) {
  return created(reply, await svc.addManager(c(req), requireAuth(req), parse(m.createManagerBody, req.body)), 'Gestor adicionado.');
}
export async function removeService(req: FastifyRequest, reply: FastifyReply) {
  const { id } = parse(idParam, req.params);
  const r = await svc.removeService(c(req), requireAuth(req), id);
  return ok(reply, r, r.deleted ? 'Serviço excluído.' : 'Serviço com histórico: foi desativado.');
}
export async function affectedDoc(req: FastifyRequest, reply: FastifyReply) {
  const { barberId } = parse(m.barberIdParam, req.params);
  const f = await svc.affectedClientsDoc(c(req), requireAuth(req), barberId);
  return sendFile(reply, f.filename, f.contentType, f.body);
}
export async function managerDashboard(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await svc.managerDashboard(c(req), requireAuth(req)));
}
export async function staffDashboard(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await svc.staffDashboard(c(req), requireAuth(req)));
}
export async function fullReport(req: FastifyRequest, reply: FastifyReply) {
  const { month } = parse(m.reportQuery, req.query);
  return ok(reply, await svc.fullReport(c(req), requireAuth(req), month));
}
