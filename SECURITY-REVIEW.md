# Revisão de segurança, EasyService&Cia-MarqueAqui

**Método:** revisão estática do código escrito nas Fases 1 a 5. **Nada foi executado contra banco, servidor ou navegador**, porque o registro npm esteve bloqueado no ambiente de geração. Os únicos testes executados foram os de módulos puros (42, ver README). Os testes de integração desta fase estão escritos, passaram só por verificação de sintaxe e **nunca rodaram**.

Classificação: **Confirmado** = visível no código lido; **Potencial** = depende de ambiente ou uso; **Não verificado** = precisa de execução.

## Resumo executivo
Os controles pedidos existem no código: parametrização via Drizzle, autorização no servidor com reconsulta ao banco, CORS com lista explícita, mensagens genéricas contra enumeração, rate limit, JWT com `alg` fixo, confirmação de senha do administrador validada no backend. Esta revisão **não permite afirmar que o sistema é seguro**: nenhum desses controles foi exercitado em execução. Os achados abaixo são o que a leitura mostrou.

## Matriz
| # | Achado | Severidade | Status | Local |
|---|---|---|---|---|
| 1 | Senha padrão pública como default de `DEFAULT_PASSWORD` | Média | Confirmado, **corrigido** | `*/backend/src/config/env.ts` |
| 2 | Rate limit em memória (instância única) | Média | Confirmado | `utils/rate-limit.ts`, `app.ts` |
| 3 | Token ADM em `sessionStorage` exposto a XSS; sem CSP nos frontends | Média | Potencial | `adm/frontend/src/lib/api.ts`, `index.html` |
| 4 | Logout do ADM não invalidava o token (stateless, 8 h) | Baixa | **Corrigido no código** (sessões opacas em `admin_sessions`), não verificado em execução | `adm/backend/src/services/auth.service.ts` |
| 5 | Bloqueio por conta/par permite negar login a um usuário legítimo | Baixa | Confirmado (trade-off) | `app.ts` (`loginPair`, `loginAccount`) |
| 6 | `X-Forwarded-For` só é confiável com `TRUST_PROXY` correto | Média | Potencial | `app.ts` |
| 7 | Logo por URL https externa: rastreamento de visitantes | Baixa | Confirmado | `imageUrlSchema`, `ShopAvatar` |
| 8 | Lógica de cancelamento duplicada entre APP e ADM | Baixa | Confirmado | `shops.service.ts` (ADM) e serviços do APP |
| 9 | Alteração de agenda não reavalia agendamentos futuros | Baixa | Confirmado | serviço do gestor (APP) |
| 10 | Redefinição de senha sem SMTP: link só no log em desenvolvimento | Informativo | Confirmado | `plugins/mailer.ts` |
| 11 | IDOR/BOLA entre empresas e usuários | n/a | **Não verificado** | todos os endpoints com `:id` |

## Achados

### 1. Senha padrão pública como default (Média, corrigido)
**Evidência:** `DEFAULT_PASSWORD: z.string().min(8).default('easyService')` nos dois `env.ts`. O valor está no código-fonte e no README.
**Cenário:** um deploy sem `DEFAULT_PASSWORD` define, para toda conta nova ou redefinida, uma senha que qualquer pessoa conhece. A troca obrigatória no primeiro acesso reduz a janela, mas não a elimina, pois contas criadas e ainda não acessadas ficam tomáveis.
**Correção aplicada:** com `NODE_ENV=production`, a API não sobe se `DEFAULT_PASSWORD` for o valor de desenvolvimento.
**Teste de regressão:** `loadEnv({ ...válido, NODE_ENV: 'production' })` sem `DEFAULT_PASSWORD` deve lançar erro citando `DEFAULT_PASSWORD`. **Ainda não escrito** em `env.test.ts` (que também não roda aqui por faltar o `zod`).
**Risco residual:** quem define um valor fraco continua exposto. Rotacionar e exigir troca é o controle real.

### 2. Rate limit em memória (Média)
**Evidência:** `createRateLimiter` guarda contadores em `Map` do processo.
**Cenário:** com duas instâncias, o limite efetivo dobra. Reiniciar o processo zera as janelas. Um atacante distribuído por vários IPs não é contido por limite por IP.
**Correção recomendada:** só ao escalar horizontalmente, trocar o armazenamento por um compartilhado (Redis ou tabela no Postgres) mantendo a interface. Não foi introduzido agora porque não há necessidade concreta com uma instância. Para ataque distribuído, Cloudflare Turnstile no login e no cadastro.
**Risco residual:** aceito para uma instância única.

