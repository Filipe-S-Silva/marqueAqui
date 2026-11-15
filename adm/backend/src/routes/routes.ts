import type { FastifyInstance } from 'fastify';
import * as c from '../controllers/controllers.ts';
import { authenticateAdmin } from '../middlewares/auth.ts';

export async function routes(app: FastifyInstance): Promise<void> {
  app.post('/auth/login', c.login);
  app.post('/auth/login/2fa', c.loginSecondStep);
  const pre = { preHandler: [authenticateAdmin] };
  app.get('/auth/me', pre, c.me);
  app.post('/auth/logout', pre, c.logout);
  app.post('/auth/change-password', pre, c.changePassword);
  app.get('/auth/2fa', pre, c.twoFactorStatus);
  app.post('/auth/2fa/setup', pre, c.twoFactorSetup);
  app.post('/auth/2fa/enable', pre, c.twoFactorEnable);
  app.post('/auth/2fa/recovery-codes', pre, c.twoFactorRecoveryCodes);
  app.post('/auth/2fa/disable', pre, c.twoFactorDisable);
  app.get('/auth/sessions', pre, c.mySessions);
  app.post('/auth/sessions/revoke-others', pre, c.revokeOtherSessions);
  app.get('/dashboard', pre, c.dash);
  app.get('/audit', pre, c.auditList);
  app.post('/announcements', pre, c.announcementSend);

  app.get('/defaults', pre, c.defaults);
  app.get('/feedbacks', pre, c.feedbackList);
  app.post('/feedbacks/:id/status', pre, c.feedbackStatus);
  app.get('/tickets', pre, c.ticketList);
  app.get('/tickets/:id', pre, c.ticketDetail);
  app.post('/tickets/:id/messages', pre, c.ticketReply);
  app.post('/tickets/:id/status', pre, c.ticketStatus);

  app.get('/shops', pre, c.shopList);
  app.post('/shops', pre, c.shopCreate);
  app.get('/shops/:id', pre, c.shopDetail);
  app.patch('/shops/:id', pre, c.shopUpdate);
  app.post('/shops/:id/status', pre, c.shopActive);
  app.post('/shops/:id/managers', pre, c.shopAddManager);
  app.post('/shops/:id/managers/:userId/status', pre, c.shopManagerActive);

  app.get('/users', pre, c.userList);
  app.get('/users/export', pre, c.userExport);
  app.post('/users', pre, c.userCreate);
  app.get('/users/:id', pre, c.userDetail);
  app.patch('/users/:id', pre, c.userUpdate);
  app.post('/users/:id/status', pre, c.userActive);
  app.post('/users/:id/shops', pre, c.userAddShop);
  app.post('/users/:id/shops/remove', pre, c.userRemoveShop);
  app.post('/users/:id/reset-password', pre, c.userResetPassword);
  app.post('/users/:id/revoke-sessions', pre, c.userRevokeSessions);
  app.post('/users/:id/unlock', pre, c.userUnlock);

  app.get('/admins', pre, c.adminList);
  app.post('/admins', pre, c.adminCreate);
  app.patch('/admins/:id', pre, c.adminRename);
  app.post('/admins/:id/reset-password', pre, c.adminResetPassword);
  app.post('/admins/:id/status', pre, c.adminActive);
  app.post('/admins/:id/revoke-sessions', pre, c.adminRevokeSessions);
  app.post('/admins/:id/unlock', pre, c.adminUnlock);
  app.post('/admins/:id/reset-2fa', pre, c.adminResetTwoFactor);
}
