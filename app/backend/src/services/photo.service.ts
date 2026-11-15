import { eq } from 'drizzle-orm';
import { userPhotos, users } from '@marqueaqui/database';
import { writeAudit } from '../repositories/audit.repository.ts';
import type { AppContext, AuthContext } from '../types/app-context.ts';
import { MAX_PHOTO_BYTES, sniffImage } from '../utils/image.ts';
import { notFound, tooManyRequests, unprocessable, validationError } from '../utils/errors.ts';

/** Grava a foto do próprio usuário (profissional ou gestor) e aponta users.photo_url para ela. */
export async function savePhoto(ctx: AppContext, auth: AuthContext, body: unknown) {
  if (auth.role === 'CLIENT') throw unprocessable('Foto é exclusiva de profissionais e gestores.', 'PHOTO_NOT_ALLOWED');
  const r = await ctx.limiters.submit.hit(`photo|${auth.userId}`);
  if (r.limited) throw tooManyRequests(r.retryAfterSeconds);
  if (!Buffer.isBuffer(body) || body.length === 0) throw validationError('Envie a imagem no corpo da requisição.');
  if (body.length > MAX_PHOTO_BYTES) throw unprocessable('A foto deve ter no máximo 5 MB.', 'PHOTO_TOO_LARGE');
  const type = sniffImage(body);
  if (!type) throw unprocessable('Use uma imagem PNG, JPEG ou WebP.', 'PHOTO_INVALID');
  const version = Date.now();
  await ctx.db.transaction(async (tx) => {
    await tx.insert(userPhotos).values({ userId: auth.userId, contentType: type, data: body, sizeBytes: body.length })
      .onConflictDoUpdate({ target: userPhotos.userId, set: { contentType: type, data: body, sizeBytes: body.length, updatedAt: new Date() } });
    await tx.update(users).set({ photoUrl: `/photos/${auth.userId}?v=${version}`, updatedAt: new Date() }).where(eq(users.id, auth.userId));
    await writeAudit(tx, { actorType: 'USER', actorId: auth.userId, action: 'user.photo_set', entityType: 'user', entityId: auth.userId, metadata: { sizeBytes: body.length } });
  });
  return { photoUrl: `/photos/${auth.userId}?v=${version}` };
}

export async function removePhoto(ctx: AppContext, auth: AuthContext) {
  await ctx.db.transaction(async (tx) => {
    await tx.delete(userPhotos).where(eq(userPhotos.userId, auth.userId));
    await tx.update(users).set({ photoUrl: null, updatedAt: new Date() }).where(eq(users.id, auth.userId));
    await writeAudit(tx, { actorType: 'USER', actorId: auth.userId, action: 'user.photo_remove', entityType: 'user', entityId: auth.userId });
  });
}

/** Leitura pública, só de contas ativas de profissional/gestor (as mesmas fotos que o cliente já vê ao agendar). */
export async function readPhoto(ctx: AppContext, userId: number) {
  const [row] = await ctx.db
    .select({ data: userPhotos.data, contentType: userPhotos.contentType, role: users.role, active: users.active })
    .from(userPhotos)
    .innerJoin(users, eq(users.id, userPhotos.userId))
    .where(eq(userPhotos.userId, userId))
    .limit(1);
  if (!row || !row.active || row.role === 'CLIENT') throw notFound('Foto não encontrada.');
  return row;
}
