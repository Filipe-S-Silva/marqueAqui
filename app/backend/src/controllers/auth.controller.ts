import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  selectShopSchema,
} from '../schemas/auth.schemas.ts';
import * as authService from '../services/auth.service.ts';
import type { AuthResult } from '../services/auth.service.ts';
import type { ClientInfo } from '../types/app-context.ts';
import { parseCookies, serializeCookie } from '../utils/cookies.ts';
import { forbidden } from '../utils/errors.ts';
import { created, ok } from '../utils/response.ts';
import { parse } from '../utils/validate.ts';
import { requireAuth } from '../middlewares/authenticate.ts';

export const REFRESH_COOKIE = 'mq_refresh';

function clientInfo(req: FastifyRequest): ClientInfo {
  return { ip: req.ip, userAgent: String(req.headers['user-agent'] ?? '').slice(0, 255) };
}

function setRefreshCookie(req: FastifyRequest, reply: FastifyReply, result: AuthResult): void {
  const { env } = req.server.ctx;
  reply.header(
    'Set-Cookie',
    serializeCookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: 'Strict',
      path: '/', // vale atrás do proxy da Netlify (/api/auth/...) e direto (/auth/...)
      maxAgeSeconds: (result.refreshExpiresAt.getTime() - Date.now()) / 1000,
    }),
  );
}

function clearRefreshCookie(req: FastifyRequest, reply: FastifyReply): void {
  const { env } = req.server.ctx;
  reply.header(
    'Set-Cookie',
    serializeCookie(REFRESH_COOKIE, '', {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: 'Strict',
      path: '/', // vale atrás do proxy da Netlify (/api/auth/...) e direto (/auth/...)
      maxAgeSeconds: 0,
    }),
  );
}

/**
 * Proteção contra CSRF nas rotas que dependem do cookie (refresh e logout):
 * exige cabeçalho personalizado (força pré-voo de CORS) e, se houver Origin, ele precisa estar na lista.
 */
function assertCsrf(req: FastifyRequest): void {
  if (req.headers['x-requested-with'] !== 'marqueaqui') {
    throw forbidden('Requisição não permitida.', 'CSRF_BLOCKED');
  }
  const origin = req.headers.origin;
  if (origin && !req.server.ctx.env.CORS_ORIGINS.includes(origin)) {
    throw forbidden('Origem não permitida.', 'CSRF_BLOCKED');
  }
}

export async function register(req: FastifyRequest, reply: FastifyReply) {
  const input = parse(registerSchema, req.body);
  const result = await authService.register(req.server.ctx, clientInfo(req), input);
  setRefreshCookie(req, reply, result);
  return created(reply, result.payload, 'Conta criada com sucesso.');
}

export async function login(req: FastifyRequest, reply: FastifyReply) {
  const input = parse(loginSchema, req.body);
  const result = await authService.login(req.server.ctx, clientInfo(req), input);
  setRefreshCookie(req, reply, result);
  return ok(reply, result.payload, 'Login realizado com sucesso.');
}

export async function refresh(req: FastifyRequest, reply: FastifyReply) {
  assertCsrf(req);
  const token = parseCookies(req.headers.cookie)[REFRESH_COOKIE];
  try {
    const result = await authService.refresh(req.server.ctx, clientInfo(req), token);
    setRefreshCookie(req, reply, result);
    return ok(reply, result.payload, 'Sessão renovada.');
  } catch (error) {
    clearRefreshCookie(req, reply);
    throw error;
  }
}

export async function logout(req: FastifyRequest, reply: FastifyReply) {
  assertCsrf(req);
  const token = parseCookies(req.headers.cookie)[REFRESH_COOKIE];
  await authService.logout(req.server.ctx, token, req.auth);
  clearRefreshCookie(req, reply);
  return ok(reply, null, 'Sessão encerrada.');
}

export async function me(req: FastifyRequest, reply: FastifyReply) {
  return ok(reply, await authService.me(req.server.ctx, requireAuth(req)), 'Sessão válida.');
}

export async function selectShop(req: FastifyRequest, reply: FastifyReply) {
  const { shopId } = parse(selectShopSchema, req.body);
  return ok(reply, await authService.selectShop(req.server.ctx, requireAuth(req), shopId), 'Empresa ativa alterada.');
}

export async function changePassword(req: FastifyRequest, reply: FastifyReply) {
  const input = parse(changePasswordSchema, req.body);
  await authService.changePassword(req.server.ctx, clientInfo(req), requireAuth(req), input);
  return ok(reply, null, 'Senha alterada com sucesso.');
}

export async function forgotPassword(req: FastifyRequest, reply: FastifyReply) {
  const { email } = parse(forgotPasswordSchema, req.body);
  await authService.forgotPassword(req.server.ctx, clientInfo(req), email);
  // Resposta idêntica exista a conta ou não
  return ok(reply, null, 'Se o e-mail estiver cadastrado, enviaremos as instruções de redefinição.');
}

export async function resetPassword(req: FastifyRequest, reply: FastifyReply) {
  const input = parse(resetPasswordSchema, req.body);
  await authService.resetPassword(req.server.ctx, clientInfo(req), input);
  return ok(reply, null, 'Senha redefinida. Entre com a nova senha.');
}
