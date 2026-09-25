# FINANCEIRO V2 — Etapa 6F: proposta de integração rastreável da matéria-prima

**Status:** diagnóstico concluído e proposta aguardando aprovação.  
**Limite desta entrega:** nenhuma tabela, dado operacional, título financeiro, custo histórico, romaneio, plaqueta, lote, estoque ou interface foi alterado. A etapa proposta será estritamente uma leitura e um cálculo a partir das relações já existentes.

> A fonte econômica da matéria-prima será a cadeia física de consumo das toras. O título financeiro vinculado ao romaneio de entrada continua sendo o documento de obrigação a pagar, mas não será somado como um segundo custo na rentabilidade.[1] [2]

## 1. Conclusão da auditoria da cadeia física

A cadeia solicitada já existe e é suficiente para suportar a leitura sem criar relações paralelas. O romaneio de entrada registra o valor da carga e o frete; suas plaquetas preservam origem, volume e valor por metro cúbico. Quando a produção própria é confirmada, cada plaqueta consumida é vinculada a `itensRomaneioToras`, a produção gera `itensRomaneioProducao` e lotes próprios, e as movimentações mantêm a trilha física de entrada, consumo e estoque.[1] [3]

| Etapa econômica | Relação já existente que será reutilizada | Dado que sustenta o cálculo |
|---|---|---|
| Entrada de tora | `romaneiosCargaToras` → `plaquetas.romaneioCargaId` | Fornecedor, data, volume, valor da carga e frete de entrada. |
| Custo individual da tora | `plaquetas.valorMetroCubico` + romaneio de origem | Valor real por m³ e respectivo romaneio de entrada. |
| Consumo na produção | `itensRomaneioToras.plaquetaId` → `romaneiosProducao` | Tora, volume consumido e romaneio de produção que a usou. |
| Madeira serrada produzida | `itensRomaneioProducao` → `lotesPecasSerradas.itemRomaneioId` | Volume de peças próprias produzidas e rastreabilidade de estoque. |
| Aproveitamento | `aproveitamentosRomaneioProducao` e lote de tipo `aproveitamento` | Volume adicional, incluído somente conforme a opção já registrada no romaneio. |
| Saída de estoque e venda | `movimentacoesEstoqueSerrado` → lote/item da venda | Permanecerá como trilha de estoque e venda; não é necessário para calcular o custo da matéria-prima na produção. |

O vínculo financeiro também já é explícito: cada romaneio de entrada gera ou atualiza, de forma idempotente, um título `origem = romaneio_carga`, com `romaneioCargaId`, valor igual ao `valorTotal` da carga e competência igual à data de entrada.[2] A auditoria encontrou **16 romaneios de entrada**, todos com um título financeiro vinculado; os valores totais coincidem em **R$ 405.841,96**. Essa coincidência confirma que as duas estruturas representam o mesmo fato econômico em perspectivas distintas e não devem ser agregadas simultaneamente.[4]

## 2. Cobertura atual e qualidade dos dados

A auditoria consultou somente registros confirmados de produção própria. Foram identificadas **16 produções**, com **213 toras consumidas** e **203,772182 m³** de volume de tora. Desse total, **186,943764 m³** possuem origem de entrada, valor da tora e frete rastreáveis — cobertura de **91,74%**. O volume sem custo conhecido é de **16,828418 m³**, correspondente a **16 toras sem romaneio de entrada**; não foram identificadas, nesse conjunto, lacunas adicionais de valor por m³ ou de frete.[4] [5]

| Indicador auditado | Resultado observado | Tratamento proposto |
|---|---:|---|
| Custo de toras rastreável | R$ 136.352,72 | Somar apenas nas produções que consumiram as toras correspondentes. |
| Frete de entrada rastreável | R$ 5.790,21 | Somar pela mesma tora consumida e pelo frete por m³ do romaneio de origem. |
| Custo de matéria-prima conhecido | R$ 142.142,93 | Exibir como custo conhecido; não completar a diferença por média. |
| Volume de tora com origem completa | 186,943764 m³ | Usar para o percentual de cobertura. |
| Volume de tora sem origem de custo | 16,828418 m³ | Exibir alerta de cobertura parcial e trilha dos registros sem origem. |
| Peças próprias produzidas | 119,779387 m³ | Usar como denominador elegível atual, respeitando o parâmetro de aproveitamento. |
| Aproveitamento registrado | 15,480000 m³ | Não entra hoje porque os 16 romaneios confirmados estão com a opção de inclusão desmarcada. |

