# Runbook — Incidente de segurança com dados pessoais

Base: LGPD Art. 48 + Resolução CD/ANPD nº 15/2024. Controlador: [nome completo], pessoa física (sem CNPJ por enquanto; ATPP — Res. 2/2022).
**Revisar com o jurídico e preencher os nomes antes de usar.**

## Papéis
| Papel | Quem | Contato |
|---|---|---|
| Responsável pela decisão (comunica ANPD/titulares) | [preencher] | [preencher] |
| Técnico de plantão (contenção) | [preencher] | [preencher] |
| Jurídico | [preencher] | [preencher] |

## Prazos
- **T+0** = momento em que se soube que o incidente **afetou dados pessoais**. Registrar data e hora em `log.md` imediatamente.
- Comunicação à ANPD e aos titulares: **6 dias úteis** (prazo em dobro para ATPP).
  **Exceção: 3 dias úteis** se houver risco à integridade física ou moral dos titulares ou à segurança nacional/pública.
- Comunicação preliminar pode ser complementada em até 20 dias úteis.

## 1. Contenção (primeiras horas)
1. **Credenciais:** trocar `JWT_SECRET` (encerra todos os tokens de acesso), senha do banco (`DATABASE_URL`), `CRON_SECRET`, `REDIS_URL` e tokens da Vercel/Netlify.
   Não trocar `PASSWORD_PEPPER` nem `ADMIN_EMAIL_PEPPER` sem plano: invalida todas as senhas / logins de admin.
2. **Sessões:** revogar todas (`UPDATE sessions SET revoked_at = now() WHERE revoked_at IS NULL;` e `DELETE FROM admin_sessions;`).
3. **Acesso indevido de conta interna:** desativar o admin/usuário no ADM.
4. **Vulnerabilidade no código:** pausar o deploy afetado (Vercel/Netlify) ou reverter para o deploy anterior.

## 2. Preservação de evidências
- Exportar logs da Vercel e da Netlify do período (a retenção das plataformas é curta: fazer no mesmo dia).
- Exportar `audit_logs` e `admin_audit` do período.
- Snapshot do banco antes de qualquer correção de dados.
- Guardar tudo fora do ambiente afetado, com data e hash (`sha256sum`).

## 3. Triagem: é preciso comunicar? (Res. 15/2024, Art. 5º)
Comunicar se houver **risco ou dano relevante** aos titulares **E** pelo menos uma categoria:
- [ ] dados sensíveis
- [ ] dados de **crianças, adolescentes** ou idosos (o MarqueAqui atende menores: considerar sempre)
- [ ] dados financeiros
- [ ] **dados de autenticação** (hash de senha, tokens, segredos TOTP)
- [ ] dados protegidos por sigilo
- [ ] dados em larga escala

Decisão e justificativa vão para `log.md`, **mesmo se não comunicar**.

## 4. Comunicação à ANPD (12 itens — Art. 6º, § 2º)
Pelo formulário oficial no site da ANPD: natureza e categorias dos dados; número de titulares (e de menores); medidas de segurança anteriores; riscos; motivo de eventual atraso; medidas para reverter/mitigar; data do incidente e de quando se soube; dados do encarregado/canal; identificação do controlador; dados do operador (se houver); descrição do incidente e causa; total de titulares no sistema.

## 5. Comunicação aos titulares (7 itens — Art. 9º)
Linguagem simples, por e-mail e aviso na plataforma (notificação com confirmação de leitura): o que aconteceu, quais dados, riscos, medidas tomadas, o que o titular deve fazer (ex.: trocar senha), data, e o canal de contato.

## 6. Depois
- Corrigir a causa, revisar `.lgpd/gaps.md`, registrar lições em `log.md`.
- Ensaio (tabletop) deste runbook a cada 12 meses (boa prática).
