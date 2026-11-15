import { clearAdminLockout, hashPassword } from '@marqueaqui/database';
import { writeAudit } from '../repositories/audit.repository.ts';
import * as repo from '../repositories/admins.repository.ts';
import * as sessionsRepo from '../repositories/admin-sessions.repository.ts';
import type { AppContext } from '../types/context.ts';
import { conflict, notFound, unprocessable } from '../utils/errors.ts';
import { emailHmac } from '../utils/hmac.ts';

const view = (a: { id: number; name: string; active: boolean }) => ({ id: a.id, name: a.name, active: a.active });

export async function list(ctx: AppContext) {
  const rows = await repo.list(ctx.db);
  const now = Date.now();
  return Promise.all(rows.map(async (a) => ({
    id: a.id, name: a.name, active: a.active, lastLoginAt: a.lastLoginAt, createdAt: a.createdAt, mustChangePassword: a.mustChangePassword,
    locked: a.lockedUntil !== null && a.lockedUntil.getTime() > now,
    twoFactorEnabled: a.totpEnabledAt !== null,
    activeSessions: await sessionsRepo.countActive(ctx.db, a.id),
  })));
}

export async function create(ctx: AppContext, actor: number, input: { name: string; email: string; password: string }) {
  const hmac = emailHmac(input.email, ctx.env.ADMIN_EMAIL_PEPPER);
  if (await repo.findByHmac(ctx.db, hmac)) throw conflict('Já existe um administrador com este e-mail.', 'ADMIN_EXISTS');
  const a = await repo.insert(ctx.db, { name: input.name, emailHmac: hmac, passwordHash: await hashPassword(input.password), mustChangePassword: true });
  await writeAudit(ctx.db, { actorType: 'ADMIN', actorId: actor, action: 'admin.create', entityType: 'admin', entityId: a.id });
  return view(a);
}

export async function rename(ctx: AppContext, actor: number, id: number, name: string) {
  const a = await repo.update(ctx.db, id, { name });
  if (!a) throw notFound('Administrador não encontrado.');
  await writeAudit(ctx.db, { actorType: 'ADMIN', actorId: actor, action: 'admin.rename', entityType: 'admin', entityId: id });
  return view(a);
}

/** O e-mail só existe como HMAC; a redefinição é feita pelo id da conta já listada. */
export async function resetPassword(ctx: AppContext, actor: number, id: number) {
  if (!(await repo.findById(ctx.db, id))) throw notFound('Administrador não encontrado.');
  await ctx.db.transaction(async (tx) => {
    // Senha provisória + troca obrigatória; encerra sessões e bloqueio da conta
    await repo.update(tx, id, { passwordHash: await hashPassword(ctx.env.DEFAULT_PASSWORD), mustChangePassword: true });
    await sessionsRepo.deleteAllFor(tx, id);
    await clearAdminLockout(tx, id);
    await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: 'admin.reset_password', entityType: 'admin', entityId: id });
  });
}

/** Encerra todas as sessões de outro administrador (inclusive a de quem pede, se for a própria conta). */
export async function revokeSessions(ctx: AppContext, actor: number, id: number) {
  if (!(await repo.findById(ctx.db, id))) throw notFound('Administrador não encontrado.');
  const n = await sessionsRepo.deleteAllFor(ctx.db, id);
  await writeAudit(ctx.db, { actorType: 'ADMIN', actorId: actor, action: 'admin.revoke_sessions', entityType: 'admin', entityId: id, metadata: { count: n } });
  return { revoked: n };
}

export async function unlock(ctx: AppContext, actor: number, id: number) {
  if (!(await repo.findById(ctx.db, id))) throw notFound('Administrador não encontrado.');
  await clearAdminLockout(ctx.db, id);
  await writeAudit(ctx.db, { actorType: 'ADMIN', actorId: actor, action: 'admin.unlock', entityType: 'admin', entityId: id });
}

export async function setActive(ctx: AppContext, actor: number, id: number, active: boolean) {
  return ctx.db.transaction(async (tx) => {
    const target = await repo.findById(tx, id);
    if (!target) throw notFound('Administrador não encontrado.');
    if (!active) {
      // Trava 1: ninguém desativa a própria conta. Trava 2: nunca o último ativo.
      if (id === actor) throw unprocessable('Você não pode desativar a própria conta.', 'SELF_DEACTIVATION');
      if (target.active && (await repo.countActiveExcept(tx, id)) === 0) {
        throw unprocessable('Não é possível desativar o último administrador ativo.', 'LAST_ADMIN');
      }
    }
    const a = await repo.update(tx, id, { active });
    if (!active) await sessionsRepo.deleteAllFor(tx, id);
    await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: active ? 'admin.activate' : 'admin.deactivate', entityType: 'admin', entityId: id });
    return view(a!);
  });
}
