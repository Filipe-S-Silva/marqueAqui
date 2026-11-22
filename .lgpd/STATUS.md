# LGPD Privacy Engineering Status

**Projeto**: MarqueAqui (marca EasyService&Cia, ainda sem CNPJ)
**Controlador**: pessoa física responsável (nome a preencher em LegalPages.tsx). Trocar por razão social + CNPJ ao formalizar.
**Cenário**: C (Híbrido) — código pronto, produto em lançamento sem estabelecimentos reais
**Enquadramento declarativo**: ATPP — startup (Res. 2/2022), declarado pelo usuário em 2026-11-21. Trata dados de adolescentes/crianças (critério específico do Art. 4º); sem critério geral hoje (pré-lançamento, sem larga escala) → baixo risco por ora. Reavaliar ao crescer.
**Menores**: o produto atende e pode ser usado por menores de 18 (declarado). Art. 14 LGPD aplica-se; ECA Digital: avaliar teste cumulativo do Art. 1º, parágrafo único (não é categoria presumida).
**Início**: 2026-11-21
**Última atualização**: 2026-11-21
**Encarregado / Canal**: Não definido (gap P0)

## Escopo verificado vs. fora do repositório
- **Verificado no código**: schema Drizzle, rotas e serviços do APP e ADM, jobs de retenção/inatividade, logger, configs Vercel/Netlify, fronts (storage, service worker, fontes externas).
- **Requer validação externa**: provedor e região do PostgreSQL, região efetiva da Vercel, Upstash, contratos/DPAs, retenção de logs nas plataformas, criptografia em repouso do banco, processos humanos.

## Pipeline atual
- [x] L0 — Setup
- [x] L1 — Legacy retrofit (discovery + gaps) ⏸ CHECKPOINT
- [ ] L2 — Data mapping
- [ ] L3 — Legal basis
- [ ] L4 — Encarregado / canal ATPP
- [ ] L5 — Vendors, DPA, transferências
- [ ] L6 — Retenção + anonimização
- [ ] L7 — ECA Digital (a decidir) / consentimento (provável N/A)
- [ ] L8 — Criptografia + audit logging
- [ ] L9 — DSAR
- [ ] L10 — Incidentes
- [ ] L11 — ROPA ⏸
- [ ] L12 — RIPD ⏸
- [ ] L13 — Política de privacidade ⏸
- [ ] L14 — Relatório final

## Artefatos gerados
- `.lgpd/discovery.md` — concluído, 2026-11-21
- `.lgpd/gaps.md` — concluído, 2026-11-21

## Gaps abertos
Ver `.lgpd/gaps.md`.

## P0 de engenharia (2026-11-21)
- Implementados: exportar/excluir conta, aceite de termos + 18+, páginas /privacidade e /termos (minuta), busca de cliente minimizada, e-mail fora do log, aviso no balcão. Migração `packages/database/drizzle/0003_unknown_blonde_phantom.sql`.
- Artefatos: `incidents/runbook.md`, `incidents/log.md`, `eca-digital.md`.

## Próximo passo
Aplicar a migração 0003, preencher nome do responsável e VITE_PRIVACY_EMAIL, revisão jurídica da minuta; depois P1 (retenção, Google Fonts, região).
