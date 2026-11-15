# EasyService&Cia — MarqueAqui

Plataforma SaaS multiempresa de agendamento para salões e barbearias.

> **Estado desta entrega (honesto):** código gerado por fases em um ambiente **sem acesso ao registro npm**.
> Nada foi instalado, compilado nem executado contra PostgreSQL. O que foi **realmente executado**:
> 23 testes do domínio de disponibilidade/datas (`packages/database/tests`) e 14 testes de utilitários
> (`app/backend/tests`), todos com `node --test`. O restante passou apenas por verificação de sintaxe.
> Rode os comandos abaixo e devolva os erros que aparecerem.

## Fases
| Fase | Escopo | Estado |
|---|---|---|
| 1 | Monorepo, banco (schema, seed, senha), domínio de agenda | Escrita; domínio testado |
| 2 | Backend APP | Escrita por completo (auth, catálogo, agendamento, agendas, pausas, notificações, gestor, perfil, job de inatividade); **não executada** |
| 3 | Frontend APP | Escrita (landing, login/cadastro/recuperação, troca obrigatória de senha, avisos pós-login, portais cliente/profissional/gestor, perfil, tema); **nunca compilada nem aberta no navegador** |
| 4 | Backend ADM (`admin:create`, dashboard, empresas, usuários, administradores) | Escrita; **só os utilitários de segurança foram executados** (5 testes: HMAC, JWT, rate limit) |
| 5 | Frontend ADM (login, painel, empresas, usuários, administradores, confirmação de senha em toda mutação) | Escrita; **nunca compilada nem aberta no navegador** |
| 6 | Testes de integração, CI, revisão de segurança | Escrita (`SECURITY-REVIEW.md`, `.github/workflows/ci.yml`, `*/backend/tests/security.integration.test.ts`); **integração nunca executada**, IDOR e refresh token sem teste |

## Estrutura
```
packages/rate-limit  limitador de taxa: memória ou Redis (REDIS_URL), compartilhado pelas duas APIs
packages/database   schema Drizzle, migrações, seed, senha (argon2id), domínio puro (datas e disponibilidade)
app/backend         API Fastify 5 (porta 3333)
app/frontend        React 19 + Vite 6 + Tailwind 4 (porta 5173)
adm/backend         API Fastify 5 do ADM (porta 3334)
adm/frontend        React 19 + Vite 6 + Tailwind 4 (porta 5174)
```

## Pré-requisitos
Node 22+, npm 10+, Docker.

## Instalação e banco
```bash
npm install
cp packages/database/.env.example packages/database/.env
cp app/backend/.env.example app/backend/.env      # defina JWT_SECRET e PASSWORD_PEPPER (32+ caracteres aleatórios)
cp adm/backend/.env.example adm/backend/.env      # ADMIN_EMAIL_PEPPER (diferente do PASSWORD_PEPPER) e o MESMO PASSWORD_PEPPER do APP
cp packages/database/.env.example packages/database/.env   # idem: mesmo PASSWORD_PEPPER (usado por db:seed)
cp app/frontend/.env.example app/frontend/.env    # VITE_API_URL e VITE_WHATSAPP_NUMBER (DDI+DDD+número)
npm run db:up         # PostgreSQL 16 em 127.0.0.1:5432 (+ banco marqueaqui_test)
npm run db:generate   # gera as migrações a partir do schema
npm run db:migrate
# Se db:migrate acusar "type ... already exists": sobraram tipos de uma tentativa anterior (apagar tabelas não apaga enums).
# Em banco de DESENVOLVIMENTO:  npm run db:reset -- --yes   e depois  npm run db:migrate
# Se mudou o schema depois de gerar: apague packages/database/drizzle e rode db:generate de novo (ainda não há dados reais).
npm run db:seed       # dados de desenvolvimento (NÃO cria administradores)
npm run admin:create  # cria o administrador inicial (interativo; senha com 12+ caracteres)
```

