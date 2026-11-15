import { randomUUID } from 'node:crypto';
import { and, eq, sql, type SQL } from 'drizzle-orm';
import { barbers, shopManagers, users, type NewNotification } from '@marqueaqui/database';
import { writeAudit } from '../repositories/audit.repository.ts';
import { insertNotifications } from '../repositories/notifications.repository.ts';
import * as shopsRepo from '../repositories/shops.repository.ts';
import type { AppContext } from '../types/context.ts';
import { notFound, unprocessable } from '../utils/errors.ts';

export type Audience = 'ALL' | 'CLIENT' | 'PROFESSIONAL' | 'MANAGER' | 'SHOP';
const MAX_RECIPIENTS = 20_000;

/**
 * Comunicado da plataforma: uma notificação INFO por usuário ATIVO do público escolhido. Idempotente por
 * (usuário, sourceKey). Com `requiresAck`, aparece na janela bloqueante pós-login até o usuário clicar em "Entendi".
 */
export async function send(ctx: AppContext, actor: number, input: { title: string; message: string; audience: Audience; shopId?: number | undefined; requiresAck: boolean }) {
  const cond: SQL[] = [eq(users.active, true)];
  if (input.audience === 'CLIENT' || input.audience === 'PROFESSIONAL' || input.audience === 'MANAGER') cond.push(eq(users.role, input.audience));
  if (input.audience === 'SHOP') {
    if (!input.shopId) throw unprocessable('Informe a empresa do comunicado.', 'SHOP_REQUIRED');
    if (!(await shopsRepo.find(ctx.db, input.shopId))) throw notFound('Empresa não encontrada.');
    cond.push(sql`(EXISTS (SELECT 1 FROM ${shopManagers} sm WHERE sm.user_id = ${users.id} AND sm.shop_id = ${input.shopId} AND sm.active = true)
      OR EXISTS (SELECT 1 FROM ${barbers} b WHERE b.user_id = ${users.id} AND b.shop_id = ${input.shopId} AND b.active = true))`);
  }
  const recipients = await ctx.db.select({ id: users.id }).from(users).where(and(...cond)).limit(MAX_RECIPIENTS + 1);
  if (recipients.length > MAX_RECIPIENTS) throw unprocessable(`Público acima de ${MAX_RECIPIENTS} usuários. Restrinja por classe ou empresa.`, 'AUDIENCE_TOO_LARGE');
  if (!recipients.length) throw unprocessable('Nenhum usuário ativo neste público.', 'EMPTY_AUDIENCE');

  const announcementId = randomUUID();
  await ctx.db.transaction(async (tx) => {
    const rows: NewNotification[] = recipients.map((r) => ({
      userId: r.id, type: 'INFO', title: input.title, message: input.message, requiresAck: input.requiresAck,
      sourceKey: `announcement:${announcementId}`, data: { announcementId },
    }));
    await insertNotifications(tx, rows);
    await writeAudit(tx, {
      actorType: 'ADMIN', actorId: actor, action: 'announcement.send', entityType: 'announcement', entityId: announcementId,
      metadata: { audience: input.audience, shopId: input.shopId ?? null, recipients: recipients.length, requiresAck: input.requiresAck, titleLength: input.title.length },
    });
  });
  return { announcementId, recipients: recipients.length };
}
