// Hash e verificação de senhas. Argon2id (19 MiB, 2 iterações, paralelismo 1), spec 10.1.
// Hashes legados em scrypt continuam válidos e pedem migração no próximo login bem-sucedido.
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import * as argon2 from 'argon2';
import { MIN_PEPPER_LENGTH, pepperPassword } from './pepper.ts';

const ARGON_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // KiB = 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

// Formato legado assumido: "scrypt:<saltHex>:<hashHex>" com N=16384, r=8, p=1, 64 bytes.
// Os arquivos do projeto anterior foram perdidos; ajuste aqui se os dados reais usarem outro formato.
const SCRYPT_PREFIX = 'scrypt:';

function scryptAsync(password: string, salt: Buffer, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, { N: 16384, r: 8, p: 1 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

let pepper: string | undefined;

/**
 * Define o pepper do processo (PASSWORD_PEPPER). Deve ser IGUAL no APP, no ADM, no seed e no admin:create,
 * porque as contas criadas por um são verificadas pelo outro. Perder o pepper invalida todas as senhas.
 */
export function configurePasswordPepper(value: string | undefined): void {
  if (value !== undefined && value.length < MIN_PEPPER_LENGTH) {
    throw new Error(`PASSWORD_PEPPER precisa ter pelo menos ${MIN_PEPPER_LENGTH} caracteres.`);
  }
  pepper = value || undefined;
}

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(pepperPassword(password, pepper), ARGON_OPTIONS);
}

export interface VerifyResult {
  valid: boolean;
  /** true quando o hash está em scrypt ou com parâmetros antigos de argon2: regravar após login. */
  needsRehash: boolean;
}

export async function verifyPassword(storedHash: string, password: string): Promise<VerifyResult> {
  if (storedHash.startsWith(SCRYPT_PREFIX)) {
    const [, saltHex, hashHex] = storedHash.split(':');
    if (!saltHex || !hashHex) return { valid: false, needsRehash: false };
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
    const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
    return { valid, needsRehash: valid };
  }
  try {
    if (await argon2.verify(storedHash, pepperPassword(password, pepper))) {
      return { valid: true, needsRehash: argon2.needsRehash(storedHash, ARGON_OPTIONS) };
    }
    // Hash gravado antes de existir pepper: aceita uma vez e manda regravar com pepper no login.
    if (pepper && (await argon2.verify(storedHash, password))) return { valid: true, needsRehash: true };
    return { valid: false, needsRehash: false };
  } catch {
    return { valid: false, needsRehash: false };
  }
}

let dummyHash: Promise<string> | undefined;

/** Hash descartável para equalizar o tempo de resposta quando a conta não existe (spec 10.2). */
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(24).toString('base64url'));
  return dummyHash;
}

/** Gera um hash legado em scrypt. Usado apenas em testes e em migrações de dados antigos. */
export async function hashPasswordLegacyScrypt(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `${SCRYPT_PREFIX}${salt.toString('hex')}:${key.toString('hex')}`;
}
