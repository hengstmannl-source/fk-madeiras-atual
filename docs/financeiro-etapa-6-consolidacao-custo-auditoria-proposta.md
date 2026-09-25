# FINANCEIRO V2 — Etapa 6: auditoria e proposta de consolidação do custo completo da madeira

**Status:** auditoria concluída; nenhuma regra, dado, schema, cálculo ou interface foi alterado por este documento.  
**Objetivo:** confirmar a integração das três camadas — matéria-prima, industrial e comercial/administrativo — e propor a apresentação explícita do custo completo por metro cúbico, sem criar uma nova etapa, uma nova fonte financeira ou uma rotina de cadastro paralela.

> Esta é uma análise gerencial baseada nos dados registrados. Valores estimados ou incompletos devem continuar separados dos valores de origem comprovada para posterior revisão contábil, quando aplicável.

## 1. Resultado da auditoria

A matéria-prima já está integrada pela cadeia física correta. Para a competência de agosto de 2026, a consulta utiliza produções próprias confirmadas, toras consumidas, plaquetas e romaneios de entrada; o custo rastreável é calculado pela tora consumida e por seu frete de entrada. Os títulos financeiros de `romaneio_carga` são filtrados antes de compor os componentes financeiros, portanto não são adicionados novamente à matéria-prima.[1] [2]

| Camada | Fonte atual | Resultado da auditoria | Conclusão |
|---|---|---|---|
| Matéria-prima | Tora consumida, plaqueta e romaneio de entrada | R$ 142.142,94 rastreáveis para 186,943764 m³ de tora; frete incluído na mesma origem física. | **Integrada corretamente**, sem duplicar o título do romaneio. |
| Industrial | Títulos a pagar com Centro de Custo `industrial`, mais abastecimento de diesel classificado | Nenhum título ou abastecimento elegível classificado em agosto de 2026. | A regra existe; o total R$ 0,00 reflete a ausência de classificação registrada no período. |
| Comercial/administrativo | Títulos a pagar com Centro de Custo `comercial_administrativo` | Nenhum título elegível classificado em agosto de 2026. | A regra existe; o total R$ 0,00 reflete a ausência de classificação registrada no período. |
| Produção própria | Itens de romaneios de produção confirmados | 16 produções e 119,779387 m³ de peças produzidas. | Base física elegível usada pelas três camadas. |

Foram encontradas 213 toras consumidas, totalizando 203,772182 m³. Destas, 16 toras — 16,828418 m³ das essências Cambará, Cedrinho e Jatobá — não possuem romaneio de entrada. Não foram encontradas produções confirmadas sem tora consumida ou sem item produzido.[3]

O controle de fonte única também foi confirmado. Existem nove títulos de `romaneio_carga`, totalizando R$ 221.338,03 na competência auditada, todos sem Centro de Custo. Mesmo que sejam classificados futuramente, a lógica de rentabilidade os exclui pela origem antes da consolidação. Assim, esses documentos permanecem no Financeiro, mas não podem duplicar o custo apropriado pelo consumo físico das toras.[1] [2]

## 2. Composição matemática atual

A consolidação atual já preserva as três camadas na lógica. Ela calcula o industrial financeiro sem matéria-prima, soma a matéria-prima para formar o custo industrial com matéria-prima e adiciona o comercial/administrativo para chegar ao custo total apropriado.[1]

```text
matéria-prima = tora rastreável + frete de entrada rastreável + estimativa por essência (quando existente)
industrial financeiro = títulos industriais elegíveis + abastecimentos industriais
comercial/administrativo = títulos comerciais/administrativos elegíveis

custo completo = matéria-prima + industrial financeiro + comercial/administrativo
custo completo por m³ = custo completo ÷ volume de produção própria elegível
```

Portanto, não há sobreposição matemática entre matéria-prima e os custos industriais. A necessidade de ajuste é sobretudo de **transparência de apresentação**: a tela mostra hoje o indicador combinado “Industrial + matéria-prima por m³”, mas o escopo solicita explicitamente o valor unitário de cada uma das três camadas e o custo completo como uma quarta linha de composição.[1] [4]

| Métrica de agosto de 2026 | Valor atual | Observação |
|---|---:|---|
| Matéria-prima rastreável | R$ 142.142,94 | Inclui tora e frete de entrada com origem comprovada. |
| Matéria-prima estimada | R$ 12.001,45 | Decorre da regra aprovada anteriormente para as 16 toras sem romaneio. |
| Matéria-prima apresentada | R$ 154.144,39 | Rastreável + estimada, hoje exibidas separadamente. |
| Produção própria elegível | 119,779387 m³ | Base única da competência; não inclui serragem de terceiros. |
| Industrial financeiro | R$ 0,00 | Não há registros elegíveis classificados no período. |
| Comercial/administrativo financeiro | R$ 0,00 | Não há registros elegíveis classificados no período. |

