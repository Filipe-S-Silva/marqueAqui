# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Todos os perfis pesam igual nas decisões de design; quando houver conflito, a decisão precisa ser explícita, nunca favorecer um perfil por omissão.

- **Cliente:** encontra um salão ou barbearia, escolhe serviço, profissional e horário livre, confirma e depois acompanha ou cancela os próprios agendamentos.
- **Profissional:** acompanha a própria agenda do dia, registra pausas, marca atendimentos como concluídos, cancelados ou falta, e agenda clientes pelo balcão.
- **Gestor:** dono ou gerente do estabelecimento; administra equipe, serviços, expediente, pausas, agenda geral, avaliações e relatórios. Pode também atender como profissional.
- **Administrador da plataforma (ADM):** equipe interna da EasyService&Cia que administra empresas, usuários, administradores, comunicados, suporte e auditoria em um painel separado.

## Product Purpose

MarqueAqui é uma plataforma SaaS multiempresa de agendamento para salões e barbearias. Existe para acabar com conflitos de horário e horários vazios: o cliente reserva em segundos a qualquer hora, e o estabelecimento controla equipe, expediente e faturamento num só lugar. Sucesso significa clientes reservando sem ligar ou mandar mensagem, e gestores operando a agenda sem planilha.

## Positioning

Gestão completa com simplicidade: o estabelecimento ganha controle de ponta a ponta (equipe, serviços por profissional, expediente, pausas, agenda, avaliações e relatórios), e o cliente reserva com o mínimo de passos. Os horários livres exibidos vêm direto da agenda real; o que o cliente confirma aparece na hora na agenda do profissional.

## Operating Context

- Produto em lançamento: ainda não há estabelecimentos reais usando.
- Dois produtos web em pt-BR: o APP (landing pública e portais de cliente, profissional e gestor) e o ADM (painel interno da plataforma).
- Novos estabelecimentos entram em contato pelo WhatsApp, com mensagem pronta gerada na landing.
- Profissionais criados pelo gestor recebem uma senha padrão e precisam trocá-la no primeiro acesso.
- Avisos importantes chegam como notificações que exigem confirmação de leitura após o login.

## Capabilities and Constraints

- Agenda em blocos de 30 minutos; duração dos serviços é múltipla de 30 minutos.
- Disponibilidade calculada a partir do expediente, das pausas e dos agendamentos existentes de cada profissional.
- Cancelamento pelo cliente; profissional e gestor registram conclusão, cancelamento ou falta (no-show).
- Avaliações dos atendimentos concluídos, com resposta do gestor; feedback e chamados de suporte.
- Relatórios do gestor com exportação em CSV e DOC.
- Contas inativas são desativadas automaticamente (padrão: 45 dias) e agendamentos encerrados são apagados após o período de retenção (padrão: 3 meses).
- Tema claro e escuro.
- Terminologia: "estabelecimento" (salão ou barbearia), "profissional", "gestor", "cliente", "agendamento", "expediente", "pausa".
- Stack existente: React 19, Vite 6 e Tailwind 4 nos frontends; Fastify 5, PostgreSQL e Drizzle nos backends.

## Brand Commitments

- Nome do produto: **MarqueAqui**; empresa: **EasyService&Cia**.
- Voz em português do Brasil, direta e tranquilizadora ("Reserve em segundos, a qualquer hora.", "Só você vê os seus agendamentos.").

## Evidence on Hand

- Dados de estabelecimentos, profissionais e clientes existem apenas como seed de desenvolvimento (`packages/database`), não como clientes reais.
- Não há depoimentos, casos de uso, números de uso, imprensa nem logos de clientes. Nada disso deve ser inventado.

## Product Principles

1. A agenda é a verdade: nada exibido ao cliente pode prometer um horário que a agenda real não sustenta.
2. Menos passos vencem: cada fluxo frequente (reservar, cancelar, registrar atendimento) deve ser concluído com o mínimo de decisões.
3. Controle sem planilha: o gestor deve conseguir operar equipe, horários e resultados sem ferramenta paralela.
4. Privacidade visível: cada pessoa vê apenas o que lhe diz respeito, e o produto deixa isso claro.
5. Todos os perfis contam: nenhuma melhoria para um perfil pode degradar silenciosamente a experiência de outro.

## Accessibility & Inclusion

Interface em pt-BR (`lang="pt-BR"`). Clientes e profissionais incluem pessoas pouco familiarizadas com tecnologia; textos, rótulos e mensagens de erro devem ser simples e diretos. Nenhum padrão formal (como WCAG AA) foi definido como requisito.