Os itens de produção e os lotes próprios estão íntegros para essa finalidade: foram encontrados **954 itens de produção**, **954 lotes próprios de peças**, volumes idênticos de **119,779387 m³** e nenhum item sem lote nem lote de peça sem item de produção. Por isso, a proposta usa `itensRomaneioProducao` como base de cálculo — que representa diretamente a produção confirmada — e mantém os lotes como trilha de estoque e detalhamento. O aproveitamento só se soma ao denominador quando `incluirAproveitamentoNoRendimento` estiver marcado no romaneio; não haverá divisão adicional por percentual de rendimento.[5] [6]

Produção própria e serragem de terceiros também estão separadas: existem **967 lotes próprios de produção**, **388 lotes de terceiros** e **11 serragens de terceiros**. Nenhuma das 16 produções próprias confirmadas está sem consumo de tora ou sem lote próprio. A camada proposta filtrará explicitamente `propriedade = proprio` e não usará serragens, peças ou volumes de terceiros para apropriar custo de tora própria.[3] [5]

## 3. Decisão de fonte e regras de não duplicidade

A leitura financeira atual classifica lançamentos por Centro de Custo e já trata abastecimento de diesel como custo físico, excluindo títulos derivados de nota de diesel.[7] A Etapa 6F deve aplicar a mesma disciplina à matéria-prima: o título `romaneio_carga` não será mais componente financeiro da rentabilidade, pois a fonte econômica passará a ser o consumo físico de suas plaquetas.

| Camada da rentabilidade | Fonte exclusiva após a Etapa 6F | Exclusões obrigatórias |
|---|---|---|
| Matéria-prima | Romaneio de entrada → plaqueta → consumo em produção própria. | Títulos `origem = romaneio_carga`, custos estimados, médias históricas e lançamentos manuais duplicados. |
| Diesel | Abastecimentos de diesel classificados, pela data do consumo. | Nota de diesel e título `origem = nota_diesel`. |
| Industrial | Títulos de despesa classificados em Centro de Custo `industrial`. | Títulos de romaneio de carga, nota de diesel, cancelados e não apropriáveis. |
| Comercial/administrativo | Títulos de despesa classificados em Centro de Custo `comercial_administrativo`. | Títulos de romaneio de carga, nota de diesel, cancelados e não apropriáveis. |

Os títulos de romaneio de carga não serão apagados, baixados, editados ou desconciliados. Eles continuarão sendo usados em Contas a Pagar e no Fluxo de Caixa. A mudança é exclusivamente no conjunto de componentes usado pela **Rentabilidade da Madeira**.

## 4. Cálculo proposto

O custo de cada tora consumida será calculado apenas quando houver origem completa:

```text
custo da tora consumida = volume consumido × valor da tora por m³
frete de entrada apropriado = volume consumido × frete de entrada por m³
custo de matéria-prima da produção = soma(custo da tora consumida + frete apropriado)
```

Para cada romaneio de produção, o denominador será o volume de itens de produção próprios confirmados. Quando a opção de incluir aproveitamento estiver marcada, o volume de aproveitamento daquele mesmo romaneio é somado uma única vez. Logo:

```text
volume elegível = volume de peças próprias + aproveitamento elegível
custo conhecido de matéria-prima por m³ = custo rastreável da matéria-prima ÷ volume elegível
```

Quando a cobertura de tora for de 100%, o indicador poderá ser exibido como **custo real de matéria-prima por m³**. Quando houver qualquer volume sem origem conhecida, a interface exibirá **custo conhecido de matéria-prima por m³ — cobertura parcial**, com o percentual de cobertura ao lado. Não será apresentado um custo total estimado e nem um custo completo definitivo para um período parcial.

Na competência mensal, a matéria-prima será reconhecida pela `dataProducao` do romaneio confirmado, pois é nessa data que a tora foi fisicamente consumida e transformada. A data do romaneio de entrada e a competência/data de pagamento do título não deslocarão esse custo de consumo. Custos industriais e comerciais/administrativos conservarão sua competência financeira já definida na Etapa 6E.[7]

## 5. Interfaces propostas

A página existente **Financeiro → Rentabilidade da madeira** será evoluída sem abrir uma tela financeira paralela. A consulta continuará por competência mensal e ganhará uma visão de detalhe por produção.

