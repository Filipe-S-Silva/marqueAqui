import { randomBytes } from 'node:crypto';
import type { Admin, DbOrTx } from '@marqueaqui/database';
import { writeAudit } from '../repositories/audit.repository.ts';
import * as adminsRepo from '../repositories/admins.repository.ts';
import * as sessionsRepo from '../repositories/admin-sessions.repository.ts';
import * as repo from '../repositories/twofactor.repository.ts';
import type { AppContext } from '../types/context.ts';
import { conflict, notFound, tooManyRequests, unprocessable } from '../utils/errors.ts';
import { open, seal } from '../utils/secretbox.ts';
import {
  base32Encode, generateRecoveryCode, generateSecret, hashRecoveryCode, looksLikeRecoveryCode, otpauthUrl, RECOVERY_CODE_COUNT, verifyTotp,
} from '../utils/totp.ts';

const ISSUER = 'MarqueAqui ADM';
export const CODE_INVALID = 'Código inválido.';

export const isEnabled = (a: Pick<Admin, 'totpEnabledAt' | 'totpSecretEnc'>): boolean => a.totpEnabledAt !== null && a.totpSecretEnc !== null;
/** ADMIN_REQUIRE_2FA ligado e este administrador ainda não ativou: só pode configurar o 2FA. */
export const setupRequired = (ctx: AppContext, a: Pick<Admin, 'totpEnabledAt' | 'totpSecretEnc'>): boolean => ctx.env.ADMIN_REQUIRE_2FA && !isEnabled(a);

export async function status(ctx: AppContext, adminId: number) {
  const a = await adminsRepo.findById(ctx.db, adminId);
  if (!a) throw notFound('Administrador não encontrado.');
  return {
    enabled: isEnabled(a), enabledAt: a.totpEnabledAt, pendingSetup: !isEnabled(a) && a.totpSecretEnc !== null,
    required: ctx.env.ADMIN_REQUIRE_2FA,
    recoveryCodesRemaining: isEnabled(a) ? await repo.countUnusedRecoveryCodes(ctx.db, adminId) : 0,
  };
}

/** Passo 1 do cadastro: gera um segredo PENDENTE (cifrado). Só vale depois de confirmar um código no `enable`. */
export async function setup(ctx: AppContext, adminId: number) {
  const a = await adminsRepo.findById(ctx.db, adminId);
  if (!a) throw notFound('Administrador não encontrado.');
  if (isEnabled(a)) throw conflict('O 2FA já está ativo. Desative-o antes de configurar de novo.', 'TWO_FACTOR_ALREADY_ENABLED');
  const secret = generateSecret();
  await repo.setPendingSecret(ctx.db, adminId, seal(secret, ctx.env.ADMIN_EMAIL_PEPPER));
  return { secret: base32Encode(secret), otpauthUrl: otpauthUrl({ issuer: ISSUER, label: a.name, secret }) };
}

async function failCode(ctx: AppContext, adminId: number): Promise<never> {
  await ctx.limiters.confirm.hit(`confirm|${adminId}`);
  throw unprocessable(CODE_INVALID, 'TWO_FACTOR_CODE_INVALID');
}
async function gate(ctx: AppContext, adminId: number) {
  const g = await ctx.limiters.confirm.peek(`confirm|${adminId}`);
  if (g.limited) throw tooManyRequests(g.retryAfterSeconds);
}

function newRecoveryCodes(ctx: AppContext) {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, generateRecoveryCode);
  return { codes, hashes: codes.map((c) => hashRecoveryCode(c, ctx.env.ADMIN_EMAIL_PEPPER)) };
}

/** Passo 2: confirma o primeiro código, ativa o 2FA e devolve os códigos de recuperação UMA ÚNICA VEZ. */
export async function enable(ctx: AppContext, adminId: number, code: string, ip: string) {
  await gate(ctx, adminId);
  const a = await adminsRepo.findById(ctx.db, adminId);
  if (!a) throw notFound('Administrador não encontrado.');
  if (isEnabled(a)) throw conflict('O 2FA já está ativo.', 'TWO_FACTOR_ALREADY_ENABLED');
  if (!a.totpSecretEnc) throw unprocessable('Inicie a configuração do 2FA primeiro.', 'TWO_FACTOR_NOT_STARTED');
  const step = verifyTotp(open(a.totpSecretEnc, ctx.env.ADMIN_EMAIL_PEPPER), code, Date.now(), 0);
  if (step === null) return failCode(ctx, adminId);
  const { codes, hashes } = newRecoveryCodes(ctx);
  await ctx.db.transaction(async (tx) => {
    await repo.enable(tx, adminId, step);
    await repo.replaceRecoveryCodes(tx, adminId, hashes);
    await writeAudit(tx, { actorType: 'ADMIN', actorId: adminId, action: 'admin.2fa_enabled', entityType: 'admin', entityId: adminId, ip });
  });
  return { recoveryCodes: codes };
}