### 3. Token ADM em `sessionStorage` e ausência de CSP nos frontends (Média, potencial)
**Evidência:** `KEY = 'mq-adm-token'` em `sessionStorage`. Os `index.html` não definem CSP; a CSP existente vale só para as respostas das APIs.
**Cenário:** uma falha de XSS lê o token. Mitigações já presentes: React escapa a saída, SVG proibido em logos, nenhum `dangerouslySetInnerHTML` previsto, e toda mutação exige a senha do administrador de novo (o token sozinho não basta para alterar dados). Leitura de dados continua possível com o token.
**Correção recomendada:** servir os frontends com CSP (`default-src 'self'; img-src 'self' https:; frame-ancestors 'none'`) no host de produção. Não verificado em execução.

### 4. Logout stateless no ADM (Baixa, corrigido no código)
**Antes:** JWT de 8 h; logout só apagava o token no navegador.
**Agora:** token aleatório de 32 bytes, só o SHA-256 na tabela `admin_sessions`; logout, troca de senha, desativação e redefinição apagam as linhas. A conta é conferida a cada requisição. Duração configurável (7 dias por padrão).
**Pendente:** testes de integração escritos (`logout apaga a sessão`, `troca de senha encerra as outras sessões`), nunca executados.

### 5. Bloqueio por conta (Baixa, trade-off; agora também em SQL)
`loginAccount` (20/15 min) e `loginPair` (5/15 min) permitem que um terceiro esgote tentativas de uma vítima e a impeça de entrar por 15 min. Foi mantido porque reduz força bruta distribuída contra uma conta. Se virar problema, trocar por backoff progressivo ou Turnstile.

### 6. `TRUST_PROXY` (Média, potencial)
Com `TRUST_PROXY=false` atrás de proxy, todos os clientes aparecem com o IP do proxy e compartilham limites. Com `true` sem proxy confiável, o cliente forja `X-Forwarded-For` e burla o limite por IP. Definir conforme a hospedagem. Não verificado.

### 7. Logo por URL externa (Baixa)
Só `https` é aceito e o servidor nunca busca a URL (sem SSRF). O navegador do visitante busca a imagem de terceiro, o que expõe IP e User-Agent. Alternativa: upload com validação de tipo e tamanho (não implementado).

### 8 e 9. Dívidas de consistência (Baixa)
A regra de cancelamento por desativação existe no APP e no ADM, em duplicidade, com risco de divergir. A mudança de horários de trabalho não reavalia agendamentos futuros já confirmados. Nenhuma das duas é vulnerabilidade; ambas podem gerar agendamento incoerente.

### 11. IDOR/BOLA (não verificado)
O código aplica filtros de empresa/usuário nos repositórios e `FOR UPDATE`/`FOR SHARE` nas operações concorrentes, mas **não há teste que prove isolamento** entre empresas ou clientes. É o teste mais importante que falta, e exige dados semeados com duas empresas e dois clientes. **Não declarar o isolamento como garantido até esse teste existir e passar.**

## Reforços desta rodada (código escrito, não executado)
- Pepper de senha com HMAC-SHA256 antes do argon2id (`packages/database/src/pepper.ts`; o módulo puro tem 2 testes que passam). Risco novo: **perder o pepper invalida todas as senhas**; guardar em cofre de segredos com backup.
- Bloqueio atômico de conta (5 erros, 15 min) no APP e no ADM, com tempo equalizado. Limitação: a atomicidade depende do `UPDATE` único; o SQL não foi executado nem validado contra o PostgreSQL (parâmetros em `make_interval`).
- Troca obrigatória de senha para administrador provisório, bloqueada no middleware por rota.
- `Permissions-Policy`; rejeição de NUL; auditoria consultável; comunicados com limite de 20.000 destinatários.
- Fora de escopo e **não** portado do documento de referência: foto de perfil com WebP/EXIF, upload de PDF, links de convite, IA/cotas, PWA, cron com `CRON_SECRET` e `withBandLock`. Não existem no MarqueAqui.
- **Rate limit compartilhado (corrige o achado 2 quando `REDIS_URL` está definida).** Contra: o modo é *fail-open*, então com o Redis fora o limite some e o login do APP/ADM fica sem proteção contra força bruta por IP até ele voltar; o bloqueio de conta por SQL (5 erros, 15 min) continua valendo porque não depende do Redis. Sem `REDIS_URL` o comportamento antigo (memória) permanece.
- **2FA TOTP no ADM**, com desafio de uso único, replay bloqueado por passo e códigos de recuperação em HMAC. Risco novo: sem recuperação nem outro administrador, quem perde o dispositivo fica fora; outro administrador pode resetar. A chave que cifra o segredo deriva do `ADMIN_EMAIL_PEPPER`; trocar o pepper apaga os segredos 2FA junto com os logins. O algoritmo TOTP foi validado com os vetores do RFC 6238 (executado); o fluxo HTTP não.
- **`admin_audit`:** a remoção de segredos é por nome de chave (regex); um chamador que coloque texto livre em uma chave inofensiva o gravaria. Mitigação: só contagens, ids e nomes de campos são passados hoje.
- **CSP no Netlify:** `'unsafe-inline'` em estilos (Radix). Sem verificação em navegador; a origem da API em `connect-src` é um placeholder.
- Limitação residual: sem `REDIS_URL` o limitador continua em memória (achado 2).

