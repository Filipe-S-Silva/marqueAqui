# Discovery LGPD — MarqueAqui (L1)

Data: 2026-11-21 · Fonte: inspeção estática do repositório (commit `3ef9cea`). Nada foi executado contra banco ou produção.

## 1. Dados pessoais armazenados (`packages/database/src/schema.ts`)

| Tabela | Titular | Dados pessoais | Observação |
|---|---|---|---|
| `users` | cliente, profissional, gestor | nome, e-mail, telefone, hash de senha (argon2id + pepper), foto, descrição, último login, motivo de desativação | Inativo é **desativado, nunca apagado** |
| `user_photos` | profissional/gestor | imagem (bytea) | Servida sem autenticação em `GET /photos/:id` (id = id do usuário, sequencial) |
| `appointments` | cliente (com ou sem conta) | nome e telefone do cliente (cópia), data/hora, serviço, preço, notas | Apagado 3 meses após encerrado (`RETENTION_MONTHS`) |
| `shop_reviews` | cliente | `client_id`, nota, comentário, serviço e data | **Permanece** após o agendamento ser apagado |
| `sessions` | usuários APP | IP, user-agent, hash do token | `deleteExpiredSessions` existe mas **não é chamado** em lugar nenhum |
| `password_reset_tokens` | usuários APP | hash do token | — |
| `audit_logs` | usuários / admins | ator, ação, entidade, IP | Metadata sem PII (verificado: só contagens e nomes de campos). Sem retenção definida |
| `admins`, `admin_sessions`, `admin_audit`, `admin_challenges` | equipe interna | nome, HMAC do e-mail, IP, UA, segredo TOTP cifrado (AES-256-GCM) | Bom padrão de minimização |
| `notifications` | usuários | título/mensagem com datas e serviços | Sem retenção definida |
| `platform_feedbacks`, `support_tickets`, `ticket_messages` | usuários | texto livre | Texto livre pode conter qualquer dado (inclusive sensível). Sem retenção definida |

Nenhum dado sensível (Art. 5º, II) é coletado por campo estruturado. Texto livre (notas, comentários, chamados) pode receber dados sensíveis de forma incidental.

## 2. Fluxos e exposições relevantes

- **Cadastro** (`POST /auth/register`, [auth.schemas.ts:4](../app/backend/src/schemas/auth.schemas.ts)): nome, e-mail, telefone opcional, senha. **Sem aceite de termos/política, sem aviso de privacidade, sem pergunta de idade.**
- **Busca de cliente pela equipe** ([scheduling.service.ts:304](../app/backend/src/services/scheduling.service.ts)): qualquer profissional de qualquer empresa consulta um cliente da plataforma pelo e-mail e recebe nome, foto, telefone mascarado e data de cadastro. Rate limit 20/min. Confirma existência de conta (enumeração) e expõe dados a empresas com que o cliente nunca teve relação.
- **Agendamento de balcão**: equipe grava nome/telefone de pessoas **sem conta** — titulares sem canal nem aviso.
- **Relatórios do gestor** ([manager.service.ts:336](../app/backend/src/services/manager.service.ts)): exportação CSV/DOC com nome e telefone de clientes.
- **Exportação do ADM** ([users.service.ts:28](../adm/backend/src/services/users.service.ts)): até 5.000 usuários com nome e e-mail em CSV/DOC.
- **Fotos** ([photo.routes.ts:24](../app/backend/src/routes/photo.routes.ts)): públicas e enumeráveis por id. Coerente com a vitrine de profissionais, mas deve constar no aviso.
- **Exclusão de conta / portabilidade**: inexistentes (README: "Não adaptado: excluir conta").

## 3. Logs

- Pino com `redact` de `authorization`/`cookie` ([app.ts:38](../app/backend/src/app.ts)). O ADM não redige `cookie` ([adm app.ts:19](../adm/backend/src/app.ts)).
- **PII em log de produção**: [mailer.ts:10](../app/backend/src/plugins/mailer.ts) registra o e-mail (`to`) do usuário a cada pedido de redefinição. Em dev registra também o link com token (aceitável só em dev).
- Logs vão para a Vercel (retenção da plataforma, fora do repo).

## 4. Terceiros e infraestrutura (versionado)

| Terceiro | Uso | Dados | Local provável |
|---|---|---|---|
| Vercel | API do APP (serverless + cron diário) | todos os dados em trânsito, logs | `vercel.json` sem `regions` → padrão da Vercel (EUA). **Validar** |
| Netlify | hospedagem dos fronts + proxy `/api` | IP, requisições, logs de acesso | CDN global. **Validar** |
| Provedor PostgreSQL | banco | todos | Não está no repo. **Validar** |
| Upstash Redis (opcional) | rate limit | IP/chave de usuário | Não está no repo. **Validar** |
| Google Fonts | fontes nos dois fronts ([index.html:18](../app/frontend/index.html)) | IP e user-agent do visitante enviados ao Google | EUA |
| WhatsApp (`wa.me`) | link "Quero ser parceiro" | só o que o visitante digitar | iniciado pelo usuário |
| SMTP | ainda não integrado | e-mail | — |

Sem analytics, pixels, Sentry/APM ou cookies de terceiros. Cookie próprio: refresh token HttpOnly; `localStorage` só para tema. Service worker não guarda respostas de `/api`.

## 5. Controles de segurança já presentes (pontos positivos)

argon2id + pepper, bloqueio por tentativas, rate limit, refresh token rotativo em cookie HttpOnly/SameSite=Strict, CSP restritiva, HSTS, 2FA TOTP no ADM com segredo cifrado, e-mail de admin guardado só como HMAC, auditoria sem PII, retenção automática de agendamentos, desativação por inatividade.

## 6. Textos públicos

Nenhuma Política de Privacidade, Termos de Uso, identificação do controlador ou contato do Encarregado/canal de privacidade no repositório.
