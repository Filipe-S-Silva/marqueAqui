import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '../middlewares/authenticate.ts';
import { requireAuth } from '../middlewares/authenticate.ts';
import * as svc from '../services/photo.service.ts';
import { MAX_PHOTO_BYTES } from '../utils/image.ts';
import { parse } from '../utils/validate.ts';
import { created, ok } from '../utils/response.ts';

const idParam = z.object({ id: z.coerce.number().int().positive() });

export async function photoRoutes(app: FastifyInstance): Promise<void> {
  // Corpo binário cru (sem multipart): só nesta rota/escopo e com limite próprio de 5 MB
  app.addContentTypeParser(['image/jpeg', 'image/png', 'image/webp'], { parseAs: 'buffer', bodyLimit: MAX_PHOTO_BYTES + 1024 },
    (_req, body, done) => done(null, body));

  app.put('/profile/photo', { preHandler: [authenticate], bodyLimit: MAX_PHOTO_BYTES + 1024 }, async (req, reply) =>
    created(reply, await svc.savePhoto(req.server.ctx, requireAuth(req), req.body), 'Foto atualizada.'));
  app.delete('/profile/photo', { preHandler: [authenticate] }, async (req, reply) => {
    await svc.removePhoto(req.server.ctx, requireAuth(req));
    return ok(reply, null, 'Foto removida.');
  });

  app.get('/photos/:id', async (req, reply) => {
    const { id } = parse(idParam, req.params);
    const p = await svc.readPhoto(req.server.ctx, id);
    return reply
      .header('Content-Type', p.contentType)
      .header('Cache-Control', 'public, max-age=31536000, immutable') // a URL muda (?v=) a cada troca
      .header('Cross-Origin-Resource-Policy', 'cross-origin')
      .send(p.data);
  });
}
