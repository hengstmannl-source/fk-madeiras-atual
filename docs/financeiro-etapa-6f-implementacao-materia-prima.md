# FINANCEIRO V2 — Etapa 6F: custo real prioritário e referência por essência

**Status:** implementado após confirmação explícita.  
**Escopo:** leitura do custo da matéria-prima pela tora consumida na produção própria, com custo real prioritário e referência ponderada por essência somente quando a origem ou o custo real não estiver disponível.  
**Preservação:** não houve migration, reclassificação ou escrita em plaquetas, romaneios, títulos, baixas, conciliações, estoque ou qualquer histórico.

> A rentabilidade é uma leitura gerencial auditável. O custo de referência não substitui o custo real: ele é uma exceção identificada e exibida separadamente da origem rastreável.

## 1. Hierarquia de custo implantada

A fonte econômica exclusiva de matéria-prima é a cadeia `romaneio de entrada → plaqueta → consumo em produção própria`. O título financeiro derivado de `romaneio_carga` continua válido em Contas a Pagar, baixas, conciliação e Fluxo de Caixa, porém é excluído da Rentabilidade da Madeira para não representar a mesma compra duas vezes.[1] [2]

| Prioridade | Situação da tora consumida | Custo utilizado | Transparência |
|---:|---|---|---|
| 1 | Possui romaneio de entrada e custo identificado | Valor real da tora por m³ + frete real de entrada por m³. | `Custo real rastreado`, com romaneio de origem. |
| 2 | Não possui romaneio ou custo de origem identificável, mas há referência suficiente da mesma essência | Média ponderada por volume das entradas reais de mesma essência, incluindo tora e frete. | `Custo de referência por essência`, com média, quantidade de plaquetas e período. |
| 3 | Não há custo real nem referência adequada da mesma essência | Nenhum valor é apropriado. | `Custo indisponível`, com volume destacado. |

Não é usada referência de outra essência, média global de madeiras, fornecedor genérico, categoria, texto livre ou valor aleatório. A referência é uma leitura da consulta e não é gravada na plaqueta, no romaneio ou em qualquer documento financeiro.[1] [4]

## 2. Referência ponderada por volume

A referência compara entradas reais da mesma essência em uma janela transparente de **doze meses completos**, incluindo a competência consultada. Para agosto de 2026, a tela apresenta o período de **01/09/2025 a 31/08/2026**. Essa limitação reduz o efeito de compras antigas e deixa a base verificável na própria interface.[1] [3]

```text
custo real por m³ = valor real da tora por m³ + frete real de entrada por m³

custo de referência por m³ da essência
= Σ(volume da plaqueta de entrada × (valor da tora por m³ + frete de entrada por m³))
  ÷ Σ(volume da plaqueta de entrada)

custo de referência da tora consumida = volume consumido × custo de referência por m³
```

O peso é o volume da plaqueta de entrada, e não a quantidade de registros. Uma compra pequena e cara, portanto, não possui o mesmo peso de uma compra volumosa. A tora com origem não é substituída por média, ainda que exista referência mais recente.[1]

## 3. Competência, volume e custos unitários

A matéria-prima é reconhecida na data do romaneio de **produção própria confirmada**, que representa o consumo da tora. A data de entrada, vencimento, pagamento ou baixa do título não desloca esse custo entre competências. Serragem de terceiros, seus lotes e seus volumes são excluídos da base própria.[1] [2]

O volume comum é a soma dos itens de produção própria confirmados, acrescido do aproveitamento apenas quando o romaneio registrou `incluirAproveitamentoNoRendimento`. Cada volume é contado uma única vez.[1]

| Indicador unitário | Fórmula exibida |
|---|---|
| Matéria-prima por m³ | `(custo real rastreado + custo de referência) ÷ volume próprio elegível`. |
| Industrial por m³ | `(títulos industriais elegíveis + abastecimento de diesel classificado) ÷ volume próprio elegível`. |
| Comercial/administrativo por m³ | `títulos comerciais/administrativos elegíveis ÷ volume próprio elegível`. |
| Custo completo por m³ | `matéria-prima por m³ + industrial por m³ + comercial/administrativo por m³`. |

