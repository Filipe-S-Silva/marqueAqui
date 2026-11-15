import type { FastifyInstance } from 'fastify';
import * as c from '../controllers/support.controller.ts';
import { authenticate, authorize, requireShop } from '../middlewares/authenticate.ts';

export async function supportRoutes(app: FastifyInstance): Promise<void> {
  const anyUser = { preHandler: [authenticate] };
  app.post('/feedback', anyUser, c.sendFeedback);
  app.get('/feedback/mine', anyUser, c.myFeedback);
  app.post('/tickets', anyUser, c.openTicket);
  app.get('/tickets', anyUser, c.myTickets);
  app.get('/tickets/:id', anyUser, c.myTicket);
  app.post('/tickets/:id/messages', anyUser, c.replyTicket);
  app.post('/tickets/:id/close', anyUser, c.closeTicket);

  // Cliente avalia o próprio atendimento; gestor lê e responde as avaliações da empresa ativa
  app.post('/client/appointments/:id/review', { preHandler: [authenticate, authorize('CLIENT', 'PROFESSIONAL', 'MANAGER')] }, c.reviewAppointment);
  const mgr = { preHandler: [authenticate, authorize('MANAGER'), requireShop] };
  app.get('/manager/reviews', mgr, c.shopReviews);
  app.post('/manager/reviews/:id/reply', mgr, c.replyReview);
}
