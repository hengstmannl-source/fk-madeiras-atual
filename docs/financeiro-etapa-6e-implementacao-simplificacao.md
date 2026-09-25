# FINANCEIRO V2 — Etapa 6E: rentabilidade simplificada por Centro de Custo

**Status:** implementação concluída após aprovação explícita.  
**Propósito:** centralizar a classificação dos custos no Financeiro e consultar a rentabilidade por competência e Centro de Custo, preservando as fontes econômicas já existentes.

> A Rentabilidade da madeira é uma **leitura auditável dos registros de origem**. Ela não cria despesa, título, baixa, conciliação, rateio ou cálculo histórico adicional.

## Decisão implementada

O cadastro `centrosCustosGerenciais` foi preservado e evoluído para atuar como o cadastro central de Centros de Custo do Financeiro. O centro registra a **área responsável** pelo custo, enquanto a categoria financeira continua registrando a sua **natureza econômica**. Os tipos de centro suportados são `industrial`, `comercial_administrativo` e `nao_apropriavel`.[1]

| Camada | Uso após a Etapa 6E | Garantia de preservação |
|---|---|---|
| `titulosFinanceiros` | Documento financeiro canônico; recebe Centro de Custo opcional e é uma das fontes lidas pela rentabilidade. | Nenhum título anterior foi classificado automaticamente. |
| `recorrenciasFinanceiras` | Armazena a classificação que deve ser herdada pelo título futuro. | Vínculo opcional para manter compatibilidade. |
| Centros de Custo | Cadastro único para classificação manual e propagação de fontes automáticas. | O cadastro existente foi ampliado, não substituído. |
| Estruturas gerenciais anteriores | Centros, categorias, lançamentos, rateios, itens, cálculos e componentes permanecem definidos no schema. | Não foram apagados, convertidos ou alimentados pela nova operação. |
| Rentabilidade da madeira | Consulta mensal por competência e por Centro de Custo. | Não opera um segundo Financeiro. |

## Migrações e auditoria de histórico

As migrations `0071_optimal_ghost_rider.sql` e `0072_dashing_changeling.sql` foram aplicadas como evolução aditiva. A primeira inclui `centroCustoId` em títulos e recorrências, além de `tipo` e `observacoes` no cadastro de centros. A segunda acrescenta a mesma referência, sempre opcional, às fontes automáticas de abastecimento e nota de diesel, colaboradores, orçamentos, romaneios de carga de toras e serragens de terceiros.[2] [3]

Uma auditoria de leitura no encerramento confirmou que todas as oito novas referências são anuláveis. Havia **52 títulos financeiros**, todos ainda sem Centro de Custo, e nenhuma recorrência cadastrada. Isto confirma que a implantação não preencheu ou reinterpretou automaticamente o histórico.

| Checagem | Resultado observado |
|---|---|
| Campos novos `centroCustoId` | Presentes e anuláveis nas oito entidades previstas. |
| Evolução do cadastro central | `codigo`, `tipo` e `observacoes` presentes; o padrão de `tipo` é `industrial` para manter o cadastro anterior compatível. |
| Títulos históricos | 52 no total; 52 sem centro; 0 reclassificados pela migration. |
| Recorrências históricas | 0 registros. |
| Estruturas gerenciais legadas | Permanecem no schema e não foram removidas.[1] |

## Operação financeira e compatibilidade

Na interface, novos lançamentos, parcelamentos e novas recorrências exigem categoria financeira e Centro de Custo. A validação central verifica se o centro está ativo e pertence à empresa antes da gravação.[4] A criação por importação CSV, conciliação e fluxos automáticos também encaminha o vínculo quando a classificação foi informada de forma explícita.

Os títulos antigos sem centro permanecem editáveis. Ao salvar um desses registros sem selecionar classificação, a tela não envia um `centroCustoId` vazio; caso o usuário escolha um centro, a classificação é atualizada de modo explícito. Na alteração em lote, o centro só muda quando o campo foi preenchido; sem essa seleção, cada título conserva o centro atual.[5]

| Fluxo | Regra da implementação |
|---|---|
| Novo lançamento manual ou parcelado | Categoria e Centro de Custo obrigatórios na interface. |
| Título histórico sem classificação | Pode ser editado e salvo sem classificação retroativa. |
| Edição com centro selecionado | Atualiza o vínculo após validar centro ativo e da empresa. |
| Edição em lote | Preserva o vínculo anterior quando nenhum centro foi escolhido. |
| Recorrência | O título futuro idempotente herda o Centro de Custo da recorrência.[6] |
| CSV financeiro | A coluna `centro_custo` é obrigatória, aceita nome ou código, exige centro ativo e rejeita o lote inteiro diante de erro.[7] |

## Fontes econômicas e prevenção de duplicidade

A classificação das origens é explícita; não há inferência por texto de descrição, fornecedor, cliente ou palavras-chave. Títulos, baixas, conciliações e transferências continuam sendo documentos ou operações financeiras, não uma nova despesa econômica.

