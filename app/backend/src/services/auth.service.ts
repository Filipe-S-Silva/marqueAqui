import { randomUUID } from 'node:crypto';
import { clearUserLockout, getDummyHash, hashPassword, isLocked, registerFailedUserLogin, verifyPassword, type User, type UserRole } from '@marqueaqui/database';
import type { z } from 'zod';
import * as authRepo from '../repositories/auth.repository.ts';
import { writeAudit } from '../repositories/audit.repository.ts';
import * as notificationsRepo from '../repositories/notifications.repository.ts';
import type { AppContext, AuthContext, ClientInfo } from '../types/app-context.ts';
import { sha256Hex, randomToken } from '../utils/crypto.ts';
import { conflict, forbidden, tooManyRequests, unauthorized, unprocessable } from '../utils/errors.ts';
import { signAccessToken } from '../utils/jwt.ts';
import type {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '../schemas/auth.schemas.ts';

export const REDIRECT_BY_ROLE: Record<UserRole, string> = {
  CLIENT: '/app',
  PROFESSIONAL: '/staff',
  MANAGER: '/manager',
};

const GENERIC_LOGIN_ERROR = 'E-mail ou senha inválidos.';
const REFRESH_REUSE_GRACE_MS = 10_000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function toPublicUser(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    photoUrl: u.photoUrl,
    description: u.description,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt,
  };
}

export type Portal = 'client' | 'partner';

export interface AuthPayload {
  portal: Portal;
  user: ReturnType<typeof toPublicUser>;
  accessToken: string;
  expiresInSeconds: number;
  shops: Array<{ id: number; name: string; barberId: number | null }>;
  activeShopId: number | null;
  mustChangePassword: boolean;
  redirectTo: string;
}

export interface AuthResult {
  payload: AuthPayload;
  refreshToken: string;
  refreshExpiresAt: Date;
}

function throwIfLimited(r: { limited: boolean; retryAfterSeconds: number }): void {
  if (r.limited) throw tooManyRequests(r.retryAfterSeconds);
}

function assertNotDefaultPassword(ctx: AppContext, password: string): void {
  if (password === ctx.env.DEFAULT_PASSWORD) {
    throw unprocessable('Escolha uma senha diferente da senha padrão.', 'PASSWORD_IS_DEFAULT');
  }
}

