// Pepper de senha: HMAC-SHA256 da senha com um segredo que só existe no .env, aplicado antes do argon2id.
// Quem vazar apenas o banco não consegue testar senhas offline sem o pepper. Módulo puro (sem argon2) para ser testável.
import { createHmac } from 'node:crypto';

export const MIN_PEPPER_LENGTH = 32;

export function pepperPassword(password: string, pepper: string | undefined): string {
  if (!pepper) return password;
  return createHmac('sha256', pepper).update(password).digest('base64');
}
