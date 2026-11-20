---
name: MarqueAqui
description: Agendamento para salões e barbearias, com gestão completa e simplicidade.
colors:
  verde-petroleo: "#115e59"
  verde-petroleo-noite: "#2a9d93"
  azul-royal: "#1e40af"
  azul-royal-noite: "#7c9cf0"
  amarelo-ouro: "#eab308"
  nevoa: "#f3f4f6"
  grafite: "#111827"
  papel: "#ffffff"
  cartao-grafite: "#1a2232"
  verde-claro: "#e6efee"
  cinza-apagado: "#e5e7eb"
  verde-destaque: "#d5e6e4"
  texto-apagado: "#4b5563"
  borda-campo: "#d1d5db"
  vermelho-alerta: "#b91c1c"
  verde-sucesso: "#15803d"
  ambar-aviso: "#a16207"
  bloco-verde: "#cfe6e3"
  bloco-azul: "#dbe3f8"
  bloco-amarelo: "#fcefc0"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Bricolage Grotesque, Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Bricolage Grotesque, Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  label:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.verde-petroleo}"
    textColor: "{colors.papel}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.verde-claro}"
    textColor: "{colors.grafite}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-outline:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.grafite}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.grafite}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.grafite}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 12px"
  badge:
    rounded: "{rounded.full}"
    padding: "2px 10px"
    typography: "{typography.label}"
  agenda-block:
    backgroundColor: "{colors.bloco-verde}"
    textColor: "{colors.grafite}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
---

# Design System: MarqueAqui

## Overview

**Creative North Star: "O Balcão Organizado"**

MarqueAqui é o balcão de atendimento que nunca perde um horário: limpo, direto, sem ruído. A ordem vem primeiro: cada tela mostra o que a pessoa precisa decidir agora, com hierarquia feita de peso tipográfico e cor, não de enfeite. A paleta é sóbria e profissional: verde-petróleo para agir, azul royal para orientar, amarelo-ouro só para destacar, sobre cinza-névoa (claro) ou grafite (escuro).

O sistema serve a dois produtos com a mesma linguagem: o APP (landing, portais de cliente, profissional e gestor) e o ADM (painel interno). A densidade é confortável: base tipográfica de 17px, campos e botões de 40px de altura, cartões com respiro de 20px. Os dois temas são cidadãos de primeira classe; nenhuma tela é desenhada só para um deles.

Os componentes são táteis, acolhedores, macios e confiantes: cantos generosos, sombras suaves tingidas de grafite, botões que cedem levemente ao clique.

**Key Characteristics:**
- Ordem de balcão: uma decisão principal por tela, hierarquia por peso e cor.
- Verde-petróleo como única voz de ação; azul para foco e informação; amarelo só como destaque.
- Agenda em grade de colunas por profissional, com blocos coloridos por serviço.
- Cantos generosos (16px nos cartões) e sombras suaves.
- Movimento curto e com propósito, sempre desligado com redução de movimento.

## Colors

Cinco cores de base (verde-petróleo, azul royal, amarelo-ouro, névoa e grafite) e seus tons; no escuro, verde e azul clareiam para manter o contraste.