async function issueSession(
  ctx: AppContext,
  user: User,
  params: { familyId?: string; activeShopId: number | null; client: ClientInfo; portal: Portal },
): Promise<AuthResult> {
  const refreshToken = randomToken();
  const refreshExpiresAt = new Date(Date.now() + ctx.env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  const session = await authRepo.insertSession(ctx.db, {
    familyId: params.familyId ?? randomUUID(),
    userId: user.id,
    tokenHash: sha256Hex(refreshToken),
    activeShopId: params.activeShopId,
    portal: params.portal,
    expiresAt: refreshExpiresAt,
    ip: params.client.ip,
    userAgent: params.client.userAgent,
  });

  const shops = await authRepo.listUserShops(ctx.db, user);
  const activeShopId =
    shops.find((s) => s.id === params.activeShopId)?.id ?? (user.role === 'CLIENT' ? null : (shops[0]?.id ?? null));
  if (activeShopId !== session.activeShopId) await authRepo.setSessionShop(ctx.db, session.id, activeShopId);

  const accessToken = signAccessToken(
    { sub: String(user.id), role: user.role, shop: activeShopId, sid: session.id },
    ctx.env.JWT_SECRET,
    ctx.env.ACCESS_TOKEN_TTL_SECONDS,
  );

  return {
    payload: {
      portal: params.portal,
      user: toPublicUser(user),
      accessToken,
      expiresInSeconds: ctx.env.ACCESS_TOKEN_TTL_SECONDS,
      shops,
      activeShopId,
      mustChangePassword: user.mustChangePassword,
      redirectTo: params.portal === 'client' ? '/app' : REDIRECT_BY_ROLE[user.role],
    },
    refreshToken,
    refreshExpiresAt,
  };
}

/* ---------------------------------------------------------------- cadastro */

/** Versão vigente dos Termos e da Política (mesma data exibida nas páginas /termos e /privacidade). */
export const TERMS_VERSION = '2026-11-21';

export async function register(
  ctx: AppContext,
  client: ClientInfo,
  input: z.infer<typeof registerSchema>,
): Promise<AuthResult> {
  throwIfLimited(await ctx.limiters.register.hit(client.ip));
  assertNotDefaultPassword(ctx, input.password);

  if (await authRepo.findUserByEmail(ctx.db, input.email)) {
    throw conflict('Este e-mail já está cadastrado. Entre ou recupere a senha.', 'EMAIL_IN_USE');
  }
  const user = await authRepo.insertUser(ctx.db, {
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    passwordHash: await hashPassword(input.password),
    role: 'CLIENT', // o cadastro público só cria clientes
    lastLoginAt: new Date(),
    termsVersion: TERMS_VERSION,
    termsAcceptedAt: new Date(),
  });
  await writeAudit(ctx.db, { actorType: 'USER', actorId: user.id, action: 'auth.register', entityType: 'user', entityId: user.id, ip: client.ip });
  return issueSession(ctx, user, { activeShopId: null, client, portal: 'client' });
}

/* ------------------------------------------------------------------ login */

export async function login(
  ctx: AppContext,
  client: ClientInfo,
  input: z.infer<typeof loginSchema>,
): Promise<AuthResult> {
  const emailKey = sha256Hex(input.email);
  const pairKey = `${client.ip}|${emailKey}`;
  const { loginIp, loginPair, loginAccount } = ctx.limiters;

  throwIfLimited(await loginIp.peek(client.ip));
  throwIfLimited(await loginPair.peek(pairKey));
  throwIfLimited(await loginAccount.peek(emailKey));

  const user = await authRepo.findUserByEmail(ctx.db, input.email);
  // Conta inexistente OU bloqueada: mesma verificação de hash (tempo equalizado) e a MESMA mensagem genérica
  const locked = user !== undefined && isLocked(user);
  const stored = user && !locked ? user.passwordHash : await getDummyHash();
  const result = await verifyPassword(stored, input.password);

  if (!user || locked || !result.valid) {
    await loginIp.hit(client.ip);
    await loginPair.hit(pairKey);
    await loginAccount.hit(emailKey);
    // 5 senhas erradas bloqueiam 15 min (contador atômico no SQL); durante o bloqueio não estende o prazo
    if (user && !locked) await registerFailedUserLogin(ctx.db, user.id);
    throw unauthorized(GENERIC_LOGIN_ERROR, 'INVALID_CREDENTIALS');
  }
  if (!user.active) {
    // Só revela o estado da conta a quem provou conhecer a senha
    throw forbidden('Conta desativada. Procure o administrador da sua empresa.', 'ACCOUNT_DISABLED');
  }

  await loginPair.reset(pairKey);
  await loginAccount.reset(emailKey);
  await clearUserLockout(ctx.db, user.id);

  if (result.needsRehash) {
    await authRepo.updatePassword(ctx.db, user.id, await hashPassword(input.password), user.mustChangePassword);
  }
  const usingDefault = input.password === ctx.env.DEFAULT_PASSWORD;
  if (usingDefault && !user.mustChangePassword) await authRepo.setMustChangePassword(ctx.db, user.id, true);
  await authRepo.touchLogin(ctx.db, user.id);

  const fresh = (await authRepo.findUserById(ctx.db, user.id)) ?? user;
  // Login de parceiro: só gestor/profissional com vínculo ativo a uma empresa. Cliente comum não entra.
  if (input.portal === 'partner' && (fresh.role === 'CLIENT' || (await authRepo.listUserShops(ctx.db, fresh)).length === 0)) {
    throw forbidden('Esta conta não está vinculada a nenhuma empresa parceira. Use o login de cliente.', 'NOT_A_PARTNER');
  }
  return issueSession(ctx, fresh, { activeShopId: null, client, portal: input.portal });
}

/* ---------------------------------------------------------------- refresh */

export async function refresh(
  ctx: AppContext,
  client: ClientInfo,
  refreshToken: string | undefined,
): Promise<AuthResult> {
  if (!refreshToken) throw unauthorized('Sessão não encontrada.', 'NO_REFRESH_TOKEN');
  const session = await authRepo.findSessionByTokenHash(ctx.db, sha256Hex(refreshToken));
  if (!session) throw unauthorized('Sessão inválida.', 'SESSION_INVALID');

  const now = new Date();
  if (session.revokedAt || session.expiresAt <= now) throw unauthorized('Sessão encerrada.', 'SESSION_INVALID');

  if (session.rotatedAt) {
    // Token já usado: reuso fora da janela de tolerância indica roubo; derruba a família inteira
    if (now.getTime() - session.rotatedAt.getTime() > REFRESH_REUSE_GRACE_MS) {
      await authRepo.revokeFamily(ctx.db, session.familyId);
      ctx.log.warn({ userId: session.userId, familyId: session.familyId }, 'Reuso de refresh token detectado');
      await writeAudit(ctx.db, { actorType: 'SYSTEM', action: 'auth.refresh_reuse', entityType: 'user', entityId: session.userId, ip: client.ip });
    }
    throw unauthorized('Sessão inválida.', 'REFRESH_REUSED');
  }

  const user = await authRepo.findUserById(ctx.db, session.userId);
  if (!user || !user.active) {
    await authRepo.revokeFamily(ctx.db, session.familyId);
    throw unauthorized('Sessão inválida.', 'SESSION_INVALID');
  }
  if (!(await authRepo.markSessionRotated(ctx.db, session.id))) {
    throw unauthorized('Sessão inválida.', 'REFRESH_RACE');
  }
  return issueSession(ctx, user, { familyId: session.familyId, activeShopId: session.activeShopId, client, portal: session.portal });
}

/* ----------------------------------------------------------------- logout */

export async function logout(ctx: AppContext, refreshToken: string | undefined, auth?: AuthContext): Promise<void> {
  if (refreshToken) {
    const s = await authRepo.findSessionByTokenHash(ctx.db, sha256Hex(refreshToken));
    if (s) await authRepo.revokeFamily(ctx.db, s.familyId);
  }
  if (auth) {
    const row = await authRepo.findSessionWithUser(ctx.db, auth.sessionId);
    if (row) await authRepo.revokeFamily(ctx.db, row.session.familyId);
  }
}

/* --------------------------------------------------------------------- me */

export async function me(ctx: AppContext, auth: AuthContext) {
  const user = await authRepo.findUserById(ctx.db, auth.userId);
  if (!user) throw unauthorized('Sessão inválida.', 'SESSION_INVALID');
  return {
    user: toPublicUser(user),
    shops: await authRepo.listUserShops(ctx.db, user),
    activeShopId: auth.shopId,
    portal: auth.portal,
    pendingNotifications: await notificationsRepo.countPending(ctx.db, user.id),
    redirectTo: auth.portal === 'client' ? '/app' : REDIRECT_BY_ROLE[user.role],
  };
}

export async function selectShop(ctx: AppContext, auth: AuthContext, shopId: number) {
  const user = await authRepo.findUserById(ctx.db, auth.userId);
  if (!user) throw unauthorized('Sessão inválida.', 'SESSION_INVALID');
  const shops = await authRepo.listUserShops(ctx.db, user);
  const target = shops.find((s) => s.id === shopId);
  // Mesma resposta para empresa inexistente e não vinculada: não revela a existência
  if (!target) throw forbidden('Você não tem acesso a esta empresa.', 'SHOP_NOT_ALLOWED');
  await authRepo.setSessionShop(ctx.db, auth.sessionId, target.id);
  const accessToken = signAccessToken(
    { sub: String(user.id), role: user.role, shop: target.id, sid: auth.sessionId },
    ctx.env.JWT_SECRET,
    ctx.env.ACCESS_TOKEN_TTL_SECONDS,
  );
  return { accessToken, expiresInSeconds: ctx.env.ACCESS_TOKEN_TTL_SECONDS, activeShopId: target.id, shops };
}

/* ------------------------------------------------------------------ senha */

export async function changePassword(
  ctx: AppContext,
  client: ClientInfo,
  auth: AuthContext,
  input: z.infer<typeof changePasswordSchema>,
): Promise<void> {
  const user = await authRepo.findUserById(ctx.db, auth.userId);
  if (!user) throw unauthorized('Sessão inválida.', 'SESSION_INVALID');

  throwIfLimited(await ctx.limiters.loginPair.peek(`pw|${auth.userId}`));
  const check = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!check.valid) {
    await ctx.limiters.loginPair.hit(`pw|${auth.userId}`);
    throw unprocessable('A senha atual está incorreta.', 'CURRENT_PASSWORD_WRONG');
  }
  if (input.newPassword === input.currentPassword) {
    throw unprocessable('A nova senha deve ser diferente da atual.', 'PASSWORD_UNCHANGED');
  }
  assertNotDefaultPassword(ctx, input.newPassword);

  await authRepo.updatePassword(ctx.db, user.id, await hashPassword(input.newPassword), false);
  // Encerra as outras sessões; a atual continua ativa
  await authRepo.revokeUserSessions(ctx.db, user.id, auth.sessionId);
  await writeAudit(ctx.db, { actorType: 'USER', actorId: user.id, action: 'auth.change_password', entityType: 'user', entityId: user.id, ip: client.ip });
}

