---
name: MarqueAqui
description: Agendamento para salões e barbearias, com gestão completa e simplicidade.
colors:
  vermelho-marque: "#d62839"
  vermelho-marque-noite: "#ef4a5a"
  vermelho-alerta: "#b3202f"
  azul-manha: "#eef5ff"
  azul-noite: "#050a14"
  tinta-noite: "#0f1b33"
  papel: "#ffffff"
  cartao-noite: "#0b1426"
  azul-secundario: "#dbe9ff"
  azul-apagado: "#e4edfb"
  azul-destaque: "#cfe1ff"
  texto-apagado: "#3f4e68"
  borda: "#cbd9ef"
  borda-campo: "#b9cae4"
  azul-foco: "#2563c9"
  verde-sucesso: "#17794a"
  ambar-aviso: "#9a6200"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "6rem"
    fontWeight: 800
    lineHeight: 0.95
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
    backgroundColor: "{colors.vermelho-marque}"
    textColor: "{colors.papel}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-secondary:
    backgroundColor: "{colors.azul-secundario}"
    textColor: "{colors.tinta-noite}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  button-outline:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta-noite}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta-noite}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta-noite}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 12px"
  badge:
    rounded: "{rounded.full}"
    padding: "2px 10px"
    typography: "{typography.label}"
---

# Design System: MarqueAqui

## Overview

**Creative North Star: "O Balcão Organizado"**

MarqueAqui é o balcão de atendimento que nunca perde um horário: limpo, direto, sem ruído, e ainda assim com o calor de um salão de bairro. A ordem vem primeiro: cada tela mostra o que a pessoa precisa decidir agora, com hierarquia feita de peso tipográfico e cor, não de enfeite. O calor aparece nos detalhes de atendimento: o vermelho da marca, a listra de barbeiro em faixas finas e componentes que respondem ao toque como um balcão bem cuidado responde a quem chega.

O sistema serve a dois produtos com a mesma linguagem: o APP (landing, portais de cliente, profissional e gestor) e o ADM (painel interno). A densidade é confortável: base tipográfica de 17px, campos e botões de 40px de altura, cartões com respiro de 20px. Os dois temas, claro (Azul Manhã) e escuro (Azul Noite), são cidadãos de primeira classe; nenhuma tela é desenhada só para um deles.

Os componentes são táteis, acolhedores, macios e confiantes: cantos generosos, sombras suaves tingidas de azul, um botão principal com brilho interno que cede levemente ao clique.

**Key Characteristics:**
- Ordem de balcão: uma decisão principal por tela, hierarquia por peso e cor.
- Vermelho Marque como única voz de ação; azul como ambiente.
- Listra de barbeiro como assinatura, sempre em faixas finas.
- Cantos generosos (16px nos cartões) e sombras suaves tingidas de azul.
- Movimento curto e com propósito, sempre desligado com redução de movimento.

## Colors

Uma paleta de dois climas, manhã e noite, sobre a qual um único vermelho conduz a ação.

