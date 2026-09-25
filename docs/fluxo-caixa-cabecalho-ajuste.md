# Ajuste visual — Cabeçalho do Fluxo de Caixa

## Referência analisada

A captura panorâmica enviada pelo usuário, com 1282 × 227 px, evidencia que o título e a descrição estão ancorados à esquerda, enquanto o conjunto de filtros começa muito distante, sem uma coluna ou divisor visual que conecte as duas áreas. Os atalhos de período aparecem em uma coluna vertical isolada no extremo direito, criando uma leitura quebrada e alturas desalinhadas em relação aos campos de conta e datas.

## Direção do ajuste

O cabeçalho deve adotar uma grade única e regular: contexto à esquerda, filtros em sequência no centro e os atalhos organizados no mesmo bloco de ações. Em telas menores, esses grupos devem empilhar mantendo alinhamentos, tamanhos de controles e espaçamentos consistentes.

## Rota de validação

A visualização do ajuste deve ser feita em `/financeiro?aba=fluxo`. A rota raiz apresenta o Dashboard e não contém o cabeçalho em revisão.

## Verificação desktop

Na rota financeira em desktop, o painel agora inicia com uma divisão consistente entre o contexto e o conjunto de filtros. A área de filtro passou a ter limites laterais e uma sequência regular entre conta, período e atalhos, eliminando a coluna isolada de botões identificada na referência. A revisão móvel ainda será realizada antes da publicação.

Na revisão completa em desktop, a grade mantém o cabeçalho compacto e alinhado, sem deslocar os demais cartões e relatórios do Fluxo de Caixa. Em mobile, a tela permanece sem estouro horizontal; a composição do cabeçalho será confirmada no fluxo completo antes da publicação.

## Verificação móvel

Na visualização móvel completa, o contexto, o seletor de conta, as datas e os atalhos passam a ocupar blocos empilhados e regulares. Os campos preservam largura legível, os atalhos ficam agrupados após o divisor e não há rolagem horizontal no painel.
