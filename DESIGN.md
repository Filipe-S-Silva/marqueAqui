---
name: MarqueAqui
description: Agendamento para salões e barbearias, com gestão completa e simplicidade.
colors:
  azul-eletrico: "#1d4ed8"
  azul-eletrico-noite: "#60a5fa"
  turquesa: "#06b6d4"
  turquesa-foco: "#0891b2"
  coral: "#f97316"
  areia: "#fef3c7"
  tinta: "#0f172a"
  noite: "#0b1220"
  papel: "#ffffff"
  cartao-noite: "#131c2e"
  azul-claro: "#e0e9fd"
  areia-apagada: "#fbe7a8"
  areia-destaque: "#fde68a"
  texto-apagado: "#57534e"
  borda: "#f1dc9c"
  borda-campo: "#e2c97a"
  vermelho-alerta: "#b91c1c"
  verde-sucesso: "#15803d"
  coral-aviso: "#c2410c"
  bloco-turquesa: "#cffafe"
  bloco-azul: "#dbe6fd"
  bloco-coral: "#ffedd5"
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
    backgroundColor: "{colors.azul-eletrico}"
    textColor: "{colors.papel}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.azul-claro}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-outline:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 12px"
  badge:
    rounded: "{rounded.full}"
    padding: "2px 10px"
    typography: "{typography.label}"
  agenda-block:
    backgroundColor: "{colors.bloco-turquesa}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
---

# Design System: MarqueAqui

## Overview

**Creative North Star: "O Balcão Organizado"**

MarqueAqui é o balcão de atendimento que nunca perde um horário: limpo, direto, sem ruído. A ordem vem primeiro: cada tela mostra o que a pessoa precisa decidir agora, com hierarquia feita de peso tipográfico e cor, não de enfeite. A paleta é vibrante e criativa: azul elétrico para agir, turquesa para orientar, coral como contraste quente, sobre areia (claro) ou azul-noite (escuro).

O sistema serve a dois produtos com a mesma linguagem: o APP (landing, portais de cliente, profissional e gestor) e o ADM (painel interno). A densidade é confortável: base tipográfica de 17px, campos e botões de 40px de altura, cartões com respiro de 20px. Os dois temas são cidadãos de primeira classe; nenhuma tela é desenhada só para um deles.

Os componentes são táteis, acolhedores, macios e confiantes: cantos generosos, sombras suaves tingidas de azul-ardósia, botões que cedem levemente ao clique.

**Key Characteristics:**
- Ordem de balcão: uma decisão principal por tela, hierarquia por peso e cor.
- Azul elétrico como única voz de ação; turquesa para foco e informação; coral só como destaque quente.
- Agenda em grade de colunas por profissional, com blocos coloridos por serviço.
- Hero com o logo que surge letra a letra e explode, revelando o produto em 3D (notebook e celular).
- Cantos generosos (16px nos cartões) e sombras suaves.
- Movimento curto e com propósito, sempre desligado com redução de movimento.

## Colors

Quatro cores de base (azul elétrico, turquesa, coral e areia) e seus tons; no escuro, o fundo é um azul-noite e azul e turquesa clareiam para manter o contraste.

