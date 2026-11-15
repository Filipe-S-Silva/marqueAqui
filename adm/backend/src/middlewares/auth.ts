import { verifyPassword } from '@marqueaqui/database';
import type { FastifyRequest } from 'fastify';
import * as adminsRepo from '../repositories/admins.repository.ts';
import * as sessionsRepo from '../repositories/admin-sessions.repository.ts';
import { forbidden, tooManyRequests, unauthorized } from '../utils/errors.ts';
import { sha256Hex } from '../utils/crypto.ts';
import { setupRequired } from '../services/twofactor.service.ts';
import type { AdminContext } from '../types/context.ts';

/** Rotas liberadas enquanto a senha provisória não foi trocada. */
const ALLOWED_WHILE_MUST_CHANGE = new Set(['/auth/me', '/auth/logout', '/auth/change-password']);
/** Rotas liberadas enquanto o 2FA obrigatório (ADMIN_REQUIRE_2FA) não foi ativado. */
const ALLOWED_WHILE_SETUP_2FA = new Set(['/auth/me', '/auth/logout', '/auth/change-password', '/auth/2fa', '/auth/2fa/setup', '/auth/2fa/enable']);

/**
 * Só aceita `Authorization: Bearer <token opaco>`. O token nunca é lido de query string. A cada requisição:
 * a sessão (tabela admin_sessions, só o SHA-256 do token) tem de existir e não ter expirado, e a conta
 * tem de continuar ativa. Rebaixar/desativar tem efeito imediato.
 */
export async function authenticateAdmin(req: FastifyRequest): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !/^Bearer\s+\S+$/i.test(header)) throw unauthorized('Não autenticado.', 'UNAUTHORIZED');
  const token = header.split(/\s+/)[1]!;
  if (token.length > 200) throw unauthorized('Sessão inválida.', 'SESSION_INVALID');
  const { db } = req.server.ctx;
  const row = await sessionsRepo.findByTokenHash(db, sha256Hex(token));
  if (!row || row.session.expiresAt.getTime() <= Date.now()) {
    if (row) await sessionsRepo.deleteById(db, row.session.id);
    throw unauthorized('Sessão inválida ou expirada.', 'SESSION_INVALID');
  }
  if (!row.admin.active) throw unauthorized('Sessão inválida.', 'SESSION_INVALID');
  req.admin = { adminId: row.admin.id, name: row.admin.name, sessionId: row.session.id, mustChangePassword: row.admin.mustChangePassword } satisfies AdminContext;
  if (row.admin.mustChangePassword && !ALLOWED_WHILE_MUST_CHANGE.has(req.routeOptions.url ?? '')) {
    throw forbidden('Troque a senha provisória para continuar.', 'PASSWORD_CHANGE_REQUIRED');
  }
  if (setupRequired(req.server.ctx, row.admin) && !ALLOWED_WHILE_SETUP_2FA.has(req.routeOptions.url ?? '')) {
    throw forbidden('Ative a verificação em duas etapas (2FA) para continuar.', 'TWO_FACTOR_SETUP_REQUIRED');
  }
}

export function requireAdmin(req: FastifyRequest): AdminContext {
  if (!req.admin) throw unauthorized();
  return req.admin;
}

/**
 * Confirmação de senha (spec 8.2): TODA operação que altera dados chama isto no backend.
 * A senha vem no corpo (`adminPassword`), é conferida contra o hash do administrador autenticado
 * e as falhas são limitadas por administrador.
 */
export async function confirmAdminPassword(req: FastifyRequest, password: unknown): Promise<AdminContext> {
  const admin = requireAdmin(req);
  const { db, limiters } = req.server.ctx;
  const key = `confirm|${admin.adminId}`;
  const limited = await limiters.confirm.peek(key);
  if (limited.limited) throw tooManyRequests(limited.retryAfterSeconds);
  if (typeof password !== 'string' || password.length === 0 || password.length > 128) {
    throw forbidden('Confirme com sua senha.', 'PASSWORD_CONFIRMATION_REQUIRED');
  }
  const row = await adminsRepo.findById(db, admin.adminId);
  const check = row ? await verifyPassword(row.passwordHash, password) : { valid: false };
  if (!check.valid) {
    await limiters.confirm.hit(key);
    throw forbidden('Senha incorreta.', 'PASSWORD_CONFIRMATION_FAILED');
  }
  await limiters.confirm.reset(key);
  return admin;
}