## 3. Ponto que exige decisão: estimativa versus custo parcial

O anexo atual determina que, quando houver toras sem custo de origem, a Rentabilidade não estime automaticamente e mostre **Custo Parcial**, incluindo volumes conhecido e desconhecido. Isso diverge da implementação publicada da Etapa 6F, que foi autorizada anteriormente para usar preço médio ponderado da mesma essência em tora sem romaneio de entrada.[4] [5]

| Alternativa | Como será o custo da matéria-prima | Transparência | Efeito no painel de agosto |
|---|---|---|---|
| **A. Regra estrita do anexo — recomendada** | Somente custo e frete da tora com romaneio de entrada. | Exibe 91,7% de cobertura rastreável e alerta de custo parcial; nenhum valor presumido. | Matéria-prima passa a mostrar R$ 142.142,94 conhecido; 16,828418 m³ ficam sem custo. |
| **B. Manter Etapa 6F** | Usa a estimativa ponderada por essência somente para tora sem romaneio. | Exibe valor rastreável e estimado separados; não chama o total de custo inteiramente rastreável. | Mantém R$ 154.144,39, com R$ 12.001,45 identificado como estimativa. |

A alternativa A é mais aderente ao novo anexo, porque evita qualquer média automática e faz o custo por m³ indicar claramente que é parcial. A alternativa B só deve permanecer se o usuário quiser preservar a decisão anterior de estimar por essência. Nenhuma das alternativas reclassifica ou altera os registros antigos.

## 4. Ajuste visual e contratual proposto

Após a confirmação da alternativa de dados incompletos, a tela pode ser ajustada sem criar uma tela paralela. A consulta por competência continuará a utilizar produção própria confirmada como denominador comum.[1] [4]

| Cartão ou seção | Informação proposta | Fonte |
|---|---|---|
| Matéria-prima | Total, volume de tora relacionado, cobertura e **R$/m³ de matéria-prima**. Quando parcial, rótulo “custo conhecido — cobertura parcial”. | Cadeia física de toras consumidas. |
| Industrial | Total financeiro, base física de produção e **R$/m³ industrial**. | Centro `industrial`, incluindo diesel por abastecimento. |
| Comercial/administrativo | Total financeiro, base física de produção e **R$/m³ comercial/administrativo**. | Centro `comercial_administrativo`. |
| Custo completo | MP R$/m³ + industrial R$/m³ + comercial/administrativo R$/m³, com a soma destacada. | Consolidação das três camadas. |
| Detalhamentos | Expansões de matéria-prima, títulos industriais e títulos comerciais com origem, categoria, centro, valor e base de cálculo. | As fontes já consultadas pela rentabilidade. |

Quando a alternativa A for adotada, o custo completo deverá ser rotulado como **“custo completo conhecido — cobertura parcial”** enquanto houver tora sem origem. Ele continuará útil para acompanhamento, mas não deverá ser apresentado como custo integral da produção. Não serão implementados markup, margem desejada, preço sugerido, alteração de preço de venda ou tabela de preços automática.[4]

## 5. Proposta de implementação após confirmação

| Ordem | Ajuste | Garantia |
|---:|---|---|
| 1 | Aplicar a alternativa A ou B para a matéria-prima sem origem, conforme confirmação. | Nenhuma atualização de plaqueta, romaneio, título ou histórico. |
| 2 | Expor `materiaPrimaPorM3`, `industrialPorM3`, `comercialAdministrativoPorM3` e `custoCompletoPorM3` separadamente no contrato. | Mesma base de volume próprio elegível para as três camadas. |
| 3 | Reorganizar os cartões e detalhamentos da tela em três camadas mais total consolidado. | Sem novo cadastro manual de custo e sem nova fonte econômica. |
| 4 | Cobrir a fórmula, custo parcial, fonte única, ausência de produção e visual responsivo com testes. | Títulos de romaneio e nota de diesel continuam excluídos das suas fontes duplicadas. |

## Referências

[1]: ../server/rentabilidade-financeira.logic.ts "Consolidação de rentabilidade e exclusões de origem"
[2]: ../server/repositories/rentabilidadeFinanceira.ts "Consulta por competência: produção, matéria-prima e componentes financeiros"
[3]: ../docs/financeiro-etapa-6f-auditoria-leitura.sql "Consultas de auditoria de consumo, origem e produção"
[4]: ../../upload/pasted_content_28.txt "Consolidação do custo completo da madeira"
[5]: financeiro-etapa-6f-implementacao-materia-prima.md "Implementação anterior de estimativa por essência"
