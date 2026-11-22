import type { FastifyInstance } from 'fastify';
import * as c from '../controllers/auth.controller.ts';
import { authenticate, authenticateAllowingPasswordChange } from '../middlewares/authenticate.ts';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register', c.register);
  app.post('/login', c.login);
  app.post('/refresh', c.refresh);
  app.post('/forgot-password', c.forgotPassword);
  app.post('/reset-password', c.resetPassword);

  // Liberadas mesmo durante a troca obrigatória de senha
  const open = { preHandler: [authenticateAllowingPasswordChange] };
  app.get('/me', open, c.me);
  app.post('/logout', open, c.logout);
  app.post('/change-password', open, c.changePassword);
  app.post('/select-shop', open, c.selectShop);

  // Direitos do titular (LGPD, Arts. 18 e 19)
  app.get('/account/export', { preHandler: [authenticate] }, c.exportMyData);
  app.post('/account/delete', { preHandler: [authenticate] }, c.deleteMyAccount);
}
