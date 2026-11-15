// ZERA o banco de DESENVOLVIMENTO: apaga os schemas `public` e `drizzle` (tabelas, tipos e histórico de migrations).
// Uso:  npm run db:reset -- --yes
// Recusa rodar com NODE_ENV=production ou sem --yes. Nunca aponte para um banco com dados que você queira manter.
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { createDatabase } from './client.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL não definida.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('db:reset é proibido com NODE_ENV=production.');
  process.exit(1);
}
let target = '(desconhecido)';
try {
  const u = new URL(url);
  target = `${u.hostname}${u.pathname}`;
} catch { /* mostra o padrão */ }

if (!process.argv.includes('--yes')) {
  console.error(`Isto APAGA todos os dados de ${target}.\nRode de novo com:  npm run db:reset -- --yes`);
  process.exit(1);
}

const { db, close } = createDatabase(url, { max: 1 });
try {
  console.log(`Zerando ${target}…`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  console.log('Pronto. Agora rode: npm run db:migrate');
} catch (error) {
  console.error('Falha ao zerar o banco.', error);
  process.exitCode = 1;
} finally {
  await close();
}
