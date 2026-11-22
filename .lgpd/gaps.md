# Gaps LGPD — MarqueAqui

Data: 2026-11-21 · Base: `.lgpd/discovery.md`. "Lei" = exigência expressa; "Boa prática" = controle recomendado.

## Matriz de gap analysis

| Dimensão | Status | Evidência | Tipo |
|---|---|---|---|
| Inventário de dados e cookies/SDKs | PARCIAL | Levantado em discovery.md; falta `data-map.md` formal | Técnica + Governança |
| Base legal por atividade (Arts. 7º/11) | GAP | Nada documentado | Jurídica |
| Encarregado (Res. 18/2024) ou canal ATPP (Res. 2/2022, Art. 11) | GAP | Nenhum contato publicado | Organizacional + Web |
| Direitos do titular / DSAR (Arts. 18–19) | GAP | Sem exclusão de conta, exportação ou canal; titulares de balcão sem acesso | Técnica + Operacional |
| Consentimento | N/A provável | Atividades centrais cabem em execução de contrato (Art. 7º, V); confirmar em L3 | Jurídica |
| Criptografia em trânsito / repouso | PARCIAL | HTTPS/HSTS e TOTP cifrado OK; criptografia do banco depende do provedor | Infra (validação externa) |
| Trilha de auditoria sem PII | OK (no código) | metadata só com contagens/campos | — |
| Retenção, bloqueio e eliminação (Arts. 15–16) | PARCIAL | Agendamentos 3 meses OK; usuários inativos, sessões, auditoria, avaliações, chamados e notificações sem prazo | Técnica + Jurídica |
| Terceiros por papel + contratos (Art. 39) | VALIDAÇÃO EXTERNA | Vercel, Netlify, banco, Upstash, Google Fonts | Contratual |
| Transferência internacional (Art. 33) | VALIDAÇÃO EXTERNA | Vercel sem `regions` (EUA por padrão); Google Fonts (EUA) | Contratual + Infra |
| Runbook e registro de incidentes (Res. 15/2024) | GAP | Inexistente | Operacional |
| Política de privacidade (Art. 9º) | GAP | Inexistente | Jurídica + Web |
| ECA Digital (Lei 15.211/2025) | A DECIDIR | Não é categoria presumida; cadastro aberto sem aferição de idade | Produto + Jurídica |

## P0 — Exposição imediata / regulatória alta

> 2026-11-21: itens 1, 2, 3, 4, 4b implementados no código; 7 com runbook em `incidents/`. Pendentes: 5 (definir e-mail do canal e nome do responsável pessoa física nas páginas; CNPJ quando formalizar), 6 (revisão jurídica da minuta em `app/frontend/src/features/legal/LegalPages.tsx`), aplicar a migração `0003` antes do deploy.

### Engenharia (repositório)
1. **Exclusão de conta e acesso aos dados** (Lei — Art. 18, II, V e VI; Art. 19). Endpoint autenticado `DELETE /profile` (anonimizar `users`, apagar foto, sessões, tokens; manter agendamentos/avaliações só pelo prazo justificado) e `GET /profile/export` (JSON). Tela no perfil.
2. **E-mail do usuário no log de produção** (Lei — Art. 46, segurança). [mailer.ts:10](../app/backend/src/plugins/mailer.ts): remover `to` do `log.warn`. Adicionar `req.headers.cookie` ao `redact` do ADM.
3. **Busca de cliente por e-mail entre empresas** (Lei — Art. 6º, III necessidade). [scheduling.service.ts:304](../app/backend/src/services/scheduling.service.ts): limitar a clientes que já têm agendamento na empresa, ou devolver só `id` + nome sem foto/data de cadastro.
4. **Aviso de privacidade no cadastro e no agendamento de balcão** (Lei — Art. 9º). Link para a política no `RegisterPage` e no rodapé da landing; aviso curto ao gravar cliente de balcão.

4b. **Menores de idade** (Lei — Art. 14 LGPD + capacidade civil): produto usado por menores (confirmado em 2026-11-21). Definir quem pode ter conta (recomendado: titular da conta 18+, menor atendido pela conta do responsável ou no balcão) e registrar a avaliação de melhor interesse e do ECA Digital em `.lgpd/eca-digital.md`.

### Jurídico / Organizacional
5. **Canal de privacidade** (Lei — Art. 41 ou Res. 2/2022, Art. 11): e-mail dedicado publicado no site; designar Encarregado se não for ATPP.
6. **Política de privacidade v1** (Lei — Art. 9º): após ROPA (L11–L13).
7. **Runbook de incidente** (Lei — Res. 15/2024, Arts. 6º e 10): prazo de 3 dias úteis (6 se ATPP elegível) e registro interno por 5 anos.

## P1 — Fundamentos e contratos

### Engenharia
8. **Sessões expiradas nunca apagadas** (Lei — Art. 15/16, necessidade): `deleteExpiredSessions` existe em [auth.repository.ts:135](../app/backend/src/repositories/auth.repository.ts) mas não é chamado; incluir no `/internal/maintenance` junto com tokens de redefinição vencidos.
9. **Prazos de retenção para o restante** (Lei — Art. 15): usuários desativados (anonimizar após N meses), `audit_logs`/`admin_audit`, notificações lidas, chamados fechados, feedbacks arquivados, avaliações (desvincular `client_id` após X).
10. **Google Fonts** (Lei — Art. 33 + transparência): hospedar as fontes localmente (`@fontsource/*` ou arquivos em `public/`) elimina a transferência de IP ao Google e simplifica a CSP.
11. **Banco no Neon `us-east-2` (EUA)** (visto no `.env` local): transferência internacional confirmada. Avaliar migrar o banco para São Paulo (`sa-east-1`) junto com a Vercel em `gru1`.
11b. **Região da Vercel**: definir `"regions": ["gru1"]` em `vercel.json` se o banco estiver no Brasil (reduz transferência internacional; também latência).

### Jurídico / Organizacional
12. Mapa de dados formal + base legal por atividade (L2–L3). Papel do MarqueAqui provavelmente **operador** para os dados de clientes de cada estabelecimento e **controlador** para contas da plataforma — decisão jurídica que muda contratos e política.
13. Contratos/DPAs e mecanismo de transferência (cláusulas-padrão Res. 19/2024 para EUA) com Vercel, Netlify, banco e Upstash.
14. Termos com os estabelecimentos definindo quem é controlador dos dados dos clientes de balcão e das exportações CSV.

## P2 — Maturidade

15. Fotos: id não sequencial (UUID/hash) em `/photos/:id` para evitar enumeração.
16. Exportações (gestor e ADM): registrar em auditoria quem exportou, quantas linhas e quando.
17. Texto livre (notas, chamados): aviso "não informe dados de saúde" no campo.
18. Avaliar ECA Digital e base legal para adolescentes (clientes de salão podem ser menores; cadastro aberto sem idade).
