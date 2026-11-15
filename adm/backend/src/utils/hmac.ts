import { createHmac } from 'node:crypto';

/** HMAC-SHA256 do e-mail normalizado, com pepper do servidor. É o único formato em que o e-mail do admin é guardado. */
export function emailHmac(email: string, pepper: string): string {
  return createHmac('sha256', pepper).update(email.trim().toLowerCase()).digest('hex');
}
