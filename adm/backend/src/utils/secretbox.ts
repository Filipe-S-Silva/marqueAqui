// Cifra o segredo TOTP em repouso (AES-256-GCM). A chave é derivada do ADMIN_EMAIL_PEPPER com HKDF e um
// rótulo próprio. Perder o pepper já invalida os logins de admin; os segredos 2FA se perdem junto.
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const key = (pepper: string): Buffer => Buffer.from(hkdfSync('sha256', pepper, Buffer.alloc(0), 'marqueaqui-adm-totp-v1', 32));

export function seal(plain: Buffer, pepper: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(pepper), iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

export function open(sealed: string, pepper: string): Buffer {
  const [v, iv, tag, ct] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Segredo cifrado em formato desconhecido.');
  const d = createDecipheriv('aes-256-gcm', key(pepper), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]);
}