| Evento | Fonte usada na leitura | Regra de não duplicidade |
|---|---|---|
| Matéria-prima e frete de entrada | Título de origem `romaneio_carga` que foi classificado pelo fluxo físico-financeiro. | A componente é lida uma vez pelo título de origem; não se cria outra despesa derivada. |
| Diesel operacional | `abastecimentosDiesel`, na data do abastecimento e pelo custo total apurado. | Títulos de origem `nota_diesel` são excluídos expressamente da rentabilidade.[8] |
| Nota de diesel | Mantém estoque e agendamento/título financeiro como documentos do seu fluxo. | Não é somada ao abastecimento como custo operacional. |
| Serragem de terceiros | Pode carregar classificação explícita na origem. | Não converte o estoque de terceiro ou um reflexo financeiro em custo duplicado da produção própria. |
| RH e folha | O centro de colaborador pode ser encaminhado aos títulos automáticos quando houver classificação explícita. | Esta etapa não soma uma provisão/estimativa a um título derivado como se fossem dois custos. |
| Venda, recebível, comissão, frete comercial e taxas | Mantêm os respectivos fluxos comercial e financeiro. | Só podem ser apropriados com origem e classificação explícitas; não há cálculo inferido. |

Transferências internas não criam títulos nem compõem a rentabilidade. Um gasto sem classificação operacional permanece fora da leitura por não possuir Centro de Custo. Para despesas financeiras, dívidas, retiradas ou outros movimentos não apropriáveis, deve ser usado o tipo de centro `nao_apropriavel`; a consolidação o exclui. A etapa não presume essa classificação a partir de descrição ou categoria.[9]

## Leitura por competência

A página **Financeiro → Rentabilidade da madeira** recebe uma competência mensal. Pagamento, baixa ou conciliação posterior não alteram o período econômico: a consulta usa a competência do título, o mês do abastecimento e o mês de produção própria confirmado.[8]

| Painel | Regra |
|---|---|
| Custos industriais | Soma componentes cujo centro é `industrial`. |
| Comercial/administrativo | Soma componentes cujo centro é `comercial_administrativo`. |
| Matéria-prima | Subtotal dos componentes de origem `romaneio_carga`. |
| Custo por m³ | Divide custo industrial ou custo total apropriado pelo volume de produção própria confirmada na competência. Quando não há volume, não estima valor. |
| Custo por centro e categoria | Agrupa os mesmos componentes por centro e por categoria; não produz lançamentos. |
| Qualidade dos dados | Exibe títulos sem centro, títulos sem competência e títulos de nota de diesel excluídos. |

Títulos cancelados, títulos sem Centro de Custo, títulos sem competência e títulos de nota de diesel não entram como componentes apropriados. Centros `nao_apropriavel` também são removidos da consolidação. Esses valores são mantidos como alerta de qualidade quando aplicável, em vez de distribuídos por uma regra implícita.[8] [9]

## Limites deliberados do escopo

Esta implementação não inicia uma Etapa 6F. Ela não apaga tabelas nem dados, não reclassifica passado, não gera médias para custos ausentes, não retoma o fluxo operacional diário de lançamentos/rateios gerenciais e não infere comissão, imposto ou frete comercial. Uma nova regra econômica ou uma automação de apropriação requer escopo e aprovação próprios.

## Validação de encerramento

| Verificação | Resultado |
|---|---|
| TypeScript | `pnpm run check` aprovado. |
| Regressões | `pnpm vitest run` aprovado com **73 arquivos e 372 testes**. A suíte cobre centros, importação CSV, rentabilidade, repositório financeiro e interface. |
| Build | `pnpm run build` aprovado. |
| Interface | Rotas `/financeiro` e `/financeiro/rentabilidade-madeira` revisadas em desktop e viewport móvel de 390 px; filtros, cartões, alertas de qualidade e estados sem dados permaneceram acessíveis. |
| Warnings não bloqueantes | O build alerta sobre chunk Vite acima de 500 kB. Alguns testes de diálogo Radix emitem aviso de `Description`. Nenhum bloqueou compilação, execução ou teste. |

## Referências

[1]: ../drizzle/schema.ts "Schema: Centros e estruturas gerenciais"
[2]: ../drizzle/0071_optimal_ghost_rider.sql "Migration 0071 — Centros em títulos e recorrências"
[3]: ../drizzle/0072_dashing_changeling.sql "Migration 0072 — Centros nas fontes automáticas"
[4]: ../server/centros-custo.logic.ts "Validação central de Centro de Custo"
[5]: ../client/src/pages/FinanceiroPage.tsx "Interface financeira: compatibilidade histórica e alteração em lote"
[6]: ../server/repositories/financeiro.ts "Repositório financeiro: atualização e herança em recorrências"
[7]: ../server/financeiro.intercambio.ts "Importação e exportação CSV financeira"
[8]: ../server/repositories/rentabilidadeFinanceira.ts "Consulta de rentabilidade financeira por competência"
[9]: ../server/rentabilidade-financeira.logic.ts "Consolidação por tipo de Centro de Custo"
