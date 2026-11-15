// JWT HS256 com o módulo nativo `crypto` (spec 3.2). Sem bibliotecas de terceiros.
// Valida: formato, algoritmo fixo HS256, assinatura em tempo constante, tipo, emissor, audiência,
// emissão e expiração. O token carrega só o mínimo; a autorização sempre reconsulta o banco.
import { createHmac, timingSafeEqual } from 'node:crypto';

export class JwtError extends Error {
  readonly reason: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED' | 'INVALID_CLAIMS';
  constructor(reason: JwtError['reason'], message: string) {
    super(message);
    this.name = 'JwtError';
    this.reason = reason;
  }
}

export const JWT_ISSUER = 'marqueaqui-app';
export const JWT_AUDIENCE = 'marqueaqui-app-api';
const CLOCK_SKEW_SECONDS = 30;

export interface AccessClaims {
  sub: string; // id do usuário
  role: 'CLIENT' | 'PROFESSIONAL' | 'MANAGER';
  shop: number | null; // empresa ativa (informativo: o servidor usa a sessão)
  sid: string; // id da sessão
  typ: 'access';
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export type AccessClaimsInput = Pick<AccessClaims, 'sub' | 'role' | 'shop' | 'sid'>;

const b64u = (input: Buffer | string): string => Buffer.from(input).toString('base64url');

function sign(data: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(data).digest();
}

export function signAccessToken(
  claims: AccessClaimsInput,
  secret: string,
  ttlSeconds: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload: AccessClaims = {
    ...claims,
    typ: 'access',
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };
  const body = b64u(JSON.stringify(payload));
  const signature = b64u(sign(`${header}.${body}`, secret));
  return `${header}.${body}.${signature}`;
}

function parseJson(part: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('not object');
    return value as Record<string, unknown>;
  } catch {
    throw new JwtError('MALFORMED', 'Token malformado.');
  }
}

export function verifyAccessToken(
  token: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): AccessClaims {
  if (typeof token !== 'string' || token.length > 4096) throw new JwtError('MALFORMED', 'Token malformado.');
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtError('MALFORMED', 'Token malformado.');
  const [h, p, s] = parts as [string, string, string];

  const header = parseJson(h);
  // O algoritmo é fixo: rejeita "none" e qualquer outro, ignorando o que o token afirma.
  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new JwtError('MALFORMED', 'Algoritmo não permitido.');
  }

  const expected = sign(`${h}.${p}`, secret);
  let provided: Buffer;
  try {
    provided = Buffer.from(s, 'base64url');
  } catch {
    throw new JwtError('BAD_SIGNATURE', 'Assinatura inválida.');
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new JwtError('BAD_SIGNATURE', 'Assinatura inválida.');
  }

  const c = parseJson(p);
  if (
    c.typ !== 'access' ||
    c.iss !== JWT_ISSUER ||
    c.aud !== JWT_AUDIENCE ||
    typeof c.sub !== 'string' ||
    typeof c.sid !== 'string' ||
    typeof c.iat !== 'number' ||
    typeof c.exp !== 'number' ||
    (c.role !== 'CLIENT' && c.role !== 'PROFESSIONAL' && c.role !== 'MANAGER') ||
    !(c.shop === null || typeof c.shop === 'number')
  ) {
    throw new JwtError('INVALID_CLAIMS', 'Token com dados inválidos.');
  }
  if (c.exp <= nowSeconds) throw new JwtError('EXPIRED', 'Token expirado.');
  if (c.iat > nowSeconds + CLOCK_SKEW_SECONDS) throw new JwtError('INVALID_CLAIMS', 'Token emitido no futuro.');

  return c as unknown as AccessClaims;
}
