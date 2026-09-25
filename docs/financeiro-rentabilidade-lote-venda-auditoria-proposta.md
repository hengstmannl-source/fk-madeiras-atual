# Rentabilidade da Madeira — essência, lote e venda

**Status:** leitura implementada; critério de matéria-prima e frete de entrada confirmado.
**Escopo:** documentar a cadeia de origem física e o tratamento de receita, custo e cobertura na análise por venda, sem alterar os módulos operacionais.

> Para uma lacuna histórica de origem, a única referência permitida é a média ponderada por volume de **valor da tora mais frete de entrada** nos romaneios de carga da mesma essência. Custo real rastreável continua prioritário.[1] [2]

## Cadeia física e cobertura de lote

A rastreabilidade disponível relaciona produção própria, item produzido, lote de serrado, movimentação de saída, item de venda e venda entregue. Um item de venda pode ter várias saídas e, consequentemente, diversos lotes. A apropriação soma cada origem física encontrada, sem escolher um lote arbitrário e sem usar média global da espécie.

```text
produção própria → item produzido → lote próprio → saída líquida de estoque → item de venda → venda entregue
```

| Elemento | Regra de leitura | Salvaguarda |
|---|---|---|
| Lote | Identifica produção própria, terceiro ou aproveitamento. | Lote de terceiro não recebe custo de matéria-prima própria. |
| Saída | Considera `saida_entrega − estorno_entrega`. | Estorno impede dupla apropriação de volume e custo. |
| Item de venda | Pode receber várias saídas e lotes. | Todos os lotes vinculados são detalhados. |
| Volume | Usa volume do movimento; quando historicamente ausente em peça, reconstitui por quantidade líquida e volume unitário do lote. | Sem derivação segura, a cobertura fica indisponível. |
| Produção de origem | Recupera a matéria-prima da produção própria que originou o lote. | Não atribui custo de produção da FK a serragem de terceiros. |

## Custo da madeira por essência, lote e venda

Para uma produção própria, o custo da matéria-prima é calculado pela tora efetivamente consumida. A ordem de custeio é a mesma em todos os níveis: custo real da tora com frete de carga, depois referência da mesma essência com frete de entrada, e por fim indisponível.

| Nível | Base de cálculo | Interpretação |
|---|---|---|
| Essência | Consumo e produção própria da mesma espécie. | Resume volume, custo de madeira, cobertura e custo por m³. |
| Produção | Custo de tora consumida dividido pelo volume próprio elegível. | Mantém real, referência e indisponível visíveis. |
| Lote | Volume líquido vendido multiplicado pelo custo unitário da produção de origem. | Usa o lote físico, não uma média comercial. |
| Venda | Soma do custo das saídas de todos os lotes vinculados. | Suporta várias essências e lotes no mesmo pedido. |

```text
custo unitário do lote = custo de matéria-prima da produção de origem ÷ volume próprio elegível
custo da saída do lote = volume líquido de saída × custo unitário do lote
custo de madeira da venda = Σ custo das saídas de lote
```

A referência de exceção é calculada apenas com romaneios de carga elegíveis da mesma essência e na janela de referência configurada:

```text
referência = média ponderada por volume de
(valor da tora por m³ + frete de entrada por m³)
```

Esta composição não estima ou inclui frete comercial. A referência é sinalizada como tal e nunca substitui uma origem física com custo real.

## Receita líquida e frete comercial

O frete de madeira serrada é uma dedução comercial, distinta do frete de entrada das toras. Para cada venda entregue, a receita disponível para comparar contra os custos é:

```text
receita líquida da madeira = subtotal − desconto − frete comercial − comissão
```

| Componente | Tratamento | Evita |
|---|---|---|
| Valor da tora | Custo de matéria-prima da cadeia física ou referência da mesma essência. | Omissão do valor de aquisição. |
| Frete de entrada da tora | Integra custo real e referência por essência. | Subavaliar matéria-prima sem frete de carga. |
| Frete comercial de serrado | Reduz a receita líquida uma única vez. | Duplicá-lo como custo de tora. |
| Comissão | Reduz a receita líquida uma única vez. | Duplicar comissão como custo. |
| Impostos e taxas cobrados do cliente | Ficam fora da receita de madeira; eventual despesa depende do título financeiro classificado. | Inferir custo sem evidência financeira. |

Os custos industrial e comercial/administrativo são exibidos separadamente, por Centro de Custo e competência. A ausência de título classificado não autoriza rateio por venda, essência ou lote.

## Critérios de apresentação

A tela **Financeiro → Rentabilidade da madeira** apresenta a produção e os custos por essência, a cobertura de matéria-prima e a margem por venda. O detalhe de venda mantém preço bruto, desconto, frete comercial, comissão, receita líquida, custo de madeira, custos mensais aplicáveis e condição de rastreabilidade de cada lote.

Quando a origem não é física, mas há referência válida, a interface identifica o valor como referência de tora e frete de entrada. Quando não há volume mensurável ou referência da mesma essência, a margem é parcial ou indisponível. O sistema não oculta a estimativa e não transfere custos entre espécies.

## Limites da implementação

Esta leitura não cria lançamento, tabela auxiliar, custo materializado, rateio persistido ou alteração em estoque, vendas, romaneios, títulos ou baixas. Ela também não forma preço, markup ou preço sugerido. A qualidade futura depende dos documentos de origem e da classificação de Centros de Custo na competência correta.

## Referências

[1]: ../server/rentabilidade-financeira.logic.ts "Custeio de produção própria por essência"
[2]: ../server/rentabilidade-vendas.logic.ts "Consolidação de custo por lote e venda"
[3]: ../server/repositories/rentabilidadeFinanceira.ts "Consulta da cadeia física e referências de romaneio de carga"
[4]: ../../upload/pasted_content_31.txt "Regra final confirmada para o frete"
