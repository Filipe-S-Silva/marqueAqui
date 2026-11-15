// Aplica as migrations geradas por `npm run db:generate`, depois de checar o estado do banco.
// Uso:
//   npm run db:migrate                    -> aplica, ou aborta explicando o conflito
//   npm run db:migrate -- --fix-orphans   -> remove enums órfãos (só se não houver tabelas nem histórico)
import 'dotenv/config';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDatabase } from './client.ts';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL não definida. Copie packages/database/.env.example para .env.');
  process.exit(1);
}

const fixOrphans = process.argv.includes('--fix-orphans');
const folder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');
const { db, close } = createDatabase(url, { max: 1 });

function fail(message: string): never {
  console.error(`\n${message}\n`);
  process.exitCode = 1;
  throw new Error('abortado');
}

async function query<T>(statement: ReturnType<typeof sql>): Promise<T[]> {
  return (await db.execute(statement)) as unknown as T[];
}

try {
  if (!existsSync(path.join(folder, 'meta', '_journal.json'))) {
    fail('Não há migrations em packages/database/drizzle. Rode `npm run db:generate` antes.');
  }

  // 1) Tipos (enums) que as migrations criam, e em quais arquivos
  const typeOwners = new Map<string, string[]>();
  for (const file of readdirSync(folder).filter((f) => f.endsWith('.sql')).sort()) {
    const content = readFileSync(path.join(folder, file), 'utf8');
    for (const match of content.matchAll(/CREATE TYPE "public"\."([^"]+)"/g)) {
      const name = match[1]!;
      const owners = typeOwners.get(name) ?? [];
      if (!owners.includes(file)) owners.push(file);
      typeOwners.set(name, owners);
    }
  }

  // 2) Arquivos duplicados: dois .sql criando o mesmo tipo (geração repetida sobre uma pasta antiga)
  const duplicated = [...typeOwners].filter(([, files]) => files.length > 1);
  if (duplicated.length > 0) {
    fail(
      `Mais de uma migration cria o mesmo tipo:\n` +
        duplicated.map(([type, files]) => `  - ${type}: ${files.join(', ')}`).join('\n') +
        '\nA pasta packages/database/drizzle ficou com arquivos de gerações diferentes.\n' +
        'Apague a pasta packages/database/drizzle inteira e rode `npm run db:generate` de novo.',
    );
  }

  // 3) Estado real do banco
  const [{ ok: historyExists } = { ok: false }] = await query<{ ok: boolean }>(
    sql`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS ok`,
  );
  // O Drizzle cria a tabela de histórico ANTES de aplicar. Existir não significa que algo foi aplicado.
  const appliedCount = historyExists
    ? ((await query<{ n: number }>(sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`))[0]?.n ?? 0)
    : 0;

  if (appliedCount === 0) {
    const tables = await query<{ name: string }>(sql`
      SELECT table_name AS name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`);
    const existingEnums = (
      await query<{ name: string }>(sql`
        SELECT t.typname AS name FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public' AND t.typtype = 'e' ORDER BY 1`)
    ).map((e) => e.name);
    const conflicts = existingEnums.filter((name) => typeOwners.has(name));

    if (tables.length > 0) {
      fail(
        `O banco NÃO está limpo: há tabelas no schema public (${tables.map((t) => t.name).join(', ')}) e nenhum histórico de migrations aplicado.\n` +
          'O script não apaga tabelas automaticamente. Em banco de DESENVOLVIMENTO, zere o schema com:\n' +
          '  npm run db:reset -- --yes\n' +
          'e rode `npm run db:migrate` de novo.',
      );
    }

    if (conflicts.length > 0) {
      if (!fixOrphans) {
        fail(
          `Existem tipos (enums) órfãos no schema public: ${conflicts.join(', ')}.\n` +
            'Não há tabelas nem migrations aplicadas; são sobras de uma tentativa anterior ou de tabelas apagadas.\n' +
            'Para removê-los e continuar, rode:\n' +
            '  npm run db:migrate -- --fix-orphans',
        );
      }
      if (process.env.NODE_ENV === 'production') {
        fail('--fix-orphans é bloqueado quando NODE_ENV=production.');
      }
      console.log(`Banco: ${new URL(url).hostname}`);
      for (const name of conflicts) {
        // Sem CASCADE: se algo ainda depender do tipo, o Postgres recusa e nada é perdido.
        await db.execute(sql`DROP TYPE IF EXISTS ${sql.identifier('public')}.${sql.identifier(name)}`);
        console.log(`Tipo órfão removido: ${name}`);
      }
    }
  }

  await migrate(db, { migrationsFolder: folder });
  console.log('Migrations aplicadas com sucesso.');
} catch (error) {
  if (!(error instanceof Error && error.message === 'abortado')) {
    console.error('Falha ao aplicar migrations.', error);
    process.exitCode = 1;
  }
} finally {
  await close();
}