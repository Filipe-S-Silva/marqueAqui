# @marqueaqui/database — correção do erro `type "appointment_status" already exists`

## O que foi verificado no pacote
- `drizzle/` tem **uma única** migration (`0000_swift_quicksilver.sql`), com cada `CREATE TYPE` **uma vez só**; o `_journal.json` e o snapshot estão coerentes.
- Conclusão: o SQL não está duplicado. O erro acontece porque o banco **que o script realmente acessa** já contém o enum, ou seja, não é o banco que foi limpo.

## O que mudou
| Arquivo | Mudança |
|---|---|
| `src/migrate.ts` | Imprime `host` e `banco` do alvo (sem credenciais), checa se já existem enums sem histórico de migrations e, nesse caso, para com uma mensagem clara. A mensagem de erro deixou de sugerir `db:generate`. |
| `src/reset.ts` (novo) | Apaga os schemas `drizzle` e `public` do banco de `DATABASE_URL` e recria `public`. Só roda com `--yes` e recusa `NODE_ENV=production`. |
| `package.json` | Novo script `db:reset`. |

## Passo a passo (PowerShell, dentro de `packages/database`)
1. Copie `src/migrate.ts`, `src/reset.ts` e `package.json` para o seu projeto (ou extraia este zip por cima da pasta).
2. Verifique se há `DATABASE_URL` no ambiente do Windows, que tem prioridade sobre o `.env`:
   ```powershell
   echo $env:DATABASE_URL
   ```
   Se aparecer algo, remova na sessão atual: `Remove-Item Env:DATABASE_URL`
3. Rode as migrations e **confira a linha `Alvo:`** no início da saída:
   ```powershell
   npm run db:migrate
   ```
   O `host` (`ep-...neon.tech`) deve ser o do branch de teste que você limpou. Se não for, corrija o `DATABASE_URL` no `.env`.
4. Se o script avisar que o banco já tem enums e o alvo estiver correto (banco de teste descartável), zere e migre:
   ```powershell
   npm run db:reset -- --yes
   npm run db:migrate
   ```
5. (Opcional) Popule os dados de teste: `npm run db:seed`

## Observações
- Use a connection string **direta** do Neon (host sem `-pooler`) para migrations, com `?sslmode=require`.
- `db:reset` apaga TODOS os dados do banco alvo. Nunca aponte para produção.
- Use só `db:generate` + `db:migrate`; evite misturar com `drizzle-kit push` no mesmo banco.
- Os scripts passaram apenas na checagem de sintaxe. Não foram executados contra um banco, pois não há acesso ao seu Neon neste ambiente.