Os componentes financeiros continuam a excluir títulos de `romaneio_carga`, títulos de `nota_diesel`, títulos cancelados e centros `nao_apropriavel`. Diesel entra somente pelo abastecimento classificado; matéria-prima entra somente pelo consumo físico da tora.[1] [2]

## 4. Interface e rastreabilidade

A página **Financeiro → Rentabilidade da madeira** continua sendo uma única leitura por competência. Os cartões passam a expor, separadamente, matéria-prima por m³, industrial por m³, comercial/administrativo por m³ e custo completo por m³. A base de volume de produção própria permanece visível para interpretar todos os valores unitários.[3]

| Área | Conteúdo | Conduta quando há exceção |
|---|---|---|
| Cobertura por custo real | Volume e percentual rastreáveis pela origem física. | Não é confundida com cobertura por referência. |
| Matéria-prima consumida | Valores reais, de referência e indisponíveis; volumes correspondentes. | Referência traz essência, valor/m³, quantidade de plaquetas e período usado. |
| Custeio por produção | Linha por romaneio e expansão por tora/plaqueta. | Cada linha identifica custo real, referência ou indisponível e mostra origem/base. |
| Qualidade dos dados | Títulos sem centro, sem competência, notas de diesel e títulos de romaneio excluídos. | Mantém a exclusão de fontes duplicadas verificável. |

Na validação visual de agosto de 2026, os cartões exibiram R$ 1.291,53/m³ de matéria-prima, R$ 0,00/m³ industrial, R$ 0,00/m³ comercial/administrativo e R$ 1.291,53/m³ de custo completo sobre 119,779 m³ de produção própria. A cobertura por custo real foi de 91,7%, com 186,944 m³ reais e 16,828 m³ cobertos por referência. Os valores são calculados para a competência e não foram gravados na origem.[3]

## 5. Validação e integridade

| Camada verificada | Resultado |
|---|---|
| Lógica pura | Cobre custo real prioritário, referência ponderada por essência com frete, ausência de referência, aproveitamento, separação unitária e exclusão de título de romaneio. |
| TypeScript | `pnpm run check` aprovado. |
| Testes completos | `pnpm vitest run` aprovado: **73 arquivos e 374 testes**. |
| Build de produção | `pnpm run build` aprovado. Permanece apenas o aviso não bloqueante de chunk Vite acima de 500 kB. |
| Interface | Desktop e viewport móvel de 390 px revisados; cartões, referência temporal, cobertura e tabelas continuam legíveis. Tabelas extensas usam rolagem no próprio componente, sem overflow da página. |
| Auditoria de dados | Leitura final confirmou 52 títulos financeiros, 17 títulos de romaneio, 527 plaquetas, 213 consumos, 16 produções confirmadas e 1.376 lotes, sem criação ou alteração provocada por esta etapa. |

## 6. Limites preservados

Esta atualização não altera preços históricos, não reclassifica centros, não cria nova rotina de cadastro de custos, não estima comissão, frete comercial, impostos, folha ou diesel e não usa data de pagamento como competência. Qualquer mudança futura nesses critérios exige decisão de escopo própria.

## Referências

[1]: ../server/rentabilidade-financeira.logic.ts "Hierarquia de custeio físico, referência ponderada e consolidação"
[2]: ../server/repositories/rentabilidadeFinanceira.ts "Consulta por competência, fontes econômicas e janela de referência"
[3]: ../client/src/pages/RentabilidadeMadeiraPage.tsx "Cartões unitários, cobertura e custeio por produção"
[4]: ../../upload/pasted_content_29.txt "Confirmação da regra de referência por essência"
