import 'dotenv/config';
// Cria o administrador inicial: `npm run admin:create`.
// Interativo (senha sem eco) ou por variáveis ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD (CI, ambientes sem TTY).
// Nunca imprime a senha nem o e-mail em claro depois de gravar.
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { configurePasswordPepper, createDatabase, hashPassword } from '@marqueaqui/database';
import { z } from 'zod';
import { loadEnv } from '../config/env.ts';
import * as repo from '../repositories/admins.repository.ts';
import { writeAudit } from '../repositories/audit.repository.ts';
import { emailHmac } from '../utils/hmac.ts';

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12, 'Use ao menos 12 caracteres.').max(128).regex(/[A-Za-z]/, 'Inclua letras.').regex(/\d/, 'Inclua números.'),
});

async function ask(question: string, hidden = false): Promise<string> {
  let muted = false;
  const out = new Writable({ write(chunk, _enc, cb) { if (!muted) process.stdout.write(chunk); cb(); } });
  const rl = createInterface({ input: process.stdin, output: out, terminal: true });
  const p = rl.question(question);
  muted = hidden;
  const answer = await p;
  if (hidden) process.stdout.write('\n');
  rl.close();
  return answer;
}

const env = loadEnv();
configurePasswordPepper(env.PASSWORD_PEPPER);
const fromEnv = process.env.ADMIN_NAME && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD;
const raw = fromEnv
  ? { name: process.env.ADMIN_NAME, email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }
  : { name: await ask('Nome: '), email: await ask('E-mail: '), password: await ask('Senha (mín. 12 caracteres): ', true) };

const parsed = schema.safeParse(raw);
if (!parsed.success) {
  console.error('Dados inválidos:\n' + parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}

const { db, close } = createDatabase(env.DATABASE_URL, { max: 2 });
try {
  const hmac = emailHmac(parsed.data.email, env.ADMIN_EMAIL_PEPPER);
  if (await repo.findByHmac(db, hmac)) {
    console.error('Já existe um administrador com este e-mail.');
    process.exitCode = 1;
  } else {
    const a = await repo.insert(db, { name: parsed.data.name, emailHmac: hmac, passwordHash: await hashPassword(parsed.data.password) });
    await writeAudit(db, { actorType: 'SYSTEM', action: 'admin.create_cli', entityType: 'admin', entityId: a.id });
    console.log(`Administrador criado (id ${a.id}). Entre no painel com nome, e-mail e senha informados.`);
  }
} finally {
  await close();
}