## Execução
```bash
npm run dev           # sobe os projetos disponíveis
npm run typecheck
npm test              # hoje: domínio + utilitários (módulos puros)
# integração (exige banco migrado; sem TEST_DATABASE_URL os testes são ignorados):
TEST_DATABASE_URL=postgres://USUARIO:SENHA@127.0.0.1:5432/marqueaqui_test npm run test:integration -w @marqueaqui/app-backend
TEST_DATABASE_URL=... npm run test:integration -w @marqueaqui/adm-backend
npm run users:sweep   # varredura manual de contas inativas
```

## Credenciais — SOMENTE DESENVOLVIMENTO
Senhas e usuário do Postgres do `docker-compose.yml` e do seed são valores de desenvolvimento, públicos neste repositório.
**Nunca** use em produção. O seed recusa rodar com `NODE_ENV=production` sem `ALLOW_SEED=1`.
`.env` está no `.gitignore` (apenas `.env.example` é versionado). Logins do seed são impressos ao final de `db:seed`
(gestores `ana.gestora@` / `bruno.gestor@`, profissionais `*.pro@`, clientes `*.cliente@` em `marqueaqui.dev`).

## Endpoints do backend APP (parcial)
- `POST /auth/register|login|refresh|forgot-password|reset-password`; `GET /auth/me`; `POST /auth/logout|change-password|select-shop`
- Público: `GET /public/partners`, `/public/shops`, `/public/shops/:shopId/services`, `/public/shops/:shopId/availability?serviceId&date`
- Cliente: `GET /client/dashboard`, `GET|POST /client/appointments`, `POST /client/appointments/:id/cancel`
- Equipe: `GET /staff/agenda`, `GET /manager/agenda`, `POST /staff/appointments`, `GET /staff/clients/lookup`, `POST /staff/appointments/:id/(cancel|complete|no-show)`, `GET|POST|DELETE /staff/breaks`
- Notificações: `GET /notifications`, `/notifications/pending`, `POST /notifications/:id/(ack|read)`
- Gestor: `GET|POST /manager/team`, `PUT /manager/team/:barberId/(services|working-hours)`, `POST /manager/team/:barberId/(deactivate|reactivate)`, `GET|POST /manager/services`, `PATCH /manager/services/:id`, `PATCH /manager/shop`, `GET /manager/reports/(summary|export?format=csv|doc)`
- Perfil: `PATCH /profile` (apenas nome, telefone, foto, descrição)
- Gestor (adicionais): `GET /manager/dashboard`, `GET /manager/reports/full`, `POST /manager/me/professional` (atender também), `GET|POST /manager/managers`, `DELETE /manager/services/:id` (desativa se houver histórico), `GET /manager/team/:barberId/affected.doc`
- Profissional: `GET /staff/dashboard`
- `GET /health`

## Decisões e limitações documentadas
- **tsx** executa TypeScript em dev; imports usam extensão `.ts`.
- **Rate limiting em memória**: vale para uma instância. Com várias, trocar por armazenamento compartilhado.
- **Reservas**: transação + `pg_advisory_xact_lock` por profissional + índice único parcial. Ainda sem teste de concorrência real.
- **Sessão**: access token JWT HS256 (15 min) + refresh rotativo em cookie HttpOnly `mq_refresh`, com detecção de reuso.
- **Hash legado** assumido no formato `scrypt:<saltHex>:<hashHex>` (reconfirmar) e regravado como argon2id no login.
- **Sem SMTP**: em desenvolvimento o link de redefinição aparece no log; em produção nada é enviado.
- **Versões de dependências não validadas** contra o registro; podem exigir ajuste.
- **Pendência conhecida:** alterar a grade de horários não reavalia agendamentos futuros já confirmados fora da nova grade.
- **CORS/cookies em desenvolvimento:** o frontend (5173) chama o backend (3333) diretamente com `credentials: include`; `CORS_ORIGIN` do backend precisa conter `http://localhost:5173`. O cookie de refresh é SameSite=Strict (mesmo site, portas diferentes).
- **Frontend sem lib de componentes gerada pelo CLI do shadcn:** os componentes em `components/ui` foram escritos à mão seguindo o padrão (tokens CSS, cva, Radix Dialog/Label/Slot). `Select` é o `<select>` nativo estilizado.
- **Pendências do frontend APP:** página de histórico de notificações (hoje só o aviso obrigatório pós-login e o contador), consulta de histórico por profissional, edição do telefone para vazio no perfil, testes de componente.
- **Pendência de backend:** desativar profissional não gera ainda notificação para o profissional; relatório lê o mês inteiro em memória (adequado ao porte atual).

