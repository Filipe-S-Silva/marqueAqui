// JWT HS256 exclusivo do ADM: emissor/audiência/tipo diferentes dos do APP, então um token de um
// lado nunca é aceito no outro (e segredos também são distintos).
import { createHmac, timingSafeEqual } from 'node:crypto';

export class JwtError extends Error {
  readonly reason: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED' | 'INVALID_CLAIMS';
  constructor(reason: 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED' | 'INVALID_CLAIMS', message: string) {
    super(message);
    this.name = 'JwtError';
    this.reason = reason;
  }
}

export const ADMIN_ISSUER = 'marqueaqui-adm';
export const ADMIN_AUDIENCE = 'marqueaqui-adm-api';

export interface AdminClaims { sub: string; typ: 'admin'; iss: string; aud: string; iat: number; exp: number }

const b64u = (v: Buffer | string): string => Buffer.from(v).toString('base64url');
const hmac = (data: string, secret: string): Buffer => createHmac('sha256', secret).update(data).digest();

export function signAdminToken(adminId: number, secret: string, ttlSeconds: number, now = Math.floor(Date.now() / 1000)): string {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const claims: AdminClaims = { sub: String(adminId), typ: 'admin', iss: ADMIN_ISSUER, aud: ADMIN_AUDIENCE, iat: now, exp: now + ttlSeconds };
  const body = b64u(JSON.stringify(claims));
  return `${header}.${body}.${b64u(hmac(`${header}.${body}`, secret))}`;
}

function parse(part: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('x');
    return v as Record<string, unknown>;
  } catch { throw new JwtError('MALFORMED', 'Token malformado.'); }
}

export function verifyAdminToken(token: string, secret: string, now = Math.floor(Date.now() / 1000)): AdminClaims {
  if (typeof token !== 'string' || token.length > 2048) throw new JwtError('MALFORMED', 'Token malformado.');
  const parts = token.split('.');
  if (parts.length !== 3) throw new JwtError('MALFORMED', 'Token malformado.');
  const [h, p, s] = parts as [string, string, string];
  const header = parse(h);
  if (header.alg !== 'HS256' || header.typ !== 'JWT') throw new JwtError('MALFORMED', 'Algoritmo não permitido.');
  const expected = hmac(`${h}.${p}`, secret);
  const provided = Buffer.from(s, 'base64url');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) throw new JwtError('BAD_SIGNATURE', 'Assinatura inválida.');
  const c = parse(p);
  if (c.typ !== 'admin' || c.iss !== ADMIN_ISSUER || c.aud !== ADMIN_AUDIENCE || typeof c.sub !== 'string' || typeof c.iat !== 'number' || typeof c.exp !== 'number') {
    throw new JwtError('INVALID_CLAIMS', 'Token com dados inválidos.');
  }
  if (c.exp <= now) throw new JwtError('EXPIRED', 'Token expirado.');
  if (c.iat > now + 30) throw new JwtError('INVALID_CLAIMS', 'Token emitido no futuro.');
  return c as unknown as AdminClaims;
}
