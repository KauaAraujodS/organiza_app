# Padrao Visual Unico (App)

## Objetivo
Centralizar o visual em CSS fora da logica (`tokens`, `base`, `components`, `responsive` + `*.module.css` por pagina), mantendo JSX focado em estado e comportamento.

## Fundacao
- Tokens globais: `app/styles/tokens.css`
- Base global: `app/styles/base.css`
- Componentes globais: `app/styles/components.css`
- Regras responsivas globais: `app/styles/responsive.css`
- Estilos por tela: `app/**/page.module.css`

## Tipografia
- Titulo principal: `font-size 1.875rem` a `2.5rem`, peso `700`
- Subtitulo: cor `var(--text-muted)`, `margin-top: 4px`
- Texto auxiliar: `0.75rem` a `0.875rem`, cor `var(--text-soft|muted)`

## Cards e containers
- Card padrao: `border-radius: 16px`, `border: 1px solid var(--line-soft)`, `background: var(--surface-2)`
- Painel principal de modulo: mesmo padrao + `padding` maior (16-24px)

## Botoes
- Primario: `background: var(--brand)`, hover `var(--brand-strong)`, texto branco
- Secundario: `background: var(--surface-2)`, borda `var(--line-soft)`, hover com leve ganho de contraste
- Perigo: tons vermelhos, sem usar vermelho puro no fundo global
- Disabled: `opacity: .6` + `cursor: not-allowed`

## Campos (input/select/textarea)
- Raio: `12px` (formularios) / `16px` (modais)
- Fundo: `var(--surface-1)` ou `var(--surface-2)`
- Borda: `var(--line-soft)`
- Focus: borda mais forte + ring sutil (violeta/brand)

## Tabelas e listas
- Cabeçalho com cor `var(--text-muted)`
- Linhas com separacao via `border-bottom` suave
- Acoes no fim da linha (editar/excluir) com tamanhos consistentes

## Color picker
- Padrao recomendado: paleta de swatches (`button circular`) + campo hex opcional
- Evitar usar somente `<input type="color">` como UI principal
- Swatch selecionado sempre com ring visivel

## Responsividade
- Mobile first: 320px+
- Breakpoints usados: `768px` (tablet), `1280px` (desktop amplo)
- Evitar overflow horizontal:
  - `grid-template-columns` adaptativo
  - `flex-wrap` em barras de acao/tabs
  - containers com `max-width: 100%`
- Navegacao mobile deve abrir via drawer/header (sem sidebar fixa)

## Regras de implementacao
1. Nova tela: criar `page.module.css` local antes de estilizar JSX.
2. Nao colocar classe utilitaria inline no JSX (exceto casos temporarios).
3. Estilo inline (`style={{...}}`) apenas para valor dinamico em runtime (ex: cor vinda do banco).
4. Se um padrao se repetir em 3+ telas, promover para `app/styles/components.css`.

## Modulos ja migrados neste ciclo
- `app/calendar`
- `app/login`
- `app/tasks`
- `app/passwords`
- `app/files`
- shell responsivo (`AppShell`, `Sidebar`, `MobileHeader`, `MobileMenuDrawer`)