## Backend ADM (porta 3334)
- **Login:** nome + e-mail + senha. O e-mail do admin existe somente como HMAC-SHA256 com `ADMIN_EMAIL_PEPPER` (não é recuperável: perder o pepper invalida os logins). Máx. 5 falhas por IP a cada 15 min (429). JWT próprio (emissor/audiência/segredo distintos do APP), 8 h, só via `Authorization: Bearer`.
- **Confirmação de senha:** toda rota que altera dados exige `adminPassword` no corpo, conferida no backend contra o hash do admin autenticado (403 `PASSWORD_CONFIRMATION_FAILED`; falhas limitadas por admin).
- **Rotas:** `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `GET /dashboard`; `GET|POST /shops`, `GET|PATCH /shops/:id`, `POST /shops/:id/status`, `POST /shops/:id/managers`, `POST /shops/:id/managers/:userId/status`; `GET|POST /users`, `GET /users/export?format=csv|doc` (até 5.000 linhas do filtro), `GET|PATCH /users/:id`, `POST /users/:id/(status|shops|shops/remove|reset-password)`; `GET|POST /admins`, `PATCH /admins/:id`, `POST /admins/:id/(reset-password|status)`.
- **Desativar empresa:** transação que trava a linha da empresa, cancela agendamentos futuros (histórico preservado) e cria avisos por perfil (cliente: só os seus; profissional: só os seus; gestor: todos, com lista que gera o `.doc` no navegador). Reservas novas esperam a transação (trava `FOR SHARE`) e são recusadas. Reativar avisa a equipe e **não** restaura agendamentos.
- **Travas na API:** admin não desativa a si mesmo nem o último ativo; empresa não fica sem gestor ativo; remoção de vínculo mantém ao menos um; profissional com agendamentos futuros não perde vínculo.
- **Limitações assumidas:** logout do ADM é só do lado do cliente (JWT sem estado; desativar a conta revoga na hora); redefinir senha de admin usa o id da conta listada (o e-mail não é armazenado); o job de inatividade varre clientes e profissionais, não gestores; lógica de cancelamento em lote está duplicada entre APP e ADM.

## Pendências reais (estado final desta entrega)
- **Nada foi executado** além de 42 testes de módulos puros. Falta rodar: `npm install`, `db:up`, `db:generate`, `db:migrate`, `db:seed`, `admin:create`, `typecheck`, `test`, testes de integração e `build`. Erros de tipo e de runtime são esperados e devem ser devolvidos para correção.
- Sem teste de IDOR/BOLA, de rotação/reuso de refresh token, de componentes React (Vitest/RTL) nem de ponta a ponta (Playwright).
- Sem ESLint. Componentes "shadcn" escritos à mão, versões de dependências não validadas, formato legado de scrypt presumido.
- Frontend APP sem página de histórico de notificações e sem histórico por profissional.
- Limitador em memória, logout do ADM sem revogação, cancelamento duplicado entre APP e ADM, troca de horários não reavalia agendamentos futuros.
- Sem SMTP. Veja `SECURITY-REVIEW.md` para o detalhamento e a severidade de cada ponto.

## Segurança reforçada (adaptada do documento de requisitos de segurança)
Escrito, **não executado**. Detalhes e limites em `SECURITY-REVIEW.md`.
- **Senhas:** argon2id (19 MiB, 2 passes) com **pepper** (`PASSWORD_PEPPER`, HMAC-SHA256 antes do hash), igual no APP, no ADM, no seed e no `admin:create`. Obrigatório em produção. Hashes antigos sem pepper são aceitos uma vez e regravados no login. **Perder o pepper invalida todas as senhas.**
- **Bloqueio de conta:** 5 senhas erradas bloqueiam por 15 min (APP e ADM), contador atômico em um único `UPDATE`. Conta inexistente, bloqueada, inativa ou com senha errada gastam o mesmo tempo (hash fictício) e devolvem a mesma mensagem.
- **Sessões do ADM:** token aleatório de 32 bytes; só o SHA-256 fica na tabela `admin_sessions` (separada de `sessions`, então um token de um lado não vale no outro). Duração `ADMIN_SESSION_TTL_DAYS` (padrão 7). **Logout apaga a sessão.** Trocar a senha encerra as outras sessões. O JWT do ADM foi removido (`ADMIN_JWT_SECRET` não existe mais).
- **Senha provisória do admin:** administrador criado por outro ou com senha redefinida só consegue `/auth/me`, `/auth/logout` e `/auth/change-password` até trocá-la.
- **HTTP:** `Permissions-Policy` adicionada; caractere NUL em corpo/query/params é rejeitado com 400 (o PostgreSQL daria 500). CORS já recusa `*` e `null` na inicialização.

## O que o administrador pode fazer (ADM)
| Função | Estado |
|---|---|
| Listar/buscar/filtrar usuários, ver perfil com empresas, papel e **sessões ativas** (sem hash) | Feito |
| Editar nome, telefone, classe e vínculos; ativar/desativar (cancela futuros, avisa, revoga sessões) | Feito |
| **Encerrar todas as sessões** de um usuário; **desbloquear** conta | Novo |
| Redefinir senha (e-mail da conta + senha do admin); encerra sessões e bloqueio | Feito + bloqueio |
| Administradores: criar, renomear, ativar/desativar (nunca a si mesmo nem o último), redefinir senha, **encerrar sessões**, **desbloquear** | Novo/ampliado |
| **Minha conta:** trocar a própria senha, ver e encerrar outras sessões | Novo |
| **Comunicados** para todos, por classe ou por empresa (opcionalmente com "Entendi" obrigatório) | Novo |
| **Auditoria:** consulta filtrável de ações administrativas e eventos de segurança | Novo |
| Empresas: criar, editar, gestores, ativar/desativar, consultar o ID da empresa (busca por ID); exportar CSV/.doc; imprimir/PDF | Feito |
| Não adaptado: excluir conta, chat de suporte, feedbacks, relatório DOCX/PDF nativo, "zerar cotas" | Sem equivalente no MarqueAqui ou fora do escopo; ver `SECURITY-REVIEW.md` |

## Auditoria, rate limit compartilhado, 2FA e CSP (ADM)
Escrito, **não executado**. Exceto onde indicado, nada disto rodou contra banco, Redis ou navegador.
- **Auditoria (`admin_audit`):** tabela própria para o painel, com tipo (`AUTH`, `SECURITY`, `USER`, `SHOP`, `PLAN`, `ANNOUNCEMENT`, `ADMIN`), administrador, ação, alvo e IP. A página **Auditoria** filtra por tipo, por administrador, por ação e por data. Nunca são gravados senhas, tokens, códigos nem textos de mensagens (a gravação descarta chaves com esses nomes; comunicados registram só quantidade de destinatários e tamanho do título). Eventos do APP continuam em `audit_logs` e **não** aparecem nessa página. Não existem feedbacks nem suporte no MarqueAqui, então não há registro deles.
- **Rate limit compartilhado:** com `REDIS_URL` (`redis://` ou `rediss://`, ex.: Upstash) as duas APIs contam no mesmo Redis (janela deslizante, script Lua atômico, chaves `mq:rl:<nome>:<chave>`). **Se o Redis cair a API continua, mas o limite deixa de valer até ele voltar** (um aviso é registrado a cada 30 s). Sem `REDIS_URL`, memória por instância. Pacote `packages/rate-limit`; o `ioredis` só é carregado quando a URL existe.
- **2FA (TOTP, RFC 6238):** no login do ADM, se a conta tem 2FA, a senha correta devolve um desafio (5 min, 5 tentativas) e o painel pede o código de 6 dígitos **ou** um código de recuperação. A página **Segurança** tem QR code (gerado no navegador), 8 códigos de recuperação mostrados **uma única vez**, geração de novos códigos e desativação (pedem senha + código). O segredo fica cifrado (AES-256-GCM, chave derivada de `ADMIN_EMAIL_PEPPER`); os códigos de recuperação ficam como HMAC e valem uma vez; o mesmo código TOTP não vale duas vezes. Erros de 2FA contam para o bloqueio da conta. **Resetar 2FA** fica em Administradores (no MarqueAqui os administradores são contas separadas dos usuários; usuários comuns não têm 2FA). `ADMIN_REQUIRE_2FA=true` obriga todo administrador a ativar o 2FA antes de usar o painel e impede desativá-lo.
- **CSP e cabeçalhos:** `netlify.toml` em `app/frontend` e `adm/frontend` com CSP restritiva (`script-src 'self'`, sem inline), HSTS, nosniff, `X-Frame-Options: DENY`, `Permissions-Policy` sem câmera/microfone. O script de tema foi para `public/theme-init.js`. **Troque a origem da API em `connect-src`** pela URL real. `style-src` mantém `'unsafe-inline'` porque o Radix injeta `<style>`. Não há microfone liberado em nenhum dos dois (o MarqueAqui não usa microfone). Não verificado em navegador.

