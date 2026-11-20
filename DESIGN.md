---
name: MarqueAqui
description: Agendamento para salões e barbearias, com gestão completa e simplicidade.
colors:
  meia-noite: "#071039"
  jet-black: "#0d0d0d"
  soft-white: "#fafafa"
  bold-blue: "#1c22a8"
  light-blue: "#4263e3"
  carvao: "#161616"
  moldura-noite: "#1c1c1c"
  marinho: "#0f2270"
  ultramarino: "#1a3bb0"
  azul-vivo: "#2e5de6"
  azul-ceu: "#6e92f2"
  azul-nevoa: "#afc5f8"
  gelo: "#e6edfd"
  papel: "#ffffff"
  cartao-noite: "#0b1850"
  gelo-apagado: "#d5e1fb"
  gelo-destaque: "#c4d4f9"
  texto-apagado: "#34437a"
  vermelho-alerta: "#b91c1c"
  verde-sucesso: "#15803d"
  ambar-aviso: "#b45309"
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
    backgroundColor: "{colors.ultramarino}"
    textColor: "{colors.papel}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.gelo-apagado}"
    textColor: "{colors.meia-noite}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-outline:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.meia-noite}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.meia-noite}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.meia-noite}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 12px"
  badge:
    rounded: "{rounded.full}"
    padding: "2px 10px"
    typography: "{typography.label}"
  agenda-block:
    backgroundColor: "{colors.azul-nevoa}"
    textColor: "{colors.meia-noite}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
---

# Design System: MarqueAqui

## Overview

**Creative North Star: "O Balcão Organizado"**

