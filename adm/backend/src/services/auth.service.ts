import {
  clearAdminLockout, getDummyHash, hashPassword, isLocked, registerFailedAdminLogin, verifyPassword,
} from '@marqueaqui/database';
import { writeAudit } from '../repositories/audit.repository.ts';
import * as adminsRepo from '../repositories/admins.repository.ts';
import * as sessionsRepo from '../repositories/admin-sessions.repository.ts';
import * as twoFactorRepo from '../repositories/twofactor.repository.ts';
import * as twofa from './twofactor.service.ts';
import type { Admin } from '@marqueaqui/database';
import type { AppContext } from '../types/context.ts';
import { randomToken, sha256Hex } from '../utils/crypto.ts';
import { tooManyRequests, unauthorized, unprocessable } from '../utils/errors.ts';
import { emailHmac } from '../utils/hmac.ts';

const GENERIC = 'Nome, e-mail ou senha inválidos.';

/**
 * Login por nome + e-mail + senha. Camadas: 5 falhas por IP a cada 15 min (limitador) e 5 senhas erradas por
 * conta bloqueiam 15 min (contador atômico no SQL). Conta inexistente, inativa, bloqueada ou com nome errado
 * gastam o mesmo tempo (uma verificação de hash) e devolvem a MESMA mensagem.
 */
export async function login(ctx: AppContext, client: { ip: string; userAgent?: string | undefined }, input: { name: string; email: string; password: string }) {
  const gate = await ctx.limiters.loginIp.peek(client.ip);
  if (gate.limited) throw tooManyRequests(gate.retryAfterSeconds);

  const admin = await adminsRepo.findByHmac(ctx.db, emailHmac(input.email, ctx.env.ADMIN_EMAIL_PEPPER));
  const locked = admin !== undefined && isLocked(admin);
  const check = await verifyPassword(admin && !locked ? admin.passwordHash : await getDummyHash(), input.password);
  const nameOk = admin !== undefined && admin.name.trim().toLowerCase() === input.name.trim().toLowerCase();

  if (!admin || locked || !admin.active || !check.valid || !nameOk) {
    await ctx.limiters.loginIp.hit(client.ip);
    // Só conta contra a conta quando ela existe e não está bloqueada (evita estender o bloqueio indefinidamente)
    if (admin && !locked) await registerFailedAdminLogin(ctx.db, admin.id);
    // Com a conta identificada, o registro fica atribuído a ela (filtro por administrador); senão, sem administrador
    await writeAudit(ctx.db, { ...(admin ? { actorType: 'ADMIN' as const, actorId: admin.id } : { actorType: 'SYSTEM' as const }), action: locked ? 'admin.login_blocked' : 'admin.login_failed', ip: client.ip });
    throw unauthorized(GENERIC, 'INVALID_CREDENTIALS');
  }
  if (check.needsRehash) await adminsRepo.update(ctx.db, admin.id, { passwordHash: await hashPassword(input.password) });

  if (twofa.isEnabled(admin)) {
    // 2FA ativo: NÃO cria sessão. O contador de bloqueio só é zerado depois do segundo fator,
    // senão quem sabe a senha poderia tentar códigos indefinidamente reiniciando a primeira etapa.
    const token = twofa.newChallengeToken();
    await twoFactorRepo.createChallenge(ctx.db, { adminId: admin.id, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS), ip: client.ip });
    return { twoFactorRequired: true as const, challengeToken: token, expiresInSeconds: CHALLENGE_TTL_MS / 1000 };
  }
  await ctx.limiters.loginIp.reset(client.ip);
  await clearAdminLockout(ctx.db, admin.id);
  return startSession(ctx, admin, client);
}

const CHALLENGE_TTL_MS = 5 * 60_000;
const MAX_CHALLENGE_ATTEMPTS = 5;
const SECOND_STEP_ERROR = 'Código inválido ou expirado. Entre novamente se precisar.';

async function startSession(ctx: AppContext, admin: Admin, client: { ip: string; userAgent?: string | undefined }, method?: 'totp' | 'recovery') {
  await adminsRepo.update(ctx.db, admin.id, { lastLoginAt: new Date() });
  await sessionsRepo.purgeExpired(ctx.db, admin.id);
  const token = randomToken(32); // 256 bits; só o SHA-256 vai para o banco
  const expiresAt = new Date(Date.now() + ctx.env.ADMIN_SESSION_TTL_SECONDS * 1000);
  await sessionsRepo.create(ctx.db, { adminId: admin.id, tokenHash: sha256Hex(token), expiresAt, ip: client.ip, userAgent: client.userAgent });
  await writeAudit(ctx.db, { actorType: 'ADMIN', actorId: admin.id, action: 'admin.login', ip: client.ip, ...(method ? { metadata: { secondFactor: method } } : {}) });
  if (method === 'recovery') await writeAudit(ctx.db, { actorType: 'ADMIN', actorId: admin.id, action: 'admin.login_2fa_recovery', ip: client.ip });
  return { twoFactorRequired: false as const, accessToken: token, expiresInSeconds: ctx.env.ADMIN_SESSION_TTL_SECONDS, admin: adminView(ctx, admin) };
}

