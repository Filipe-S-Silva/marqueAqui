// TOTP (RFC 6238, HMAC-SHA1, 6 dígitos, passo de 30 s) e códigos de recuperação. Sem dependências externas.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('Base32 inválido.');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

/** Segredo de 160 bits (tamanho recomendado para HMAC-SHA1). */
export const generateSecret = (): Buffer => randomBytes(20);

export function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', secret).update(msg).digest();
  const o = h[h.length - 1]! & 0x0f;
  const bin = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(bin % 1_000_000).padStart(6, '0');
}

export const stepAt = (ms: number): number => Math.floor(ms / 1000 / STEP_SECONDS);

/**
 * Confere o código na janela atual ±1 passo (tolerância de relógio). Só aceita intervalos MAIORES que
 * `lastStep`, então um código já usado não vale de novo. Devolve o passo aceito ou null.
 */
export function verifyTotp(secret: Buffer, code: string, nowMs: number, lastStep: number, window = 1): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = stepAt(nowMs);
  let matched: number | null = null;
  for (let d = -window; d <= window; d++) {
    const step = current + d;
    if (step <= lastStep) continue;
    // sem retorno antecipado: o tempo não revela em qual passo acertou
    if (timingSafeEqual(Buffer.from(hotp(secret, step)), Buffer.from(code))) matched = step;
  }
  return matched;
}

export function otpauthUrl(params: { issuer: string; label: string; secret: Buffer }): string {
  const q = new URLSearchParams({ secret: base32Encode(params.secret), issuer: params.issuer, algorithm: 'SHA1', digits: '6', period: String(STEP_SECONDS) });
  return `otpauth://totp/${encodeURIComponent(params.issuer)}:${encodeURIComponent(params.label)}?${q.toString()}`;
}

/* ---------------------------------------------------------- recuperação */

export const RECOVERY_CODE_COUNT = 8;

/** 12 caracteres base32 (60 bits), formatados xxxx-xxxx-xxxx. `% 32` é uniforme porque 256 é múltiplo de 32. */
export function generateRecoveryCode(): string {
  const raw = Array.from(randomBytes(12), (b) => ALPHABET[b % 32]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export const normalizeRecoveryCode = (code: string): string => code.replace(/[\s-]+/g, '').toUpperCase();
export const looksLikeRecoveryCode = (code: string): boolean => /^[A-Z2-7]{12}$/.test(normalizeRecoveryCode(code));

/** HMAC com o pepper do servidor: um vazamento só do banco não permite testar códigos offline. */
export function hashRecoveryCode(code: string, pepper: string): string {
  return createHmac('sha256', `${pepper}|recovery-v1`).update(normalizeRecoveryCode(code)).digest('hex');
}