MarqueAqui é o balcão de atendimento que nunca perde um horário: limpo, direto, sem ruído. A ordem vem primeiro: cada tela mostra o que a pessoa precisa decidir agora, com hierarquia feita de peso tipográfico e cor, não de enfeite. A paleta é Ultramarino, sete degraus de um mesmo azul (de #071039 a #E6EDFD): confiança sem frieza. O degrau médio age, os claros fazem os fundos e os escuros dão peso, tanto no tema claro (fundo gelo) quanto no escuro (fundo meia-noite).

O sistema serve a dois produtos com a mesma linguagem: o APP (landing, portais de cliente, profissional e gestor) e o ADM (painel interno). A densidade é confortável: base tipográfica de 17px, campos e botões de 40px de altura, cartões com respiro de 20px. Os dois temas são cidadãos de primeira classe; nenhuma tela é desenhada só para um deles.

Os componentes são táteis, acolhedores, macios e confiantes: cantos generosos, sombras suaves tingidas de meia-noite, botões que cedem levemente ao clique.

**Key Characteristics:**
- Ordem de balcão: uma decisão principal por tela, hierarquia por peso e cor.
- Ultramarino (#1A3BB0) como única voz de ação; os outros degraus do azul fazem fundo, borda e foco.
- Agenda em grade de colunas por profissional, com blocos coloridos por serviço.
- Hero com o logo que surge letra a letra e explode, revelando o produto em 3D (notebook e celular).
- Cantos generosos (16px nos cartões) e sombras suaves.
- Movimento curto e com propósito, sempre desligado com redução de movimento.

## Colors

Uma escala monocromática de sete azuis; cada degrau tem um papel fixo. Só sucesso, aviso e erro saem da escala, porque precisam ser reconhecíveis.

### Primary
- **Ultramarino** (#1a3bb0): a cor da ação. Botão principal, item ativo da navegação, links de ação e o "Aqui" do logotipo; texto branco por cima (contraste acima de 8:1). No escuro, a ação usa **Light Blue** (#4263e3) com texto Soft White.

### Secondary
- **Azul Vivo** (#2e5de6): anel de foco de teclado e borda de campo focado no tema claro; no escuro o foco usa **Azul Névoa** (#afc5f8).

### Neutral
- **Gelo** (#e6edfd): fundo do tema claro; cartões em **Papel** (#ffffff).
- **Meia-noite** (#071039): texto do tema claro e véu sob diálogos (60%) e menus móveis (50%). O tema escuro usa uma paleta própria: **Jet Black** (#0d0d0d) no fundo, **Carvão** (#161616) nos cartões, **Soft White** (#fafafa) no texto, **Light Blue** (#4263e3) na ação (texto Soft White); quando o azul é a cor do próprio texto (links, o "Aqui" do logo), usa #8098ef, porque #4263e3 sobre Jet Black fica em 3.8:1 e **Bold Blue** (#1c22a8) em superfícies de destaque, avatares e blocos. **Marinho** (#0f2270): superfícies secundárias e apagadas no escuro; cartões do escuro em **Cartão Noite** (#0b1850).
- **Gelo Apagado** (#d5e1fb) e **Gelo Destaque** (#c4d4f9): botões secundários, áreas apagadas, hover e bordas no tema claro; **Azul Névoa** (#afc5f8) contorna campos.
- **Texto Apagado** (#34437a): legendas no claro; no escuro, Azul Névoa.

### Semantic
- **Vermelho Alerta** (#b91c1c), **Verde Sucesso** (#15803d) e **Âmbar Aviso** (#b45309): erro/ação destrutiva, concluído e falta/avisos.
- **Blocos da agenda**: degraus da escala com texto que contrasta em cada um. Claro: Azul Névoa (texto meia-noite), Azul Céu (texto meia-noite), Azul Vivo (texto branco) e Gelo (texto marinho). Escuro: Ultramarino, Azul Vivo, Azul Céu e Azul Névoa.

### Named Rules
**The Uma Voz Rule.** O ultramarino é a única cor de ação. Se dois botões cheios competem na mesma área, um deles está errado; o segundo vira contornado ou fantasma.

**The Dois Climas Rule.** Toda cor existe em par, claro e escuro. Nunca use um hex fixo de tema claro em uma tela: use o token, que já troca no escuro.

## Typography

**Display Font:** Bricolage Grotesque (com Instrument Sans e system-ui como reserva)
**Body Font:** Instrument Sans (com ui-sans-serif e system-ui como reserva)

**Character:** Bricolage Grotesque dá aos títulos um peso arredondado e caloroso; Instrument Sans mantém o resto limpo e legível como uma ficha de balcão. Títulos com espaçamento levemente fechado (-0.02em) e quebra equilibrada.

### Hierarchy
- **Display** (800, 4.5rem no desktop e 2.25rem no celular): o logo da introdução do hero, montado letra a letra. Na tela do produto o logo usa 3rem (2.25rem no celular).
- **Headline** (800, 1.875rem): títulos de seção da landing.
- **Title** (800, 1.5rem): título de cada página dos portais.
- **Card Title** (700, 1rem): títulos de cartões e diálogos (1.125rem).
- **Body** (400, 0.875rem a 1rem): texto corrido, células de tabela, descrições; parágrafos com quebra "pretty" (sem palavra sozinha na última linha).
- **Label** (500, 0.875rem): rótulos e navegação; selos usam 600 a 0.75rem.

A base do documento é 17px (106.25%).

### Named Rules
**The Números Alinhados Rule.** Horários, preços e contagens usam algarismos tabulares (`tnum`).

## Layout

- **Portais:** barra lateral fixa de 17rem no desktop (a partir de 1024px); no celular, gaveta sobre véu meia-noite.
- **Landing:** hero em tela cheia. Introdução: o logo surge letra a letra no centro, as letras se misturam e explodem (anel azul-céu e partículas nos degraus da escala), cerca de 3,8s; depois, logo, descrição e botões à esquerda e os mockups 3D à direita. No celular os mockups vêm primeiro, reduzidos a 75% (zoom), e o logo com o texto logo abaixo, tudo na primeira tela. Demais seções limitadas a 72rem. No celular o cabeçalho mostra só logo, tema e "Criar conta".
- **Agenda:** grade com coluna de horários fixa à esquerda (3.5rem) e uma coluna por profissional (mínimo 10.5rem; rola para o lado no celular). Com um profissional só, a coluna ocupa toda a largura. A lista completa com as ações fica abaixo da grade.
- **Ritmo:** espaçamentos de 8, 12 e 16px; cartões com 20px por dentro. Páginas com conteúdo rolável usam grid de uma coluna `minmax(0, 1fr)` para nada alargar a página.

## Elevation & Depth

Sistema híbrido: superfícies separadas por tom (Gelo atrás, Papel na frente) e reforçadas por sombras suaves tingidas de meia-noite (no escuro, preto).

### Shadow Vocabulary
- **Cartão** (`0 1px 2px rgb(7 16 57 / 0.06), 0 4px 16px -6px rgb(7 16 57 / 0.12)`): cartões, blocos da agenda e botão contornado.
- **Elevação** (`0 2px 4px rgb(7 16 57 / 0.06), 0 16px 32px -12px rgb(7 16 57 / 0.22)`): cartões interativos sob o cursor.
- **Flutuação** (`0 4px 8px rgb(7 16 57 / 0.08), 0 28px 56px -16px rgb(7 16 57 / 0.35)`): diálogos.

### Named Rules
**The Sobe ao Toque Rule.** Cartões clicáveis sobem 2px e ganham a sombra de Elevação sob o cursor, só com mouse preciso (`hover: hover`).

## Shapes

Cantos generosos: 16px em cartões e diálogos, 10px em botões, campos, itens de navegação e blocos da agenda, 6px em detalhes pequenos, pílula nos selos e fotos redondas dos profissionais. Bordas de 1px finas. Sem faixas laterais em caixas arredondadas.

## Components

### Buttons
- **Shape:** 10px, altura de 40px (32px no pequeno, 48px no grande); cedem a 0.97 ao clicar.
- **Primary:** Ultramarino com texto branco, peso 600; hover 10% mais claro.
- **Secondary:** Gelo Apagado; **Outline:** Papel com contorno; **Ghost/Link:** sem fundo, link em ultramarino.
- **Destructive:** Vermelho Alerta com texto branco.

### Chips (Badges)
- Pílula com fundo do tom a 15% e texto no tom cheio: confirmado = azul, concluído = verde, cancelado = vermelho, falta = âmbar.

### Cards / Containers
- 16px de canto, Papel ou Cartão Grafite, borda de 1px, sombra de Cartão, 20px de padding.

### Inputs / Fields
- Papel, contorno de 1px, 10px de canto, 40px de altura; foco em azul vivo com anel de 2px; inválido em Vermelho Alerta.

### Navigation
- Itens de 0.875rem com ícone de 16px; o ativo é uma pílula ultramarino que desliza entre os itens.

### Agenda em grade (assinatura)
Cabeçalho com a foto redonda do profissional (56px; 80px quando é um só) e o nome logo abaixo. Linhas a cada 30 minutos; expediente em Papel e fora dele no tom do fundo. Cada atendimento é um bloco de 10px de canto com horário, nome do cliente em negrito e serviço; a cor do bloco vem do serviço (o mesmo serviço tem a mesma cor em todas as colunas). Pausas são blocos tracejados apagados; faltas ficam a 60% de opacidade; cancelados saem da grade e ficam só na lista.

### Fundo líquido do hero
Referência: motion background azul (ondas desfocadas sobre azul profundo). Quatro manchas grandes com desfoque de 64px derivam devagar (19 a 27s, ida e volta, só transform). Escuro: base #050505 com ondas Bold Blue e Light Blue; claro: base Gelo com ondas Azul Névoa e Gelo Destaque e um toque de Azul Céu. Fica parado com redução de movimento. Vale só para o hero; o resto da página usa o fundo liso.

### Menu lateral (celular)
Abaixo de 640px o cabeçalho da landing mostra só logo, tema e um botão de menu. O menu entra pela direita (260ms) com Criar conta (principal), Entrar (contornado), Sou parceiro (fantasma) e os atalhos das seções; fecha ao navegar, no X, no Esc ou tocando fora.

### Mockups 3D do hero
Notebook com moldura meia-noite no claro e **Moldura Noite** (#1c1c1c, preto da paleta Jet Black) no escuro e base deitada em perspectiva (rotateX 70°), girado −14° em Y; celular em camada própria por cima, girado −22°, com a traseira 14px atrás fazendo a espessura e flutuando devagar (5s). Notebook e celular não compartilham o mesmo espaço 3D, para o plano do notebook nunca cortar o celular. A cena inclina até 6° seguindo o mouse (mola), parada no toque e com redução de movimento. O conteúdo das telas é a interface real (agenda em grade e início do cliente) com dados de exemplo.

### Diálogos
Cartão de 16px, sombra de Flutuação, até 28rem, sobre véu meia-noite a 60% com desfoque. Entram com leve zoom (220ms) e saem em 140ms.

## Do's and Don'ts

### Do:
- **Do** usar os tokens de cor (`--primary`, `--card`, `--border`…) para que cada tela funcione nos dois temas.
- **Do** manter um único botão ultramarino por área de decisão; alternativas vão em Outline ou Ghost.
- **Do** colorir os blocos da agenda pelo serviço, com os tokens `--ev-*`.
- **Do** usar algarismos tabulares em horários, preços e contagens.
- **Do** manter movimentos entre 150 e 320ms com a curva `cubic-bezier(0.23, 1, 0.32, 1)` e desligá-los com `prefers-reduced-motion`.

### Don't:
- **Don't** usar Azul Céu ou Azul Névoa como texto sobre fundo claro; o contraste não passa.
- **Don't** usar ultramarino para erro ou ação destrutiva; isso é papel do Vermelho Alerta.
- **Don't** colocar faixas ou listras decorativas nas bordas de cartões.
- **Don't** aplicar efeito de hover que levanta elementos em telas de toque.
