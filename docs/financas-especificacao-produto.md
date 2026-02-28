# Finanças - Especificação de Produto (versão alinhada)

## Objetivo
Refazer o módulo de Finanças mantendo o mesmo padrão visual do Calendário: dark elegante, cards com bordas suaves, tipografia clara e navegação simples.

Este documento registra exatamente o que foi decidido para não perder contexto nas próximas implementações.

## Escopo atual (o que deve existir)
- Dashboard financeiro completo
- Transações com histórico completo (desde a primeira transação)
- Contas
- Cartões
- Dívidas
- Metas (com UX mais clara)
- Relatórios com gráficos
- Configurações (categorias/tags)

## Escopo removido por decisão
- Orçamentos: removido
- Recorrências: removido

Observação: páginas legadas podem continuar no código por compatibilidade temporária, mas não devem aparecer na navegação principal.

## Requisitos funcionais principais

### 1) Cartões
- Usuário consegue cadastrar cartões.
- Usuário informa quanto precisa pagar em cada cartão.
- Dashboard mostra:
  - total geral a pagar em cartões
  - detalhamento por cartão (valor por cada um)

### 2) Dashboard
- Mostrar entradas totais
- Mostrar saídas totais
- Mostrar saldo total
- Mostrar resumo por origem/local (contas/cartões)
- Atualização automática após criar/editar/excluir dados

### 3) Transações
- Histórico completo e contínuo (ordem decrescente por data/hora de criação/lançamento).
- Cada transação pode ter categoria (entrada e saída).
- Fluxo em “mini páginas” internas para evitar confusão.

### 4) Metas
- Manter módulo de metas.
- Tornar a experiência mais didática: explicar objetivo, valor alvo, valor atual e progresso.

### 5) Relatórios
- Relatório visual “bonito” e claro.
- Gráfico de pizza para maiores gastos por categoria.
- Outras visões de apoio (entradas x saídas, tendência).
- Seção de dicas de melhoria financeira.

## Regras de dicas (fase atual - sem IA)
As dicas serão geradas por regras fixas, por exemplo:
- Se gastos em uma categoria > X% do total: sugerir revisão dessa categoria.
- Se saldo mensal líquido estiver negativo: alertar redução de despesas.
- Se cartão concentrar valor alto: sugerir distribuição ou antecipação.
- Se houve queda de entradas por período: sugerir ajuste de orçamento pessoal.

Essas dicas são determinísticas e transparentes (fáceis de auditar).

## Evolução futura (fase IA)
No futuro, substituir/combinar regras fixas com IA para:
- Dicas personalizadas por comportamento
- Previsão de fluxo de caixa
- Alertas proativos de risco (ex.: tendência de saldo negativo)
- Sugestões automáticas de otimização por categoria e cartão

## Diretrizes de UX/UI
- Seguir identidade visual do Calendário.
- Navegação principal limpa (sem abas desnecessárias).
- Informação priorizada: primeiro KPIs, depois detalhes.
- Evitar telas confusas: separar ações em blocos claros e consistentes.
- Responsivo desktop/mobile sem quebrar leitura.

## Estado de alinhamento
- Este documento é a referência oficial para as próximas sprints de Finanças.
- Qualquer mudança de escopo deve atualizar este arquivo antes da implementação.
