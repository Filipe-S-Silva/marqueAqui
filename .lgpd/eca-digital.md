# Menores de idade — LGPD Art. 14 e ECA Digital (Lei 15.211/2025)

Data: 2026-11-21 · Status: avaliação preliminar, **sujeita a revisão jurídica**. A autoavaliação não vincula a ANPD (Decreto 12.880/2026, Art. 19, § 2º).

## Fato
O MarqueAqui atende e pode ser usado por menores de 18 anos (declarado pela empresa): crianças e adolescentes são clientes de salões e barbearias.

## Decisão de produto (implementada)
- Conta própria **só para maiores de 18**: caixa "Tenho 18 anos ou mais" obrigatória no cadastro (`isAdult`), junto com o aceite dos Termos e da Política (`users.terms_version`, `users.terms_accepted_at`).
  Motivo: o cadastro é contratual (Art. 7º, V) e menores não contratam sozinhos (Código Civil, Arts. 3º e 4º).
- Menor é agendado pela conta do responsável ou no balcão; o dado do menor fica só no agendamento (nome), apagado 3 meses após o atendimento.
- A autodeclaração é aceitável aqui: a vedação do ECA Digital (Art. 9º, § 1º) vale para conteúdo/serviço impróprio ou proibido a menores, o que não é o caso.

## Melhor interesse (Art. 14 + Enunciado CD/ANPD nº 1/2023)
- Base legal: execução de contrato com o responsável (Art. 7º, V).
- Coleta mínima (nome de quem será atendido), sem publicidade, sem perfilamento, retenção curta.
- Nenhuma interação entre usuários, nem conteúdo exibido ao menor.

## ECA Digital — teste de acesso provável (Art. 1º, parágrafo único, cumulativo)
| Critério | Avaliação |
|---|---|
| Categoria presumida pelo Guia ANPD (rede social, loja, SO, controle editorial, jogo, adulto, IA generativa, e-commerce de itens proibidos) | **Não** se enquadra |
| I — probabilidade e atratividade de uso por menores | Sim (clientes menores existem) |
| II — facilidade de acesso | Sim (site público) |
| III — risco relevante à privacidade, segurança ou desenvolvimento | **Não identificado**: sem feed, sem conteúdo de terceiros exibido, sem chat entre usuários, sem publicidade, sem loot box, sem perfilamento |

**Conclusão preliminar:** ECA Digital **não aplicável** por ausência do critério III. Reavaliar se surgir: chat, conteúdo público de usuários, publicidade, recomendações personalizadas, gamificação ou contas de menores.

## Enquadramento ATPP
Dados de crianças/adolescentes são critério específico de alto risco (Res. 2/2022, Art. 4º). Sem critério geral (larga escala ou impacto significativo) hoje → baixo risco, dispensas de ATPP mantidas. RIPD preventivo recomendado como boa prática.
