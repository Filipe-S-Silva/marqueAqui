import { createHash, randomBytes } from 'node:crypto';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Token opaco de 256 bits, seguro para URL e cookie. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
