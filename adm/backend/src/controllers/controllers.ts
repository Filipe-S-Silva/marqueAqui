import type { FastifyReply, FastifyRequest } from 'fastify';
import { confirmAdminPassword, requireAdmin } from '../middlewares/auth.ts';
import { writeAudit } from '../repositories/audit.repository.ts';
import * as s from '../schemas/admin.schemas.ts';
import { idParam } from '../schemas/common.ts';
import * as admins from '../services/admins.service.ts';
import * as audit from '../services/audit.service.ts';
import * as twofa from '../services/twofactor.service.ts';
import * as announcements from '../services/announcements.service.ts';
import * as auth from '../services/auth.service.ts';
import { dashboard } from '../services/dashboard.service.ts';
import * as support from '../services/support.service.ts';
import * as shops from '../services/shops.service.ts';
import * as users from '../services/users.service.ts';
import { created, ok, sendFile } from '../utils/response.ts';
import { parse } from '../utils/validate.ts';

const ctx = (r: FastifyRequest) => r.server.ctx;
type R = FastifyRequest; type P = FastifyReply;

/* auth */
const client = (r: R) => ({ ip: r.ip, userAgent: typeof r.headers['user-agent'] === 'string' ? r.headers['user-agent'] : undefined });
export const login = async (r: R, p: P) => ok(p, await auth.login(ctx(r), client(r), parse(s.loginBody, r.body)), 'Login realizado com sucesso.');
export const loginSecondStep = async (r: R, p: P) => ok(p, await auth.loginSecondStep(ctx(r), client(r), parse(s.challengeBody, r.body)), 'Login realizado com sucesso.');
export const me = async (r: R, p: P) => ok(p, await auth.me(ctx(r), requireAdmin(r).adminId));
// O logout APAGA a sessão no banco: o token deixa de funcionar na hora.
export const logout = async (r: R, p: P) => {
  const a = requireAdmin(r);
  await auth.logout(ctx(r), a.adminId, a.sessionId, r.ip);
  return ok(p, null, 'Sessão encerrada.');
};
export const changePassword = async (r: R, p: P) => {
  const a = requireAdmin(r);
  await auth.changePassword(ctx(r), a.adminId, a.sessionId, parse(s.changePasswordBody, r.body), r.ip);
  return ok(p, null, 'Senha alterada. As outras sessões foram encerradas.');
};
export const mySessions = async (r: R, p: P) => { const a = requireAdmin(r); return ok(p, await auth.mySessions(ctx(r), a.adminId, a.sessionId)); };
export const revokeOtherSessions = async (r: R, p: P) => {
  const b = parse(s.confirmOnly, r.body);
  const a = await confirmAdminPassword(r, b.adminPassword);
  return ok(p, await auth.revokeOtherSessions(ctx(r), a.adminId, a.sessionId, r.ip), 'Outras sessões encerradas.');
};
export const dash = async (r: R, p: P) => ok(p, await dashboard(ctx(r)));

/* empresas */
export const shopList = async (r: R, p: P) => ok(p, await shops.list(ctx(r), parse(s.shopListQuery, r.query)));
export const shopDetail = async (r: R, p: P) => ok(p, await shops.detail(ctx(r), parse(idParam, r.params).id));
export const shopCreate = async (r: R, p: P) => {
  const { adminPassword, ...body } = parse(s.createShopBody, r.body);
  const a = await confirmAdminPassword(r, adminPassword);
  return created(p, await shops.create(ctx(r), a.adminId, body), 'Empresa criada.');
};
export const shopUpdate = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const { adminPassword, ...body } = parse(s.updateShopBody, r.body);
  const a = await confirmAdminPassword(r, adminPassword);
  return ok(p, await shops.update(ctx(r), a.adminId, id, body), 'Empresa atualizada.');
};
export const shopActive = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const b = parse(s.activeBody, r.body);
  const a = await confirmAdminPassword(r, b.adminPassword);
  const res = await shops.setActive(ctx(r), a.adminId, id, b.active);
  return ok(p, res, b.active ? 'Empresa reativada.' : 'Empresa desativada.');
};
export const shopAddManager = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const { adminPassword, ...body } = parse(s.addManagerBody, r.body);
  const a = await confirmAdminPassword(r, adminPassword);
  return created(p, await shops.addManager(ctx(r), a.adminId, id, body), 'Gestor vinculado.');
};
export const shopManagerActive = async (r: R, p: P) => {
  const { id, userId } = parse(s.shopManagerParam, r.params);
  const b = parse(s.activeBody, r.body);
  const a = await confirmAdminPassword(r, b.adminPassword);
  await shops.setManagerActive(ctx(r), a.adminId, id, userId, b.active);
  return ok(p, null, 'Gestor atualizado.');
};