### Primary
- **Verde-petróleo** (#115e59): a cor da ação. Botão principal, item ativo da navegação, links de ação e o destaque "Aqui" do logotipo. No escuro vira **Verde-petróleo Noite** (#2a9d93), com texto quase preto por cima.

### Secondary
- **Azul Royal** (#1e40af): anel de foco de teclado, borda de campo focado e o tom "informação" (agendamento confirmado). No escuro vira **Azul Royal Noite** (#7c9cf0).

### Tertiary
- **Amarelo-ouro** (#eab308): destaque pontual e base do âmbar de aviso. Nunca como fundo de área grande nem como texto sobre fundo claro (contraste insuficiente); para texto de aviso use **Âmbar Aviso** (#a16207).

### Neutral
- **Névoa** (#f3f4f6): fundo do tema claro e, no escuro, a cor do texto.
- **Grafite** (#111827): texto do tema claro, fundo do tema escuro e véu sob diálogos (60%) e menus móveis (50%).
- **Papel** (#ffffff) e **Cartão Grafite** (#1a2232): cartões, campos e diálogos nos temas claro e escuro.
- **Verde Claro** (#e6efee), **Cinza Apagado** (#e5e7eb) e **Verde Destaque** (#d5e6e4): botões secundários, áreas apagadas e hover.
- **Texto Apagado** (#4b5563): descrições e legendas. **Borda de Campo** (#d1d5db): contorno de campos.

### Semantic
- **Vermelho Alerta** (#b91c1c): ações destrutivas e campos inválidos. É a única cor fora da paleta de base, porque erro precisa ser reconhecível.
- **Verde Sucesso** (#15803d) e **Âmbar Aviso** (#a16207): concluído e falta/avisos.
- **Blocos da agenda**: Bloco Verde (#cfe6e3), Bloco Azul (#dbe3f8), Bloco Amarelo (#fcefc0) e cinza (#e5e7eb), cada um com texto escuro do mesmo matiz; no escuro os blocos ficam saturados e escuros (#134e4a, #1e3a8a, #5c4410) com texto claro.

### Named Rules
**The Uma Voz Rule.** O verde-petróleo é a única cor de ação. Se dois elementos verdes competem na mesma área, um deles está errado.

**The Dois Climas Rule.** Toda cor existe em par, claro e escuro. Nunca use um hex fixo de tema claro em uma tela: use o token, que já troca no escuro.

## Typography

**Display Font:** Bricolage Grotesque (com Instrument Sans e system-ui como reserva)
**Body Font:** Instrument Sans (com ui-sans-serif e system-ui como reserva)

**Character:** Bricolage Grotesque dá aos títulos um peso arredondado e caloroso; Instrument Sans mantém o resto limpo e legível como uma ficha de balcão. Títulos com espaçamento levemente fechado (-0.02em) e quebra equilibrada.

### Hierarchy
- **Display** (800, 3rem no desktop e 1.875rem no celular): a pergunta do hero da landing. O logo grande do hero escala junto (4.5rem no desktop, 2.25rem no celular).
- **Headline** (800, 1.875rem): títulos de seção da landing.
- **Title** (800, 1.5rem): título de cada página dos portais.
- **Card Title** (700, 1rem): títulos de cartões e diálogos (1.125rem).
- **Body** (400, 0.875rem a 1rem): texto corrido, células de tabela, descrições; parágrafos com quebra "pretty" (sem palavra sozinha na última linha).
- **Label** (500, 0.875rem): rótulos e navegação; selos usam 600 a 0.75rem.

A base do documento é 17px (106.25%).

### Named Rules
**The Números Alinhados Rule.** Horários, preços e contagens usam algarismos tabulares (`tnum`).

## Layout

- **Portais:** barra lateral fixa de 17rem no desktop (a partir de 1024px); no celular, gaveta sobre véu grafite.
- **Landing:** hero centralizado (até 56rem) com a pergunta, "Apresentamos o" e o logo grande no centro; demais seções limitadas a 72rem. No celular o cabeçalho mostra só logo, tema e "Criar conta".
- **Agenda:** grade com coluna de horários fixa à esquerda (3.5rem) e uma coluna por profissional (mínimo 10.5rem; rola para o lado no celular). Com um profissional só, a coluna ocupa toda a largura. A lista completa com as ações fica abaixo da grade.
- **Ritmo:** espaçamentos de 8, 12 e 16px; cartões com 20px por dentro. Páginas com conteúdo rolável usam grid de uma coluna `minmax(0, 1fr)` para nada alargar a página.

## Elevation & Depth

Sistema híbrido: superfícies separadas por tom (Névoa atrás, Papel na frente) e reforçadas por sombras suaves tingidas de grafite (no escuro, preto).

### Shadow Vocabulary
- **Cartão** (`0 1px 2px rgb(17 24 39 / 0.06), 0 4px 16px -6px rgb(17 24 39 / 0.12)`): cartões, blocos da agenda e botão contornado.
- **Elevação** (`0 2px 4px rgb(17 24 39 / 0.06), 0 16px 32px -12px rgb(17 24 39 / 0.22)`): cartões interativos sob o cursor.
- **Flutuação** (`0 4px 8px rgb(17 24 39 / 0.08), 0 28px 56px -16px rgb(17 24 39 / 0.35)`): diálogos.

### Named Rules
**The Sobe ao Toque Rule.** Cartões clicáveis sobem 2px e ganham a sombra de Elevação sob o cursor, só com mouse preciso (`hover: hover`).

## Shapes

Cantos generosos: 16px em cartões e diálogos, 10px em botões, campos, itens de navegação e blocos da agenda, 6px em detalhes pequenos, pílula nos selos e fotos redondas dos profissionais. Bordas de 1px finas. Sem faixas laterais em caixas arredondadas.

## Components

### Buttons
- **Shape:** 10px, altura de 40px (32px no pequeno, 48px no grande); cedem a 0.97 ao clicar.
- **Primary:** Verde-petróleo com texto branco, peso 600; hover 10% mais claro.
- **Secondary:** Verde Claro; **Outline:** Papel com contorno; **Ghost/Link:** sem fundo, link em verde-petróleo.
- **Destructive:** Vermelho Alerta com texto branco.

### Chips (Badges)
- Pílula com fundo do tom a 15% e texto no tom cheio: confirmado = azul, concluído = verde, cancelado = vermelho, falta = âmbar.

### Cards / Containers
- 16px de canto, Papel ou Cartão Grafite, borda de 1px, sombra de Cartão, 20px de padding.

### Inputs / Fields
- Papel, contorno de 1px, 10px de canto, 40px de altura; foco em Azul Royal com anel de 2px; inválido em Vermelho Alerta.

### Navigation
- Itens de 0.875rem com ícone de 16px; o ativo é uma pílula verde-petróleo que desliza entre os itens.

### Agenda em grade (assinatura)
Cabeçalho com a foto redonda do profissional (56px; 80px quando é um só) e o nome logo abaixo. Linhas a cada 30 minutos; expediente em Papel e fora dele em Névoa. Cada atendimento é um bloco de 10px de canto com horário, nome do cliente em negrito e serviço; a cor do bloco vem do serviço (o mesmo serviço tem a mesma cor em todas as colunas). Pausas são blocos tracejados apagados; faltas ficam a 60% de opacidade; cancelados saem da grade e ficam só na lista.

### Diálogos
Cartão de 16px, sombra de Flutuação, até 28rem, sobre véu grafite a 60% com desfoque. Entram com leve zoom (220ms) e saem em 140ms.

## Do's and Don'ts

### Do:
- **Do** usar os tokens de cor (`--primary`, `--card`, `--border`…) para que cada tela funcione nos dois temas.
- **Do** manter um único botão verde-petróleo por área de decisão; alternativas vão em Outline ou Ghost.
- **Do** colorir os blocos da agenda pelo serviço, com os tokens `--ev-*`.
- **Do** usar algarismos tabulares em horários, preços e contagens.
- **Do** manter movimentos entre 150 e 320ms com a curva `cubic-bezier(0.23, 1, 0.32, 1)` e desligá-los com `prefers-reduced-motion`.

### Don't:
- **Don't** usar amarelo-ouro como texto sobre fundo claro ou como fundo de áreas grandes.
- **Don't** usar verde-petróleo para erro ou ação destrutiva; isso é papel do Vermelho Alerta.
- **Don't** colocar faixas ou listras decorativas nas bordas de cartões.
- **Don't** aplicar efeito de hover que levanta elementos em telas de toque.
