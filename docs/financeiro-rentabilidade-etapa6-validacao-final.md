# Validação Final — Etapa 6: Rentabilidade da Madeira

**Data da auditoria:** 27 de agosto de 2026  
**Escopo:** leitura de código, consultas de auditoria, regressões automatizadas e conferência da interface.  
**Alterações em dados operacionais ou financeiros:** nenhuma.

## Conclusão executiva

A Etapa 6 está **metodologicamente validada**. A rentabilidade lê a cadeia operacional existente como fonte única: romaneio de carga de toras, plaqueta, consumo em produção própria, produção de peças, lote, movimentação de estoque e venda. Não foram criados lançamentos financeiros, rateios persistidos, tabelas paralelas, migrações ou alterações em romaneios, estoque, vendas, títulos, baixas ou conciliação.

A matéria-prima segue uma ordem explícita e auditável: **custo real rastreável da tora, incluindo o frete do seu romaneio de carga; referência ponderada da mesma essência, incluindo valor de tora e frete de entrada; ou custo indisponível**. A referência nunca cruza essências e nunca usa média global. O frete comercial de madeira serrada não integra a matéria-prima: ele é deduzido uma única vez da receita de venda, ao lado de desconto e comissão.

Os custos industrial e comercial/administrativo permanecem tecnicamente prontos para leitura por Centro de Custo e competência, mas sua completude depende da classificação financeira de origem. Na competência auditada há títulos sem Centro de Custo; portanto, indicadores zerados devem ser interpretados como **ausência de lançamentos elegíveis classificados**, e não como ausência comprovada de gasto operacional.

| Pilar auditado | Resultado | Evidência e tratamento |
|---|---|---|
| Fonte única e integridade | Conforme | A rentabilidade apenas consulta os documentos já existentes; não cria saldo, título, estoque, romaneio, baixa, rateio persistido ou fluxo paralelo. |
| Produção própria | Conforme | A base considera somente romaneios de produção confirmados. Serragem de terceiros permanece excluída da produção e do custo próprios. |
| Volume produzido | Conforme | A auditoria identificou 16 romaneios próprios confirmados, com 119,779387 m³ de peças. Os 15,480000 m³ de aproveitamento permanecem fora da base quando não marcados para inclusão no rendimento. |
| Custo real de matéria-prima | Conforme | Cada tora consumida prioriza o valor real por m³ da tora mais o frete de entrada do seu romaneio de carga, quando rastreáveis. |
| Referência por essência | Conforme | A exceção é uma média ponderada pelo volume de valor da tora **mais frete de entrada**, apenas para a mesma essência e dentro da janela configurada. |
| Custo indisponível | Conforme | Sem custo real ou referência comparável da mesma essência, a lacuna é mantida visível; não há média entre espécies nem valor inventado. |
| Diesel | Conforme | Apenas abastecimentos de diesel podem compor custo operacional. Títulos de nota de diesel permanecem excluídos para evitar duplicidade. |
| Centros de custo | Pendente de dados | Há 25 títulos ativos sem Centro de Custo, somando R$ 477.983,21. Sem centro e competência adequados, eles não são apropriados por suposição. |
| Títulos de romaneio | Conforme | Títulos de origem `romaneio_carga` são excluídos da rentabilidade, pois a matéria-prima já é lida pela cadeia física. |
| Vendas entregues | Conforme | A leitura usa saída líquida — `saida_entrega − estorno_entrega` —, suporta diversos lotes por item e mantém cobertura real, por referência ou indisponível. |

## Regra final de matéria-prima

Para cada tora consumida em produção própria, o sistema busca inicialmente a origem física e aplica:

```text
custo real da tora = volume consumido × (valor real da tora por m³ + frete do romaneio de carga por m³)
```

Quando não for possível recuperar uma origem com valor real, a exceção autorizada é a referência ponderada pelo volume das toras de **mesma essência** encontradas nos romaneios de carga elegíveis:

```text
referência por essência = média ponderada por volume de
(valor da tora por m³ + frete de entrada por m³)
```

O valor da tora e o frete permanecem identificáveis separadamente nos detalhes. A soma é aplicada apenas para expressar o custo completo da matéria-prima. O frete comercial da madeira serrada é economicamente distinto e não pode ser transferido para esta base.

## Leitura da competência auditada

Foram identificados 203,772182 m³ de toras consumidas: 186,943764 m³ com valor de tora rastreável e 16,828418 m³ submetidos à referência da mesma essência. A base de referência é sempre comunicada como estimativa; ela não transforma o registro em custo real nem elimina a necessidade de melhoria cadastral futura.

As 11 serragens de terceiros, com 110,991017 m³ produzidos, não compõem o volume de produção própria. Esta separação preserva a análise econômica da madeira da FK Madeiras sem imputar ao negócio toras pertencentes a clientes.

## Industrial, comercial e administração

Custos industriais e comercial/administrativos são lidos exclusivamente de títulos não cancelados que possuam Centro de Custo de tipo apropriado e competência no mês analisado. Quando não houver lançamento elegível, a tela apresenta R$ 0,00 e esclarece que não há classificação adequada na competência selecionada. O sistema não cria centro, não reclassifica título histórico e não aplica rateio para preencher essa ausência.

> A metodologia de cálculo está validada; a completude dos indicadores operacionais por competência depende do preenchimento de Centro de Custo nos títulos financeiros de origem.

## Tratamento de vendas

A receita líquida da madeira considera apenas a composição comercial efetivamente registrada:

```text
receita líquida = subtotal − desconto − frete comercial − comissão
```

Frete comercial, comissão, descontos, impostos e taxas não são adicionados novamente ao custo de matéria-prima. O custo da venda deriva das saídas físicas de lote e do custo da produção de origem, preservando múltiplos lotes por item, estornos e lacunas históricas sinalizadas.

## Limites deliberados da Etapa 6

Esta etapa não forma preço, não sugere markup, não cria preço de venda, não altera estoque, não altera contas a pagar ou receber e não reprocessa históricos. A evolução da qualidade do indicador deve ocorrer por cadastramento correto de valor e frete em romaneios de carga, vínculo físico de produção/lote/saída e classificação dos títulos no Centro de Custo apropriado.

## Referências

[1]: ../server/rentabilidade-financeira.logic.ts "Custeio mensal de matéria-prima e indicadores por Centro de Custo"
[2]: ../server/rentabilidade-vendas.logic.ts "Custeio por lote, saída e venda"
[3]: ../server/repositories/rentabilidadeFinanceira.ts "Leituras de romaneio, plaqueta, consumo e títulos"
[4]: ../../upload/pasted_content_31.txt "Escopo confirmado da Etapa 6"