/* usuários */
export const userList = async (r: R, p: P) => {
  const { page, pageSize, ...f } = parse(s.userListQuery, r.query);
  return ok(p, await users.list(ctx(r), f, page, pageSize));
};
export const userExport = async (r: R, p: P) => {
  const { format, ...f } = parse(s.userExportQuery, r.query);
  const x = await users.exportUsers(ctx(r), f, format);
  if (x.truncated) p.header('X-Export-Truncated', 'true');
  return sendFile(p, x.filename, x.contentType, x.body);
};
export const userDetail = async (r: R, p: P) => ok(p, await users.detail(ctx(r), parse(idParam, r.params).id));
export const userCreate = async (r: R, p: P) => {
  const { adminPassword, ...body } = parse(s.createUserBody, r.body);
  const a = await confirmAdminPassword(r, adminPassword);
  return created(p, await users.create(ctx(r), a.adminId, body), 'Conta criada.');
};
export const userUpdate = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const { adminPassword, ...body } = parse(s.updateUserBody, r.body);
  const a = await confirmAdminPassword(r, adminPassword);
  return ok(p, await users.update(ctx(r), a.adminId, id, body), 'Usuário atualizado.');
};
export const userActive = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const b = parse(s.activeBody, r.body);
  const a = await confirmAdminPassword(r, b.adminPassword);
  return ok(p, await users.setActive(ctx(r), a.adminId, id, b.active), b.active ? 'Usuário reativado.' : 'Usuário desativado.');
};
export const userAddShop = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const b = parse(s.shopLinkBody, r.body);
  const a = await confirmAdminPassword(r, b.adminPassword);
  await users.addShopLink(ctx(r), a.adminId, id, b.shopId);
  return ok(p, null, 'Empresa vinculada.');
};
export const userRemoveShop = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const b = parse(s.shopLinkBody, r.body);
  const a = await confirmAdminPassword(r, b.adminPassword);
  await users.removeShopLink(ctx(r), a.adminId, id, b.shopId);
  return ok(p, null, 'Vínculo removido.');
};
export const userResetPassword = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const b = parse(s.resetUserPasswordBody, r.body);
  const a = await confirmAdminPassword(r, b.adminPassword);
  await users.resetPassword(ctx(r), a.adminId, id, b.email);
  return ok(p, null, 'Senha redefinida para a senha padrão. A troca será exigida no próximo login.');
};

/* administradores */
export const adminList = async (r: R, p: P) => ok(p, await admins.list(ctx(r)));
export const adminCreate = async (r: R, p: P) => {
  const { adminPassword, ...body } = parse(s.createAdminBody, r.body);
  const a = await confirmAdminPassword(r, adminPassword);
  return created(p, await admins.create(ctx(r), a.adminId, body), 'Administrador criado.');
};
export const adminRename = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const b = parse(s.renameAdminBody, r.body);
  const a = await confirmAdminPassword(r, b.adminPassword);
  return ok(p, await admins.rename(ctx(r), a.adminId, id, b.name), 'Administrador renomeado.');
};
export const adminResetPassword = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const b = parse(s.confirmOnly, r.body);
  const a = await confirmAdminPassword(r, b.adminPassword);
  await admins.resetPassword(ctx(r), a.adminId, id);
  return ok(p, null, 'Senha redefinida para a senha padrão.');
};
export const adminActive = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const b = parse(s.activeBody, r.body);
  const a = await confirmAdminPassword(r, b.adminPassword);
  return ok(p, await admins.setActive(ctx(r), a.adminId, id, b.active), b.active ? 'Administrador ativado.' : 'Administrador desativado.');
};