## Logins, suporte e avaliações (novidades)

- **Dois logins, uma conta**: clientes entram em `/login`; gestores e profissionais em `/parceiro/login`. Parceiro que entra pelo login de cliente tem acesso normal à área do cliente; cliente (sem vínculo com empresa) é recusado no login de parceiro e as rotas de parceiro respondem 403. O portal fica gravado na sessão (`sessions.portal`) e é conferido no backend a cada requisição.
- **Feedback à equipe**: qualquer usuário envia sugestão/elogio/reclamação (`POST /feedback`); o ADM lista, filtra e muda o status (com senha do admin, auditado).
- **Chamados**: qualquer usuário abre e acompanha chamados (`/tickets`); só o dono vê o chamado (404 para os demais). O ADM responde e altera o status (senha obrigatória, auditoria sem o texto da mensagem) e o usuário recebe notificação.
- **Avaliações das empresas**: o cliente avalia atendimento concluído (1–5 + comentário, uma por atendimento); o gestor vê a média/distribuição e responde uma vez (`/manager/reviews`).
- **Planos removidos**: não há mais plano de empresa (banco, seed, API e telas do ADM).
- **Gestor** pode deixar de atender (`Deixar de atender`, cancela os agendamentos futuros dele com aviso) e voltar (`Atender também`); ao adicionar profissional, se o e-mail já tem cadastro (inclusive em outra empresa) ele é apenas vinculado, sem precisar informar o nome.
- **Landing**: sem lista de empresas parceiras (o formulário "Seja parceiro" permanece). Texto-base ampliado (17px) e texto secundário com mais contraste nos dois fronts.
- Nada disto foi executado: só verificação de sintaxe (tsc) foi feita no ambiente de geração. Após atualizar, apague `packages/database/drizzle`, rode `npm install` na raiz, `npm run db:reset -- --yes`, `db:generate`, `db:migrate`, `db:seed` e `npm run doctor`.