### Primary
- **Vermelho Marque** (#d62839): a cor da ação. Botão principal, item ativo da navegação, links de ação ("Cadastre-se", "Entre como parceiro"), destaque "Aqui" do logotipo e a faixa vermelha da listra de barbeiro. No tema escuro vira **Vermelho Marque Noite** (#ef4a5a), mais claro para manter o contraste sobre o Azul Noite. O ADM usa uma variação um pouco mais fechada (#c8243a).
- **Vermelho Alerta** (#b3202f): ações destrutivas (cancelar agendamento, desativar) e campos inválidos. É distinto do Vermelho Marque; os dois nunca dividem a mesma função.

### Neutral
- **Azul Manhã** (#eef5ff): fundo do tema claro, às vezes com um degradê suave para azul mais intenso nos cantos do hero.
- **Azul Noite** (#050a14): fundo do tema escuro; também a cor do véu sob diálogos e menus móveis (60% de opacidade com desfoque).
- **Tinta Noite** (#0f1b33): texto principal do tema claro.
- **Papel** (#ffffff): cartões, campos e diálogos no tema claro. No escuro, os cartões usam **Cartão Noite** (#0b1426).
- **Azul Secundário** (#dbe9ff), **Azul Apagado** (#e4edfb) e **Azul Destaque** (#cfe1ff): fundos de botões secundários, áreas apagadas e estados de hover, em ordem crescente de presença.
- **Texto Apagado** (#3f4e68): descrições, legendas e e-mail do usuário na barra lateral.
- **Borda** (#cbd9ef) e **Borda de Campo** (#b9cae4): divisórias e contornos de cartões; campos têm contorno um pouco mais forte.

### Semantic
- **Azul Foco** (#2563c9): anel de foco de teclado, borda de campo focado, faixa azul da listra de barbeiro e o tom "informação" (agendamento confirmado).
- **Verde Sucesso** (#17794a): atendimento concluído, confirmações.
- **Âmbar Aviso** (#9a6200): falta (no-show) e avisos.

### Named Rules
**The Uma Voz Rule.** O Vermelho Marque é a única cor de ação. Se dois elementos vermelhos competem na mesma área, um deles está errado.

**The Dois Climas Rule.** Toda cor existe em par, manhã e noite. Nunca use um hex fixo de tema claro em uma tela: use o token, que já troca no escuro.

## Typography

**Display Font:** Bricolage Grotesque (com Instrument Sans e system-ui como reserva)
**Body Font:** Instrument Sans (com ui-sans-serif e system-ui como reserva)

**Character:** Bricolage Grotesque dá aos títulos um peso arredondado e caloroso, de letreiro de bairro; Instrument Sans mantém o resto limpo e legível como uma ficha de balcão. Títulos sempre com espaçamento levemente fechado (-0.02em).

### Hierarchy
- **Display** (800, 6rem no desktop e 3.75rem no celular, altura de linha 0.95): só a marca no hero da landing ("Marque aqui!").
- **Headline** (800, 1.875rem): títulos de seção da landing e de páginas de destaque.
- **Title** (800, 1.5rem): título de cada página dos portais.
- **Card Title** (700, 1rem, altura de linha justa): títulos de cartões e de diálogos (1.125rem).
- **Body** (400, 0.875rem a 1rem): texto corrido, células de tabela, descrições.
- **Label** (500, 0.875rem): rótulos de campos e itens de navegação; selos usam 600 a 0.75rem.

A base do documento é 17px (106.25%), então todos os tamanhos em rem ficam cerca de 6% maiores que o padrão do navegador.

### Named Rules
**The Números Alinhados Rule.** Horários, preços e contagens usam algarismos tabulares (`tnum`), para que as colunas da agenda e dos relatórios se alinhem.

## Layout

- **Portais:** barra lateral fixa de 17rem no desktop (a partir de 1024px) com logotipo, perfil, estabelecimento ativo, navegação e conta; no celular ela vira gaveta sobre um véu Azul Noite.
- **Landing:** conteúdo limitado a 72rem (`max-w-6xl`), hero em duas colunas (texto e cadeira de barbeiro) que empilha no celular.
- **Telas de acesso** (login, cadastro): um cartão centralizado de até 28rem com o logotipo acima e links secundários abaixo.
- **Ritmo:** espaçamentos de 8, 12 e 16px dominam (gap entre elementos); cartões respiram 20px por dentro.

## Elevation & Depth

Sistema híbrido: superfícies separadas por tom (Azul Manhã atrás, Papel na frente) e reforçadas por sombras suaves tingidas de azul (no escuro, tingidas de preto). A sombra nunca é cinza neutra.

### Shadow Vocabulary
- **Cartão** (`0 1px 2px rgb(15 40 90 / 0.06), 0 4px 16px -6px rgb(15 40 90 / 0.12)`): cartões, botão contornado e item ativo da navegação.
- **Elevação** (`0 2px 4px rgb(15 40 90 / 0.06), 0 16px 32px -12px rgb(15 40 90 / 0.22)`): cartões interativos sob o cursor.
- **Flutuação** (`0 4px 8px rgb(15 40 90 / 0.08), 0 28px 56px -16px rgb(15 40 90 / 0.35)`): diálogos.
- **Brilho do botão principal** (`inset 0 1px 0 rgb(255 255 255 / 0.22), 0 6px 14px -6px` em Vermelho Marque a 70%): só no botão principal.

### Named Rules
**The Sobe ao Toque Rule.** Cartões clicáveis sobem 2px, ganham a sombra de Elevação e uma borda puxada para o vermelho sob o cursor. Isso só acontece com mouse preciso (`hover: hover`); no toque nada salta.

## Shapes

Cantos generosos e consistentes: 16px em cartões e diálogos, 10px em botões, campos e itens de navegação, 6px em detalhes pequenos, e pílula completa nos selos. Bordas de 1px finas e azuladas. A única geometria decorativa é a listra de barbeiro: diagonais a 135° alternando Vermelho Marque, branco e Azul Foco em passos de 8px.

## Components

### Buttons
Táteis e confiantes: cedem levemente ao clique (escala 0.97) e respondem em 150ms.
- **Shape:** cantos suaves (10px), altura de 40px (32px no pequeno, 48px no grande).
- **Primary:** Vermelho Marque com texto branco, peso 600, com o brilho interno e a sombra vermelha difusa; no hover fica 10% mais claro.
- **Secondary:** Azul Secundário com texto azul-escuro; no hover vai para Azul Destaque.
- **Outline:** Papel com contorno de campo e sombra de Cartão; ação alternativa ao lado do principal ("Já tenho conta").
- **Ghost / Link:** sem fundo; link em Vermelho Marque com sublinhado no hover.
- **Destructive:** Vermelho Alerta com texto branco.
- **Loading:** um ícone giratório entra antes do rótulo e o botão fica desabilitado.

### Chips (Badges)
- **Style:** pílula com fundo do próprio tom a 15% e texto no tom cheio, peso 600, 0.75rem.
- **State:** o status do agendamento define o tom: confirmado = azul, concluído = verde, cancelado = vermelho, falta = âmbar.

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Papel (claro) ou Cartão Noite (escuro).
- **Shadow Strategy:** sombra de Cartão em repouso; Elevação no hover quando clicável.
- **Border:** 1px na cor de Borda.
- **Internal Padding:** 20px.

### Inputs / Fields
- **Style:** fundo Papel, contorno de 1px em Borda de Campo, 10px de canto, 40px de altura, placeholder em Texto Apagado.
- **Focus:** a borda vira Azul Foco e o anel de foco de 2px aparece com 2px de afastamento.
- **Error / Disabled:** inválido ganha borda Vermelho Alerta (`aria-invalid`); desabilitado fica a 50% de opacidade.

### Navigation
- **Style:** itens de 0.875rem com peso 500 e ícone de 16px, cantos de 10px.
- **Active:** uma pílula Vermelho Marque desliza entre os itens (mola curta de 350ms) com texto branco.
- **Hover:** fundo Azul Destaque.
- **Mobile:** gaveta lateral sobre véu Azul Noite a 50%, fechada ao trocar de página.

### Listra de Barbeiro (assinatura)
Faixa fina com diagonais Vermelho Marque, branco e Azul Foco, no topo do cabeçalho da landing e em detalhes de marca. Pode deslizar continuamente (1.2s) e para com redução de movimento.

### Diálogos
Cartão de 16px de canto, sombra de Flutuação, até 28rem de largura, sobre véu Azul Noite a 60% com desfoque. Entram com leve zoom (220ms) e saem mais rápido (140ms). Diálogos obrigatórios não fecham por clique fora nem por Esc.

## Do's and Don'ts

### Do:
- **Do** usar os tokens de cor (`--primary`, `--card`, `--border`…) para que cada tela funcione nos dois temas.
- **Do** manter um único botão Vermelho Marque por área de decisão; alternativas vão em Outline ou Ghost.
- **Do** usar o tom do selo de status conforme o mapa: confirmado azul, concluído verde, cancelado vermelho, falta âmbar.
- **Do** usar algarismos tabulares em horários, preços e contagens.
- **Do** manter movimentos entre 150 e 320ms com a curva `cubic-bezier(0.23, 1, 0.32, 1)` e desligá-los com `prefers-reduced-motion`.

### Don't:
- **Don't** usar a listra de barbeiro como fundo de área de leitura; ela só aparece em faixas finas.
- **Don't** usar Vermelho Marque para erro ou ação destrutiva; isso é papel do Vermelho Alerta.
- **Don't** usar sombra cinza neutra; as sombras são tingidas de azul (ou preto no escuro).
- **Don't** aplicar efeito de hover que levanta elementos em telas de toque.