| Área | Conteúdo proposto | Comportamento de qualidade |
|---|---|---|
| Resumo da competência | Cartões de Matéria-prima, Industrial, Comercial/Administrativo e Custo gerencial completo por m³. | Se a matéria-prima for parcial, o cartão e o custo completo serão identificados como parciais. |
| Matéria-prima | Custo das toras, frete de entrada, total conhecido, volume de tora consumida, volume com/sem custo, cobertura e custo conhecido por m³. | Sem médias, sem preenchimento automático e sem ocultar lacunas. |
| Custos financeiro-industriais e comerciais | Manter os agrupamentos por Centro de Custo e categoria atualmente existentes. | Excluir, no código de leitura, `romaneio_carga` além das exclusões já previstas. |
| Produções da competência | Uma linha por romaneio: data, número, volume de tora, volume produzido, custo de tora, frete, total, cobertura e custo por m³. | Produção parcial mostra alerta e atalho para o detalhe; produção sem volume elegível não calcula indicador por m³. |
| Detalhe de matéria-prima | Expansão/modal com romaneio de entrada, fornecedor, plaqueta, essência, volume consumido, valor/m³, frete/m³, custo apropriado e romaneio de produção. | Linhas sem origem são listadas com motivo; não recebem valor estimado. |

O resultado mensal só será chamado de **custo completo por m³** quando a matéria-prima estiver coberta integralmente. Caso contrário, a tela somará os componentes conhecidos, mas exibirá o rótulo **custo gerencial conhecido — cobertura parcial**, evitando uma conclusão que a base não suporta.

## 6. Implementação técnica proposta após aprovação

Não há necessidade identificada de migration ou de nova cadeia de tabelas. A implementação deve alterar apenas o código de leitura, os contratos tipados, testes e a tela existente.

| Ordem | Mudança planejada | Garantia |
|---:|---|---|
| 1 | Extrair ou evoluir uma lógica pura de matéria-prima por romaneio e competência, usando as relações físicas existentes. | Cálculo testável, determinístico e sem escrita. |
| 2 | Criar consultas de leitura no repositório de rentabilidade para produções próprias confirmadas, consumos, plaquetas e romaneios de entrada. | Escopo pela empresa configurada; sem IDs fixos; sem joins que multipliquem custos. |
| 3 | Excluir `origem = romaneio_carga` da coleta de títulos que forma industrial/comercial e adicionar a camada física de matéria-prima. | Cada evento econômico compõe a rentabilidade uma única vez. |
| 4 | Estender o contrato tRPC atual com resumo de matéria-prima, cobertura, lista de produções e detalhamento rastreável. | A página continua sendo uma visão de leitura por competência. |
| 5 | Atualizar a tela de rentabilidade com cartões, aviso de cobertura, tabela por produção e detalhe expansível. | Estados de carregamento, vazio, parcial e 100% coberto em desktop e móvel. |
| 6 | Cobrir regras com testes unitários e de integração; validar TypeScript, build, auditoria de banco em leitura e revisão visual. | Nenhuma reclassificação, migração de dados ou novo lançamento financeiro. |

Os testes deverão cobrir, no mínimo, soma de custo e frete por tora, consumo parcial, múltiplas origens em uma produção, produção sem custo de origem, exclusão de terceiros, aproveitamento incluído/não incluído, exclusão do título `romaneio_carga`, competência pela produção e ausência de duplicidade com diesel e títulos financeiros.

## 7. Decisão solicitada

Aprovar esta proposta autoriza somente a implementação descrita na seção 6. Ela não autoriza reclassificação de históricos, atualização de valores de romaneio, criação de médias de preço, distribuição de custos sem origem, reativação de rateios gerenciais ou mudanças nas regras de diesel, comissão, frete comercial, impostos ou folha.

## Referências

[1]: ../server/repositories/estoque.ts "Romaneio de entrada, plaquetas e título financeiro derivado"
[2]: ../drizzle/schema.ts "Schema: romaneios de carga, plaquetas e títulos financeiros"
[3]: ../server/repositories/producao.ts "Confirmação de produção própria e serragem de terceiros"
[4]: ../docs/financeiro-etapa-6f-auditoria-leitura.sql "Auditoria de leitura: cobertura física e títulos de romaneio"
[5]: ../docs/financeiro-etapa-6f-auditoria-leitura.sql "Auditoria de leitura: produção própria, lotes e aproveitamentos"
[6]: ../server/custos-gerenciais.logic.ts "Regras existentes de volume elegível e cobertura"
[7]: ../server/repositories/rentabilidadeFinanceira.ts "Leitura financeira atual por competência e Centro de Custo"