## Fotos, reservas repetidas, avaliações e retenção (novidades)

- **Foto do profissional/gestor**: anexada em *Meu perfil* (PNG, JPEG ou WebP, até 5 MB). O arquivo é enviado como corpo binário (`PUT /profile/photo`), validado pela assinatura do arquivo (SVG e HTML são recusados) e guardado no banco (`user_photos`). A foto aparece no agendamento (serviços e horários), na equipe e no menu. `GET /photos/:id` é público só para contas ativas de profissional/gestor; clientes não têm foto servida.
- **Agendar de novo**: no início da área do cliente e em cada atendimento concluído/cancelado. Só empresa e serviço são reaproveitados; a data é sempre escolhida de novo. Na escolha de horário aparecem todos os profissionais do serviço, com foto e quantidade de horários livres.
- **Avaliações**: ao concluir o atendimento o cliente recebe uma notificação e um convite no início ("Avaliar agora"). A nota média e os comentários ficam visíveis na tela de serviços de cada empresa (só o primeiro nome do cliente).
- **Retenção de 3 meses**: um job diário apaga agendamentos CONCLUÍDOS, CANCELADOS e com FALTA com data anterior a `RETENTION_MONTHS` (padrão 3). Confirmados nunca são apagados. As avaliações permanecem. Consequência: relatórios do gestor só enxergam os últimos 3 meses de histórico. Execução manual: o script de varredura (`jobs/sweep-cli.ts`) roda também a limpeza.
- **Senha provisória**: o padrão de desenvolvimento passou a ser `easyService` (só desenvolvimento; em produção defina `DEFAULT_PASSWORD`). O ADM vê a senha ao cadastrar gestor, em Empresas > Novo e em Detalhe > Gestores, e o gestor é obrigado a trocá-la no primeiro acesso.
- Testes puros que rodaram aqui: `node --test tests/retention.test.ts tests/image.test.ts` (em `app/backend`). O restante continua sem execução (sem npm no ambiente de geração).