export const adminView = (ctx: AppContext, a: Admin) => ({
  id: a.id, name: a.name, mustChangePassword: a.mustChangePassword,
  twoFactorEnabled: twofa.isEnabled(a), twoFactorSetupRequired: twofa.setupRequired(ctx, a),
});

/** Etapa 2 do login: desafio (5 min, até 5 tentativas) + código TOTP de 6 dígitos ou código de recuperação. */
export async function loginSecondStep(ctx: AppContext, client: { ip: string; userAgent?: string | undefined }, input: { challengeToken: string; code: string }) {
  const gate = await ctx.limiters.loginIp.peek(client.ip);
  if (gate.limited) throw tooManyRequests(gate.retryAfterSeconds);
  const fail = async (adminId?: number): Promise<never> => {
    await ctx.limiters.loginIp.hit(client.ip);
    if (adminId !== undefined) {
      await registerFailedAdminLogin(ctx.db, adminId); // erros de 2FA contam para o bloqueio da conta
      await writeAudit(ctx.db, { actorType: 'ADMIN', actorId: adminId, action: 'admin.login_2fa_failed', ip: client.ip });
    }
    throw unauthorized(SECOND_STEP_ERROR, 'INVALID_CODE');
  };

  const ch = await twoFactorRepo.findChallenge(ctx.db, sha256Hex(input.challengeToken));
  if (!ch) return fail();
  const attempts = await twoFactorRepo.bumpChallengeAttempts(ctx.db, ch.id);
  if (attempts > MAX_CHALLENGE_ATTEMPTS) {
    await twoFactorRepo.deleteChallenge(ctx.db, ch.id);
    return fail();
  }
  const admin = await adminsRepo.findById(ctx.db, ch.adminId);
  if (!admin || !admin.active || isLocked(admin)) return fail();

  const method = await twofa.verifySecondFactor(ctx, ctx.db, admin, input.code);
  if (!method) return fail(admin.id);

  await twoFactorRepo.deleteChallenge(ctx.db, ch.id);
  await ctx.limiters.loginIp.reset(client.ip);
  await clearAdminLockout(ctx.db, admin.id);
  return startSession(ctx, admin, client, method);
}

export async function me(ctx: AppContext, adminId: number) {
  const a = await adminsRepo.findById(ctx.db, adminId);
  if (!a || !a.active) throw unauthorized('Sessão inválida.', 'SESSION_INVALID');
  return adminView(ctx, a);
}

export async function logout(ctx: AppContext, adminId: number, sessionId: string, ip: string) {
  await sessionsRepo.deleteById(ctx.db, sessionId);
  await writeAudit(ctx.db, { actorType: 'ADMIN', actorId: adminId, action: 'admin.logout', ip });
}

/** Troca da própria senha: encerra TODAS as outras sessões e sai do modo "senha provisória". */
export async function changePassword(ctx: AppContext, adminId: number, sessionId: string, input: { currentPassword: string; newPassword: string }, ip: string) {
  const key = `confirm|${adminId}`;
  const gate = await ctx.limiters.confirm.peek(key);
  if (gate.limited) throw tooManyRequests(gate.retryAfterSeconds);
  const a = await adminsRepo.findById(ctx.db, adminId);
  if (!a) throw unauthorized('Sessão inválida.', 'SESSION_INVALID');
  const check = await verifyPassword(a.passwordHash, input.currentPassword);
  if (!check.valid) {
    await ctx.limiters.confirm.hit(key);
    throw unprocessable('Senha atual incorreta.', 'CURRENT_PASSWORD_WRONG');
  }
  if (input.newPassword === input.currentPassword || input.newPassword === ctx.env.DEFAULT_PASSWORD) {
    throw unprocessable('Escolha uma senha diferente da atual e da senha padrão.', 'PASSWORD_REUSE');
  }
  await ctx.limiters.confirm.reset(key);
  await ctx.db.transaction(async (tx) => {
    await adminsRepo.update(tx, adminId, { passwordHash: await hashPassword(input.newPassword), mustChangePassword: false });
    await sessionsRepo.deleteAllFor(tx, adminId, sessionId);
    await writeAudit(tx, { actorType: 'ADMIN', actorId: adminId, action: 'admin.change_password', entityType: 'admin', entityId: adminId, ip });
  });
}

export async function mySessions(ctx: AppContext, adminId: number, currentSessionId: string) {
  const rows = await sessionsRepo.listActive(ctx.db, adminId);
  return rows.map((s) => ({ ...s, current: s.id === currentSessionId }));
}

export async function revokeOtherSessions(ctx: AppContext, adminId: number, currentSessionId: string, ip: string) {
  const n = await sessionsRepo.deleteAllFor(ctx.db, adminId, currentSessionId);
  await writeAudit(ctx.db, { actorType: 'ADMIN', actorId: adminId, action: 'admin.revoke_other_sessions', entityType: 'admin', entityId: adminId, metadata: { count: n }, ip });
  return { revoked: n };
}
