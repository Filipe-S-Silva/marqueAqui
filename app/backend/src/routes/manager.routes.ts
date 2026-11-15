import type { FastifyInstance } from 'fastify';
import * as c from '../controllers/manager.controller.ts';
import { authenticate, authorize, requireBarber, requireShop } from '../middlewares/authenticate.ts';

export async function managerRoutes(app: FastifyInstance): Promise<void> {
  const mgr = { preHandler: [authenticate, authorize('MANAGER'), requireShop] };
  app.get('/manager/team', mgr, c.team);
  app.post('/manager/team', mgr, c.createProfessional);
  app.put('/manager/team/:barberId/services', mgr, c.setServices);
  app.put('/manager/team/:barberId/working-hours', mgr, c.setWorkingHours);
  app.post('/manager/team/:barberId/deactivate', mgr, c.deactivateProfessional);
  app.post('/manager/team/:barberId/reactivate', mgr, c.reactivateProfessional);
  app.get('/manager/services', mgr, c.listServices);
  app.post('/manager/services', mgr, c.createService);
  app.patch('/manager/services/:id', mgr, c.updateService);
  app.patch('/manager/shop', mgr, c.updateShop);
  app.get('/manager/reports/summary', mgr, c.report);
  app.get('/manager/reports/full', mgr, c.fullReport);
  app.get('/manager/dashboard', mgr, c.managerDashboard);
  app.post('/manager/me/professional', mgr, c.enableSelf);
  app.post('/manager/me/professional/disable', mgr, c.disableSelf);
  app.get('/manager/me/professional/impact', mgr, c.selfDisableImpact);
  app.get('/manager/managers', mgr, c.listManagers);
  app.post('/manager/managers', mgr, c.addManager);
  app.delete('/manager/services/:id', mgr, c.removeService);
  app.get('/manager/team/:barberId/affected.doc', mgr, c.affectedDoc);
  app.get('/staff/dashboard', { preHandler: [authenticate, authorize('PROFESSIONAL', 'MANAGER'), requireShop, requireBarber] }, c.staffDashboard);
  app.get('/manager/reports/export', mgr, c.exportMonth);

  // Perfil: qualquer usuário autenticado edita apenas o próprio
  app.patch('/profile', { preHandler: [authenticate] }, c.updateProfile);
}
