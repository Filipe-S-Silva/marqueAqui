// Diagnóstico de ambiente: confere .env, banco, APIs, CORS e dependências instaladas.
// Uso: npm run doctor   (não precisa de nenhuma dependência instalada)
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const G = '\x1b[32m✔\x1b[0m', R = '\x1b[31m✘\x1b[0m', Y = '\x1b[33m!\x1b[0m';
let problems = 0;
const ok = (m) => console.log(`${G} ${m}`);
const bad = (m, fix) => { problems++; console.log(`${R} ${m}${fix ? `\n    → ${fix}` : ''}`); };
const warn = (m) => console.log(`${Y} ${m}`);

function readEnv(rel) {
  const file = path.join(root, rel);
  if (!existsSync(file)) return null;
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

console.log('\n== Dependências ==');
for (const [name, rel] of [['@marqueaqui/rate-limit', 'node_modules/@marqueaqui/rate-limit'], ['@marqueaqui/database', 'node_modules/@marqueaqui/database'], ['vite', 'node_modules/vite'], ['motion', 'node_modules/motion']]) {
  existsSync(path.join(root, rel)) ? ok(name) : bad(`${name} não instalado`, 'rode `npm install` na raiz do projeto');
}

console.log('\n== Arquivos .env ==');
const envs = {
  'app/backend/.env': readEnv('app/backend/.env'),
  'adm/backend/.env': readEnv('adm/backend/.env'),
  'packages/database/.env': readEnv('packages/database/.env'),
};
for (const [rel, e] of Object.entries(envs)) {
  e ? ok(rel) : bad(`${rel} não existe`, `copie ${rel}.example para ${rel} e preencha`);
}
const app = envs['app/backend/.env'], adm = envs['adm/backend/.env'], dbEnv = envs['packages/database/.env'];
if (app) {
  if ((app.JWT_SECRET ?? '').length < 32) bad('app/backend/.env: JWT_SECRET vazio ou com menos de 32 caracteres', 'gere com: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"');
  if (!app.DATABASE_URL) bad('app/backend/.env: DATABASE_URL vazio');
  if (!(app.CORS_ORIGIN ?? '').includes('5173')) warn(`app/backend/.env: CORS_ORIGIN="${app.CORS_ORIGIN ?? ''}" não contém http://localhost:5173`);
}
if (adm) {
  if (!adm.DATABASE_URL) bad('adm/backend/.env: DATABASE_URL vazio');
  if (!(adm.CORS_ORIGIN ?? '').includes('5174')) warn(`adm/backend/.env: CORS_ORIGIN="${adm.CORS_ORIGIN ?? ''}" não contém http://localhost:5174`);
}
if (app && adm && dbEnv) {
  const peppers = [app.PASSWORD_PEPPER ?? '', adm.PASSWORD_PEPPER ?? '', dbEnv.PASSWORD_PEPPER ?? ''];
  if (new Set(peppers).size > 1) bad('PASSWORD_PEPPER diferente entre app, adm e packages/database (o login falha com "e-mail ou senha inválidos")', 'use o MESMO valor nos três .env e rode o seed de novo');
  else ok('PASSWORD_PEPPER igual nos três .env');
}
if (app && adm && app.DATABASE_URL && adm.DATABASE_URL && app.DATABASE_URL !== adm.DATABASE_URL) warn('app e adm usam DATABASE_URL diferentes: devem apontar para o mesmo banco');

function tcp(host, port, ms = 2500) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port });
    const done = (v) => { s.destroy(); resolve(v); };
    s.setTimeout(ms, () => done(false));
    s.on('connect', () => done(true));
    s.on('error', () => done(false));
  });
}

console.log('\n== Banco de dados ==');
const dbUrl = app?.DATABASE_URL;
if (dbUrl) {
  try {
    const u = new URL(dbUrl);
    (await tcp(u.hostname, Number(u.port || 5432))) ? ok(`${u.hostname}:${u.port || 5432} acessível`) : bad(`não consegui conectar em ${u.hostname}:${u.port || 5432}`, 'suba o Postgres (`npm run db:up`) ou confira a URL do Neon');
  } catch { bad('DATABASE_URL inválida'); }
}

async function api(name, base, origin) {
  console.log(`\n== ${name} (${base}) ==`);
  try {
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(3000) });
    r.ok ? ok('/health respondeu') : bad(`/health respondeu ${r.status}`);
  } catch {
    bad('API fora do ar', `rode \`npm run dev\` (ou o dev do backend) e veja o erro no terminal do ${name}`);
    return;
  }
  try {
    const r = await fetch(`${base}/auth/login`, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
      signal: AbortSignal.timeout(3000),
    });
    const allow = r.headers.get('access-control-allow-origin');
    allow === origin ? ok(`CORS libera ${origin}`) : bad(`CORS não libera ${origin} (recebido: ${allow ?? 'nada'})`, 'ajuste CORS_ORIGIN no .env do backend e reinicie');
  } catch { warn('não consegui testar o CORS'); }
}
await api('APP backend', 'http://localhost:3333', 'http://localhost:5173');
await api('ADM backend', 'http://localhost:3334', 'http://localhost:5174');

console.log('\n== Frontends ==');
for (const [n, p] of [['APP frontend', 5173], ['ADM frontend', 5174]]) {
  (await tcp('localhost', p)) ? ok(`${n} em http://localhost:${p}`) : warn(`${n} não está em http://localhost:${p}`);
}

console.log(problems ? `\n${problems} problema(s) encontrado(s). Corrija na ordem acima e rode de novo.\n` : '\nTudo certo no que dá para checar daqui. Se o login ainda falhar, confirme que rodou `npm run db:seed` (usuários de teste no README).\n');
process.exit(problems ? 1 : 0);