/**
 * Confere um segundo fator (TOTP ou código de recuperação) de um administrador com 2FA ativo.
 * TOTP: o passo avança de forma atômica (sem replay). Recuperação: uso único.
 */
export async function verifySecondFactor(ctx: AppContext, db: DbOrTx, a: Admin, code: string): Promise<'totp' | 'recovery' | null> {
  if (!a.totpSecretEnc || !isEnabled(a)) return null;
  const clean = code.trim();
  if (/^\d{6}$/.test(clean)) {
    const step = verifyTotp(open(a.totpSecretEnc, ctx.env.ADMIN_EMAIL_PEPPER), clean, Date.now(), a.totpLastStep ?? 0);
    return step !== null && (await repo.advanceStep(db, a.id, step)) ? 'totp' : null;
  }
  if (looksLikeRecoveryCode(clean)) {
    return (await repo.useRecoveryCode(db, a.id, hashRecoveryCode(clean, ctx.env.ADMIN_EMAIL_PEPPER))) ? 'recovery' : null;
  }
  return null;
}

async function requireSecondFactor(ctx: AppContext, adminId: number, code: string): Promise<Admin> {
  await gate(ctx, adminId);
  const a = await adminsRepo.findById(ctx.db, adminId);
  if (!a || !isEnabled(a)) throw unprocessable('O 2FA não está ativo.', 'TWO_FACTOR_NOT_ENABLED');
  if (!(await verifySecondFactor(ctx, ctx.db, a, code))) return failCode(ctx, adminId);
  return a;
}

/** Gera 8 códigos novos e invalida os anteriores. Exige senha (no controller) e um código válido. */
export async function regenerateRecoveryCodes(ctx: AppContext, adminId: number, code: string, ip: string) {
  await requireSecondFactor(ctx, adminId, code);
  const { codes, hashes } = newRecoveryCodes(ctx);
  await ctx.db.transaction(async (tx) => {
    await repo.replaceRecoveryCodes(tx, adminId, hashes);
    await writeAudit(tx, { actorType: 'ADMIN', actorId: adminId, action: 'admin.2fa_recovery_regenerated', entityType: 'admin', entityId: adminId, ip });
  });
  return { recoveryCodes: codes };
}

export async function disable(ctx: AppContext, adminId: number, code: string, ip: string) {
  if (ctx.env.ADMIN_REQUIRE_2FA) throw unprocessable('O 2FA é obrigatório neste ambiente e não pode ser desativado.', 'TWO_FACTOR_REQUIRED');
  await requireSecondFactor(ctx, adminId, code);
  await ctx.db.transaction(async (tx) => {
    await repo.clear(tx, adminId);
    await writeAudit(tx, { actorType: 'ADMIN', actorId: adminId, action: 'admin.2fa_disabled', entityType: 'admin', entityId: adminId, ip });
  });
}

/** Outro administrador perdeu o dispositivo: remove o 2FA e encerra as sessões dele. Nunca a própria conta. */
export async function resetFor(ctx: AppContext, actor: number, targetId: number) {
  if (targetId === actor) throw unprocessable('Para a própria conta, use "Desativar 2FA" na página Segurança.', 'USE_DISABLE');
  if (!(await adminsRepo.findById(ctx.db, targetId))) throw notFound('Administrador não encontrado.');
  await ctx.db.transaction(async (tx) => {
    await repo.clear(tx, targetId);
    await sessionsRepo.deleteAllFor(tx, targetId);
    await writeAudit(tx, { actorType: 'ADMIN', actorId: actor, action: 'admin.2fa_reset', entityType: 'admin', entityId: targetId });
  });
}

export const newChallengeToken = (): string => randomBytes(32).toString('base64url');
