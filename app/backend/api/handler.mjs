// Função serverless da Vercel. É .mjs de propósito: a Vercel não compila este arquivo,
// e o Node 26 executa os imports .ts direto (type stripping), como o tsx faz em dev.
import { configurePasswordPepper, createDatabase } from '@marqueaqui/database';
import { buildApp, createLimiters } from '../src/app.ts';
import { loadEnv } from '../src/config/env.ts';
import { createRateStore } from '../src/utils/rate-limit.ts';

const log = { warn: (o, m) => console.warn(m, o), info: (o, m) => console.info(m, o) };

async function init() {
  const env = loadEnv();
  configurePasswordPepper(env.PASSWORD_PEPPER);
  // Uma conexão por instância: cada instância serverless atende uma requisição por vez.
  const { db } = createDatabase(env.DATABASE_URL, { max: 1 });
  const app = await buildApp({ db, env, limiters: createLimiters(await createRateStore(env.REDIS_URL, log)) });
  await app.ready();
  return app;
}

let appPromise;

export default async function handler(req, res) {
  // Monta o app uma vez por instância; se falhar, tenta de novo na próxima requisição.
  appPromise ??= init().catch((err) => {
    appPromise = undefined;
    throw err;
  });
  const app = await appPromise;
  app.server.emit('request', req, res);
}