### Primary
- **Azul Elétrico** (#1d4ed8): a cor da ação. Botão principal, item ativo da navegação, links de ação e o "Aqui" do logotipo. No escuro vira **Azul Elétrico Noite** (#60a5fa), com texto azul-noite por cima.

### Secondary
- **Turquesa** (#06b6d4): foco e informação. Como anel de foco em fundo claro usa **Turquesa Foco** (#0891b2), que passa de 3:1; no escuro, #22d3ee.

### Tertiary
- **Coral** (#f97316): contraste quente para destaques (partículas da explosão do hero, blocos da agenda) e base do aviso. Nunca como texto sobre areia (contraste insuficiente); para texto de aviso use **Coral Aviso** (#c2410c).

### Neutral
- **Areia** (#fef3c7): fundo do tema claro. Os cartões ficam em **Papel** (#ffffff) para separar do fundo.
- **Tinta** (#0f172a): texto do tema claro. **Noite** (#0b1220): fundo do tema escuro e véu sob diálogos (60%) e menus móveis (50%); cartões do escuro em **Cartão Noite** (#131c2e).
- **Azul Claro** (#e0e9fd), **Areia Apagada** (#fbe7a8) e **Areia Destaque** (#fde68a): botões secundários, áreas apagadas e hover.
- **Texto Apagado** (#57534e), **Borda** (#f1dc9c) e **Borda de Campo** (#e2c97a): legendas e contornos, em tons quentes para combinar com a areia.

### Semantic
- **Vermelho Alerta** (#b91c1c): ações destrutivas e campos inválidos; única cor fora da paleta, porque erro precisa ser reconhecível.
- **Verde Sucesso** (#15803d) e **Coral Aviso** (#c2410c): concluído e falta/avisos.
- **Blocos da agenda**: Bloco Turquesa (#cffafe), Bloco Azul (#dbe6fd), Bloco Coral (#ffedd5) e areia (#fef3c7), com texto escuro do mesmo matiz; no escuro, tons fundos (#155e75, #1e3a8a, #7c2d12) com texto claro.

### Named Rules
**The Uma Voz Rule.** O azul elétrico é a única cor de ação. Se dois elementos azuis competem na mesma área, um deles está errado.

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

- **Portais:** barra lateral fixa de 17rem no desktop (a partir de 1024px); no celular, gaveta sobre véu azul-noite.
- **Landing:** hero em tela cheia. Introdução: o logo surge letra a letra no centro, as letras se misturam e explodem (anel coral e partículas da paleta), cerca de 3,8s; depois, logo, descrição e botões à esquerda e os mockups 3D à direita (empilhados no celular). Demais seções limitadas a 72rem. No celular o cabeçalho mostra só logo, tema e "Criar conta".
- **Agenda:** grade com coluna de horários fixa à esquerda (3.5rem) e uma coluna por profissional (mínimo 10.5rem; rola para o lado no celular). Com um profissional só, a coluna ocupa toda a largura. A lista completa com as ações fica abaixo da grade.
- **Ritmo:** espaçamentos de 8, 12 e 16px; cartões com 20px por dentro. Páginas com conteúdo rolável usam grid de uma coluna `minmax(0, 1fr)` para nada alargar a página.

## Elevation & Depth

Sistema híbrido: superfícies separadas por tom (Areia atrás, Papel na frente) e reforçadas por sombras suaves tingidas de azul-ardósia (no escuro, preto).

### Shadow Vocabulary
- **Cartão** (`0 1px 2px rgb(30 41 59 / 0.06), 0 4px 16px -6px rgb(30 41 59 / 0.12)`): cartões, blocos da agenda e botão contornado.
- **Elevação** (`0 2px 4px rgb(30 41 59 / 0.06), 0 16px 32px -12px rgb(30 41 59 / 0.22)`): cartões interativos sob o cursor.
- **Flutuação** (`0 4px 8px rgb(30 41 59 / 0.08), 0 28px 56px -16px rgb(30 41 59 / 0.35)`): diálogos.

### Named Rules
**The Sobe ao Toque Rule.** Cartões clicáveis sobem 2px e ganham a sombra de Elevação sob o cursor, só com mouse preciso (`hover: hover`).

## Shapes

Cantos generosos: 16px em cartões e diálogos, 10px em botões, campos, itens de navegação e blocos da agenda, 6px em detalhes pequenos, pílula nos selos e fotos redondas dos profissionais. Bordas de 1px finas. Sem faixas laterais em caixas arredondadas.

## Components

### Buttons
- **Shape:** 10px, altura de 40px (32px no pequeno, 48px no grande); cedem a 0.97 ao clicar.
- **Primary:** Azul elétrico com texto branco, peso 600; hover 10% mais claro.
- **Secondary:** Azul Claro; **Outline:** Papel com contorno; **Ghost/Link:** sem fundo, link em azul elétrico.
- **Destructive:** Vermelho Alerta com texto branco.

### Chips (Badges)
- Pílula com fundo do tom a 15% e texto no tom cheio: confirmado = azul, concluído = verde, cancelado = vermelho, falta = âmbar.

### Cards / Containers
- 16px de canto, Papel ou Cartão Grafite, borda de 1px, sombra de Cartão, 20px de padding.

### Inputs / Fields
- Papel, contorno de 1px, 10px de canto, 40px de altura; foco em turquesa com anel de 2px; inválido em Vermelho Alerta.

### Navigation
- Itens de 0.875rem com ícone de 16px; o ativo é uma pílula azul elétrico que desliza entre os itens.

### Agenda em grade (assinatura)
Cabeçalho com a foto redonda do profissional (56px; 80px quando é um só) e o nome logo abaixo. Linhas a cada 30 minutos; expediente em Papel e fora dele no tom do fundo. Cada atendimento é um bloco de 10px de canto com horário, nome do cliente em negrito e serviço; a cor do bloco vem do serviço (o mesmo serviço tem a mesma cor em todas as colunas). Pausas são blocos tracejados apagados; faltas ficam a 60% de opacidade; cancelados saem da grade e ficam só na lista.

### Mockups 3D do hero
Notebook com moldura escura e base deitada em perspectiva (rotateX 70°), girado −14° em Y; celular 170px à frente, girado −24°, com a traseira 14px atrás fazendo a espessura e flutuando devagar (5s). A cena inclina até 6° seguindo o mouse (mola), parada no toque e com redução de movimento. O conteúdo das telas é a interface real (agenda em grade e início do cliente) com dados de exemplo.

### Diálogos
Cartão de 16px, sombra de Flutuação, até 28rem, sobre véu azul-noite a 60% com desfoque. Entram com leve zoom (220ms) e saem em 140ms.

## Do's and Don'ts

### Do:
- **Do** usar os tokens de cor (`--primary`, `--card`, `--border`…) para que cada tela funcione nos dois temas.
- **Do** manter um único botão azul elétrico por área de decisão; alternativas vão em Outline ou Ghost.
- **Do** colorir os blocos da agenda pelo serviço, com os tokens `--ev-*`.
- **Do** usar algarismos tabulares em horários, preços e contagens.
- **Do** manter movimentos entre 150 e 320ms com a curva `cubic-bezier(0.23, 1, 0.32, 1)` e desligá-los com `prefers-reduced-motion`.

### Don't:
- **Don't** usar coral ou turquesa puros como texto sobre areia; use Coral Aviso e Turquesa Foco.
- **Don't** usar azul elétrico para erro ou ação destrutiva; isso é papel do Vermelho Alerta.
- **Don't** colocar faixas ou listras decorativas nas bordas de cartões.
- **Don't** aplicar efeito de hover que levanta elementos em telas de toque.