export async function forgotPassword(ctx: AppContext, client: ClientInfo, email: string): Promise<void> {
  throwIfLimited(await ctx.limiters.forgotIp.hit(client.ip));
  throwIfLimited(await ctx.limiters.forgotAccount.hit(sha256Hex(email)));

  const user = await authRepo.findUserByEmail(ctx.db, email);
  if (!user || !user.active) return; // a resposta externa é sempre a mesma (spec 3.5)

  const token = randomToken();
  await authRepo.replacePasswordResetToken(ctx.db, user.id, sha256Hex(token), new Date(Date.now() + RESET_TOKEN_TTL_MS));
  await ctx.mailer.sendPasswordReset({ to: user.email, name: user.name, token });
}

export async function resetPassword(
  ctx: AppContext,
  client: ClientInfo,
  input: z.infer<typeof resetPasswordSchema>,
): Promise<void> {
  throwIfLimited(await ctx.limiters.forgotIp.peek(`reset|${client.ip}`));
  assertNotDefaultPassword(ctx, input.newPassword);

  const record = await authRepo.findResetToken(ctx.db, sha256Hex(input.token));
  const invalid = () => unprocessable('Link inválido ou expirado. Solicite uma nova redefinição.', 'RESET_TOKEN_INVALID');
  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    await ctx.limiters.forgotIp.hit(`reset|${client.ip}`);
    throw invalid();
  }
  const user = await authRepo.findUserById(ctx.db, record.userId);
  if (!user || !user.active) throw invalid();

  const newHash = await hashPassword(input.newPassword);
  await ctx.db.transaction(async (tx) => {
    if (!(await authRepo.consumeResetToken(tx, record.id))) throw invalid();
    await authRepo.updatePassword(tx, user.id, newHash, false);
    await authRepo.revokeUserSessions(tx, user.id);
    await clearUserLockout(tx, user.id);
    await writeAudit(tx, { actorType: 'USER', actorId: user.id, action: 'auth.reset_password', entityType: 'user', entityId: user.id, ip: client.ip });
  });
}