## Design e animações

- **Fontes:** Bricolage Grotesque (títulos e números) e Instrument Sans (texto), via Google Fonts. A CSP dos `netlify.toml` já libera `fonts.googleapis.com` e `fonts.gstatic.com`.
- **Identidade:** paleta azul/branco/vermelho (claro) e azul-escuro/preto/vermelho (escuro); a "listra de barbeiro" (`.pole`) aparece só em faixas finas, no logo e em indicadores de carregamento. Sombras com tom azulado (`shadow-card`, `shadow-lift`, `shadow-float`).
- **Hero (app):** `BarberChair` (SVG em camadas com profundidade 3D) entra pequena, gira e cresce até o lado direito, enquanto "Marque aqui!" (h1) e "por EasyService&Cia" (h2) se formam letra a letra (`Molded`). Com `prefers-reduced-motion`, tudo aparece já no estado final. A agenda de exemplo (`HeroAgenda`, cursor escolhendo horários em loop) ficou na seção "Agenda em tempo real".
- **Sistema:** transição curta ao trocar de página, indicador de menu que desliza (`layoutId`), gaveta mobile com curva de gaveta, diálogos com entrada/saída, assistente de agendamento com troca lateral de etapas e barra de progresso, check desenhado na confirmação, KPIs que contam até o valor (`CountUp`), listas com entrada escalonada (`Rise`), toasts animados, skeleton com brilho e, no ADM, o modal de senha treme quando a senha está errada.
- **Regras seguidas:** só `transform`/`opacity`; sem `transition: all`; hover só em ponteiro preciso; `prefers-reduced-motion` respeitado.
- **Status:** escrito sem build nem verificação visual (sem acesso ao npm no ambiente de geração). Se algo ficar fora do lugar ou o movimento parecer lento/rápido, envie um print ou a descrição.

## Solução de problemas

- `Cannot find package '@marqueaqui/rate-limit'` ou `Failed to resolve import "qrcode"`: as dependências novas (workspace `packages/rate-limit`, `qrcode`, `ioredis`) só são ligadas por um `npm install` na **raiz** do projeto. Depois de trocar os arquivos por uma versão nova, rode `npm install` na raiz antes de `npm run dev`.
- **Login não funciona / "Não foi possível conectar à API":** rode `npm run doctor` na raiz. Ele confere dependências, os três `.env` (JWT_SECRET, PASSWORD_PEPPER igual nos três), banco, `/health` das APIs e o CORS. Ordem esperada: `npm install` → copiar os `.env.example` → `npm run db:up` → `db:generate` → `db:migrate` → `db:seed` → `npm run dev`.
- **QR Code do 2FA:** é gerado por `adm/frontend/src/lib/qr.ts` (sem dependência externa), testado com um decodificador real.