/* segurança de contas e plataforma */
export const userRevokeSessions = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const a = await confirmAdminPassword(r, parse(s.confirmOnly, r.body).adminPassword);
  return ok(p, await users.revokeSessions(ctx(r), a.adminId, id), 'Sessões encerradas.');
};
export const userUnlock = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const a = await confirmAdminPassword(r, parse(s.confirmOnly, r.body).adminPassword);
  await users.unlock(ctx(r), a.adminId, id);
  return ok(p, null, 'Conta desbloqueada.');
};
export const adminRevokeSessions = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const a = await confirmAdminPassword(r, parse(s.confirmOnly, r.body).adminPassword);
  return ok(p, await admins.revokeSessions(ctx(r), a.adminId, id), 'Sessões encerradas.');
};
export const adminUnlock = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const a = await confirmAdminPassword(r, parse(s.confirmOnly, r.body).adminPassword);
  await admins.unlock(ctx(r), a.adminId, id);
  return ok(p, null, 'Conta desbloqueada.');
};
export const auditList = async (r: R, p: P) => {
  const { page, pageSize, ...f } = parse(s.auditQuery, r.query);
  return ok(p, await audit.list(ctx(r), f, page, pageSize));
};
export const announcementSend = async (r: R, p: P) => {
  const { adminPassword, ...body } = parse(s.announcementBody, r.body);
  const a = await confirmAdminPassword(r, adminPassword);
  return created(p, await announcements.send(ctx(r), a.adminId, body), 'Comunicado enviado.');
};

/** Senha provisória que novos gestores recebem; o admin autenticado a vê para repassar ao gestor. */
export const defaults = async (r: R, p: P) => ok(p, { managerPassword: ctx(r).env.DEFAULT_PASSWORD });

/* suporte */
export const feedbackList = async (r: R, p: P) => ok(p, await support.listFeedbacks(ctx(r), parse(s.feedbackListQuery, r.query)));
export const feedbackStatus = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const { adminPassword, status } = parse(s.feedbackStatusBody, r.body);
  const a = await confirmAdminPassword(r, adminPassword);
  await support.setFeedbackStatus(ctx(r), a.adminId, id, status, r.ip);
  return ok(p, null, 'Feedback atualizado.');
};
export const ticketList = async (r: R, p: P) => ok(p, await support.listTickets(ctx(r), parse(s.ticketListQuery, r.query)));
export const ticketDetail = async (r: R, p: P) => ok(p, await support.ticketDetail(ctx(r), parse(idParam, r.params).id));
export const ticketReply = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const { adminPassword, message } = parse(s.ticketReplyBody, r.body);
  const a = await confirmAdminPassword(r, adminPassword);
  await support.replyTicket(ctx(r), a.adminId, id, message, r.ip);
  return created(p, null, 'Resposta enviada.');
};
export const ticketStatus = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const { adminPassword, status } = parse(s.ticketStatusBody, r.body);
  const a = await confirmAdminPassword(r, adminPassword);
  await support.setTicketStatus(ctx(r), a.adminId, id, status, r.ip);
  return ok(p, null, 'Chamado atualizado.');
};

/* 2FA (TOTP) */
export const twoFactorStatus = async (r: R, p: P) => ok(p, await twofa.status(ctx(r), requireAdmin(r).adminId));
export const twoFactorSetup = async (r: R, p: P) => {
  const a = await confirmAdminPassword(r, parse(s.confirmOnly, r.body).adminPassword);
  return ok(p, await twofa.setup(ctx(r), a.adminId), 'Leia o QR code e confirme com um código.');
};
export const twoFactorEnable = async (r: R, p: P) => {
  const a = requireAdmin(r);
  return ok(p, await twofa.enable(ctx(r), a.adminId, parse(s.twoFactorCodeBody, r.body).code, r.ip), '2FA ativado. Guarde os códigos de recuperação: eles não serão mostrados de novo.');
};
export const twoFactorRecoveryCodes = async (r: R, p: P) => {
  const b = parse(s.twoFactorConfirmBody, r.body);
  const a = await confirmAdminPassword(r, b.adminPassword);
  return ok(p, await twofa.regenerateRecoveryCodes(ctx(r), a.adminId, b.code, r.ip), 'Novos códigos gerados. Os anteriores deixaram de valer.');
};
export const twoFactorDisable = async (r: R, p: P) => {
  const b = parse(s.twoFactorConfirmBody, r.body);
  const a = await confirmAdminPassword(r, b.adminPassword);
  await twofa.disable(ctx(r), a.adminId, b.code, r.ip);
  return ok(p, null, '2FA desativado.');
};
export const adminResetTwoFactor = async (r: R, p: P) => {
  const { id } = parse(idParam, r.params);
  const a = await confirmAdminPassword(r, parse(s.confirmOnly, r.body).adminPassword);
  await twofa.resetFor(ctx(r), a.adminId, id);
  return ok(p, null, '2FA removido. As sessões desse administrador foram encerradas.');
};
