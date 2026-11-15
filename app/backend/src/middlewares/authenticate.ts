// Autenticação por Bearer token + reconsulta ao banco a cada requisição (spec 6.2 e 10.3).
// O token só identifica a sessão; conta ativa, perfil, sessão válida e vínculo com a empresa
// são sempre conferidos no banco. Token em query string NÃO é aceito.
import type { FastifyReply, FastifyRequest } from 'fastify';
import { forbidden, unauthorized } from '../utils/errors.ts';
import { JwtError, verifyAccessToken } from '../utils/jwt.ts';
import * as authRepo from '../repositories/auth.repository.ts';
import type { AuthContext } from '../types/app-context.ts';
import type { UserRole } from '@marqueaqui/database';

async function resolveAuth(req: FastifyRequest): Promise<AuthContext & { passwordChangeRequired: boolean }> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('Envie o token no cabeçalho Authorization: Bearer.', 'TOKEN_MISSING');
  }
  const token = header.slice(7).trim();
  const { db, env } = req.server.ctx;

  let claims;
  try {
    claims = verifyAccessToken(token, env.JWT_SECRET);
  } catch (error) {
    if (error instanceof JwtError && error.reason === 'EXPIRED') {
      throw unauthorized('Sessão expirada. Renove o acesso.', 'TOKEN_EXPIRED');
    }
    throw unauthorized('Token inválido.', 'TOKEN_INVALID');
  }

  const row = await authRepo.findSessionWithUser(db, claims.sid);
  const now = new Date();
  if (
    !row ||
    row.session.revokedAt ||
    row.session.expiresAt <= now ||
    String(row.user.id) !== claims.sub ||
    row.user.role !== claims.role
  ) {
    throw unauthorized('Sessão inválida ou encerrada.', 'SESSION_INVALID');
  }
  if (!row.user.active) {
    throw forbidden('Conta desativada. Procure o administrador da sua empresa.', 'ACCOUNT_DISABLED');
  }

  // Empresa ativa vem da sessão (fonte de verdade) e é revalidada contra os vínculos atuais.
  const shopsOfUser = await authRepo.listUserShops(db, row.user);
  const chosen =
    shopsOfUser.find((s) => s.id === row.session.activeShopId) ?? (row.user.role === 'CLIENT' ? undefined : shopsOfUser[0]);

  return {
    userId: row.user.id,
    role: row.user.role,
    name: row.user.name,
    email: row.user.email,
    sessionId: row.session.id,
    portal: row.session.portal,
    mustChangePassword: row.user.mustChangePassword,
    shopId: chosen?.id ?? null,
    barberId: chosen?.barberId ?? null,
    passwordChangeRequired: row.user.mustChangePassword,
  };
}

/** Exige autenticação e bloqueia quem ainda precisa trocar a senha padrão. */
export async function authenticate(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const { passwordChangeRequired, ...auth } = await resolveAuth(req);
  if (passwordChangeRequired) {
    throw forbidden('Troque a senha padrão para continuar.', 'PASSWORD_CHANGE_REQUIRED');
  }
  req.auth = auth;
}

/** Variante para as poucas rotas liberadas durante a troca obrigatória (me, trocar senha, sair). */
export async function authenticateAllowingPasswordChange(req: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const { passwordChangeRequired: _ignored, ...auth } = await resolveAuth(req);
  req.auth = auth;
}

export function authorize(...roles: UserRole[]) {
  return async function authorizeRoles(req: FastifyRequest): Promise<void> {
    if (!req.auth || !roles.includes(req.auth.role)) {
      throw forbidden('Seu perfil não tem acesso a este recurso.');
    }
    // Rotas de parceiro (sem CLIENT na lista) exigem ter entrado pelo login de parceiro
    if (!roles.includes('CLIENT') && req.auth.portal !== 'partner') {
      throw forbidden('Entre pelo login de parceiro para acessar este recurso.', 'PARTNER_LOGIN_REQUIRED');
    }
  };
}

/** Exige empresa ativa válida (gestor ou profissional com vínculo ativo). */
export async function requireShop(req: FastifyRequest): Promise<void> {
  if (!req.auth || req.auth.shopId === null) {
    throw forbidden('Nenhuma empresa ativa vinculada à sua conta.', 'NO_ACTIVE_SHOP');
  }
}

/** Exige perfil de profissional na empresa ativa. */
export async function requireBarber(req: FastifyRequest): Promise<void> {
  if (!req.auth || req.auth.shopId === null || req.auth.barberId === null) {
    throw forbidden('Você não atende nesta empresa.', 'NOT_A_BARBER');
  }
}

export function requireAuth(req: FastifyRequest): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}
