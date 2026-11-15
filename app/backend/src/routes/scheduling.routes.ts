import type { FastifyInstance } from 'fastify';
import * as c from '../controllers/scheduling.controller.ts';
import { authenticate, authorize, requireBarber, requireShop } from '../middlewares/authenticate.ts';

export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/public/partners', c.partners);
  app.get('/public/shops', c.searchShops);
  app.get('/public/shops/:shopId/services', c.shopServices);
  app.get('/public/shops/:shopId/availability', c.availability);
  app.get('/public/shops/:shopId/reviews', c.shopReviewsPublic);
}

export async function clientRoutes(app: FastifyInstance): Promise<void> {
  const pre = { preHandler: [authenticate, authorize('CLIENT', 'PROFESSIONAL', 'MANAGER')] };
  app.get('/client/dashboard', pre, c.clientDashboard);
  app.get('/client/appointments', pre, c.myAppointments);
  app.post('/client/appointments', pre, c.book);
  app.post('/client/appointments/:id/cancel', pre, c.cancelMine);
}

export async function staffRoutes(app: FastifyInstance): Promise<void> {
  const both = { preHandler: [authenticate, authorize('PROFESSIONAL', 'MANAGER'), requireShop] };
  const pro = { preHandler: [authenticate, authorize('PROFESSIONAL', 'MANAGER'), requireShop, requireBarber] };
  const mgr = { preHandler: [authenticate, authorize('MANAGER'), requireShop] };

  app.get('/staff/agenda', pro, c.staffAgenda);
  app.get('/manager/agenda', mgr, c.managerAgenda);
  app.post('/staff/appointments', both, c.staffBook);
  app.get('/staff/clients/lookup', both, c.lookupClient);
  app.post('/staff/appointments/:id/cancel', both, c.staffCancel);
  app.post('/staff/appointments/:id/complete', both, c.staffComplete);
  app.post('/staff/appointments/:id/no-show', both, c.staffNoShow);
  app.get('/staff/breaks', both, c.listBreaks);
  app.post('/staff/breaks', both, c.createBreak);
  app.delete('/staff/breaks/:id', both, c.deleteBreak);
}

export async function notificationRoutes(app: FastifyInstance): Promise<void> {
  const pre = { preHandler: [authenticate] };
  app.get('/notifications', pre, c.notificationsList);
  app.get('/notifications/pending', pre, c.notificationsPending);
  app.post('/notifications/:id/ack', pre, c.notificationAck);
  app.post('/notifications/:id/read', pre, c.notificationRead);
}