## Cobertura dos casos exigidos
| Caso | Teste escrito | Executado |
|---|---|---|
| JWT adulterado / `alg: none` / outro segredo / expirado | Sim (unitário JWT e integração) | Unitário sim; integração não |
| Token em URL rejeitado | Sim (APP e ADM) | Não |
| Enumeração no login e na recuperação | Sim | Não |
| 429 por força bruta | Sim | Não (limitador testado em unidade) |
| Logout invalida acesso (APP) | Sim | Não |
| Mass assignment (cadastro APP, `PATCH /users/:id` ADM) | Sim | Não |
| SQL injection (busca, login) | Sim | Não |
| Respostas sem hash/token | Sim | Não |
| CORS e cabeçalhos | Sim | Não |
| CLIENT bloqueado em rotas de gestor/equipe | Sim | Não |
| Senha do ADM obrigatória e validada em mutação | Sim | Não |
| Bloqueio de conta após 5 erros; NUL → 400; logout/troca de senha encerram sessão do ADM | Sim | Não |
| 2FA: ativação, 2º fator no login, replay, recuperação de uso único | Sim (integração) | Não; o TOTP/RFC 6238 e a cifra sim |
| IDOR/BOLA usuário A × B, empresa A × B | **Não escrito** (precisa de seed) | Não |
| Refresh token: rotação e reutilização | **Não escrito** | Não |
| XSS na saída do `.doc` e CSV injection | Unitário em `documents` | Sim |
| Testes de componente React / Playwright | **Não escritos** | Não |

## CI/CD
`.github/workflows/ci.yml`: tipos, testes unitários, migração em Postgres de serviço, integração APP e ADM, build dos frontends, `npm audit --omit=dev --audit-level=high`, Gitleaks e CodeQL; `dependabot.yml` semanal. **Não há ESLint configurado** (o spec pedia lint). O workflow nunca rodou; versões de actions e dependências não foram validadas.

## Critérios para bloquear integração
Falha em tipos, testes, auditoria alta/crítica em produção, segredo detectado ou alerta CodeQL alto.

## Riscos residuais e dependências externas
Rate limit compartilhado, SMTP real, CSP/HSTS no host dos frontends, `TRUST_PROXY`, validação das versões de dependências, e os testes de IDOR e de refresh token, que dependem de dados semeados e de execução.


## Adendo — suporte, avaliações e login por portal (não executado)

- **Portal na sessão**: `authorize()` exige `portal === 'partner'` nas rotas que não listam CLIENT; cliente sem empresa não obtém sessão de parceiro. Potencial: conferir em teste de integração (não escrito).
- **Chamados/feedbacks**: dono filtrado na consulta (404 para chamado alheio), `.strict()` nos corpos (sem mass assignment de status/userId), limiter `submit` (20/h por usuário). Mensagens são texto puro, renderizado pelo React sem HTML. A auditoria registra só tamanho da mensagem.
- **Avaliações**: só o próprio cliente, atendimento COMPLETED, uma por atendimento (índice único + `ON CONFLICT DO NOTHING`); resposta do gestor filtra pela empresa da sessão e só uma vez.
- **Pendente**: testes de integração de IDOR (ticket/review), de portal e de limites; sem moderação de conteúdo.


## Adendo — fotos, retenção e senha provisória (parcialmente verificado)

- **Upload de foto**: corpo binário cru (sem multipart), `bodyLimit` de 5 MB só na rota, validação por magic bytes, SVG/HTML recusados, `nosniff`, limiter `submit`. Verificado por teste puro: `sniffImage`. **Não verificado**: limite real do Fastify com 5 MB, CORS/CORP no navegador, desempenho de `bytea` no Neon (fotos grandes aumentam o banco; considerar armazenamento de objetos se houver muitas).
- **Exposição**: `GET /photos/:id` é público e a numeração é sequencial; só serve contas ativas de profissional/gestor (já visíveis a clientes no agendamento). Risco residual: enumeração dessas fotos.
- **Retenção**: apaga agendamentos antigos (dados pessoais do cliente no registro). Verificado por teste puro o cálculo da data; o `DELETE` não foi executado. Avaliações ficam com serviço e data, sem o agendamento.
- **Senha provisória exibida no ADM**: decisão do produto. É a mesma para todo gestor novo até a troca obrigatória; em produção deve ser definida em `DEFAULT_PASSWORD` (a API recusa subir com o valor de desenvolvimento) e idealmente trocada por convite/link de definição de senha. Quem tem acesso ao ADM vê a senha.
