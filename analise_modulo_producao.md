# Análise do módulo de produção e estoque de madeira serrada

**Elaborado por:** Manus AI  
**Base analisada:** `ProduçãoAGOSTO.xlsx`, arquivo fornecido para a FK Madeiras.[1]

## Conclusão executiva

> **Sim, o fluxo desejado é viável e faz sentido no ERP:** as plaquetas entram como matéria-prima no estoque; o romaneio diário transforma esse insumo em peças serradas identificadas por madeira e dimensões; e as vendas passam a consultar e baixar esse estoque, sem perder a origem de cada peça produzida.

O sistema atual já possui itens de venda com **madeira, espessura, largura, comprimento e quantidade**. Portanto, a integração pode preservar o fluxo comercial já utilizado e acrescentar uma camada de estoque e rastreabilidade, em vez de substituir o cadastro de vendas existente.

| Etapa operacional | Registro no sistema | Movimento gerado | Resultado esperado |
|---|---|---|---|
| Entrada de matéria-prima | Cadastro de plaqueta/lote | Entrada de plaqueta | Saldo disponível para serrar |
| Produção diária | Romaneio | Consumo de plaqueta + entrada de peças serradas | Estoque de peças por dimensão |
| Venda | Item de venda vinculado ao estoque | Reserva ou saída de peças | Saldo disponível atualizado |
| Cancelamento/estorno | Exclusão ou reversão documentada | Movimento inverso | Rastreabilidade preservada |

## O que a planilha atual representa

A planilha contém seis abas diárias preenchidas, uma aba-modelo e até dois blocos de romaneio em uma mesma data. Cada bloco registra a **madeira**, a **espessura**, a **largura**, a quantidade de peças por faixa de comprimento, os metros lineares, o volume em metros cúbicos, o total de peças, observações e a participação percentual do item no romaneio.[1]

| Campo observado | Interpretação operacional | Tratamento proposto no sistema |
|---|---|---|
| Nome / Fita | Identificação da linha, máquina ou responsável pela serragem | Campo do romaneio, com cadastro opcional de máquinas/linhas |
| Data | Dia da produção | Data obrigatória do romaneio |
| Nº Romaneio | Documento operacional da produção | Número sequencial único por romaneio |
| Madeira | Espécie produzida, como Cedrinho ou Piqui | Cadastro de madeira e produto serrado |
| Bitola | Espessura em centímetros | Dimensão do produto serrado |
| Largura | Largura em centímetros | Dimensão do produto serrado |
| Linhas 2,0 a 8,5 | Quantidade por comprimento, aparentemente em metros | Comprimento e quantidade de cada item produzido |
| M Linear | Soma de comprimento × quantidade | Calculado automaticamente |
| M³ | Espessura × largura × metros lineares ÷ 10.000 | Calculado automaticamente |
| Q. Peças | Soma das quantidades lançadas | Calculado automaticamente |

A fórmula encontrada confirma o cálculo de volume em centímetros e metros lineares: `m³ = espessura (cm) × largura (cm) × metros lineares ÷ 10.000`.[1] Isso está coerente com a convenção atual do ERP, em que as dimensões são apresentadas em centímetros.

| Período analisado | Volume produzido | Peças produzidas |
|---|---:|---:|
| 03/08/2026 | 8,959 m³ | 538 |
| 04/08/2026 | 7,109 m³ | 456 |
| 05/08/2026 | 6,759 m³ | 454 |
| 06/08/2026 | 8,625 m³ | 581 |
| 07/08/2026 | 4,710 m³ | 281 |
| 10/08/2026 | 9,588 m³ | 622 |
| **Total das abas preenchidas** | **45,749 m³** | **2.932** |

Esses totais servem para validar a leitura da planilha e **não devem ser inseridos automaticamente como estoque inicial**. Antes de qualquer carga histórica, será necessário confrontá-los com o saldo físico atual, as vendas já realizadas e eventuais perdas ou ajustes.

## Fluxo proposto

### 1. Estoque de plaquetas

Cada plaqueta será registrada antes da produção como um lote de matéria-prima. O cadastro deve conter uma identificação única, espécie de madeira, data de entrada, fornecedor ou origem, volume inicial, volume disponível, localização e observações. Caso seja relevante na operação, também poderá registrar dimensões, custo e fotos.

O sistema nunca reduzirá o saldo de uma plaqueta sem produzir um movimento auditável. Assim, será possível consultar quanto entrou, quanto foi apontado no romaneio, quanto foi ajustado e qual saldo continua disponível.

### 2. Romaneio diário de produção

O romaneio substituirá a grade da planilha por uma tela de lançamento mais segura. Em vez de colunas fixas, cada linha de produção será uma peça ou grupo de peças com madeira, espessura, largura, comprimento, quantidade e observação. Os cálculos de metros lineares, peças e metros cúbicos serão automáticos.

Cada romaneio consumirá **exatamente uma plaqueta**. Na confirmação, o sistema validará que a plaqueta está disponível, registrará seu consumo uma única vez e criará, na mesma operação, os lotes de peças serradas produzidos. Uma plaqueta repetida será bloqueada pela sua identificação única e pelo histórico de consumo.

### 3. Estoque de peças serradas

O saldo visível do estoque será agrupado por **madeira + espessura + largura + comprimento**, tal como o cliente compra. Por trás desse saldo, o sistema manterá os lotes de produção para rastrear exatamente de qual romaneio e de quais plaquetas cada peça se originou.

| Entidade proposta | Responsabilidade | Campos principais |
|---|---|---|
| `plaquetas` | Lote de matéria-prima | código, madeira, volume inicial/disponível, origem, localização, estado |
| `movimentacoes_plaquetas` | Histórico de entrada, consumo, ajuste e estorno | plaqueta, tipo, volume, romaneio, motivo, usuário, data |
| `romaneios_producao` | Cabeçalho da produção diária | número, data, linha/fita, responsável, observações, estado |
| `romaneio_plaquetas` | Relação de plaquetas consumidas no romaneio | romaneio, plaqueta, volume ou quantidade consumida |
| `produtos_serrados` | Cadastro canônico do que é vendido | madeira, espessura, largura, comprimento, unidade |
| `lotes_pecas_serradas` | Saída identificável de cada produção | romaneio, produto, quantidade produzida/disponível, m linear, m³ |
| `movimentacoes_estoque_serrado` | Livro-razão de peças | lote, tipo, quantidade, venda, romaneio, motivo, usuário |
| `reservas_venda_estoque` | Ligação entre itens de venda e lotes | item de venda, lote, quantidade, estado |

### 4. Baixa automática nas vendas

Nos itens de venda, permanecerá a opção atual de item livre para orçamentos ou pedidos que ainda não dependem do estoque. Para itens existentes em estoque, o vendedor selecionará o produto serrado e a quantidade disponível.

A regra confirmada é fazer a saída de estoque somente na **entrega física**, normalmente vinculada à confirmação do recebimento. A aprovação continuará sendo uma venda comercial e financeira, sem diminuir o saldo das peças. A entrega confirmada fará a baixa definitiva; um estorno de entrega ou de recebimento devolverá as peças aos lotes originais. O sistema bloqueará entrega com saldo insuficiente e poderá sugerir lotes pela ordem de produção mais antiga (FIFO), mantendo a possibilidade de escolha manual quando necessário.

## Regras de segurança e auditoria

| Regra | Motivo |
|---|---|
| Não permitir saldo negativo de plaqueta ou peça | Evita vender ou produzir quantidade que não existe fisicamente |
| Confirmar romaneio antes de movimentar estoque | Evita lançamentos parciais durante o preenchimento |
| Reverter por movimento inverso, nunca apagando histórico | Preserva auditoria de produção, venda e ajuste |
| Proteger romaneio já usado em venda | Exige estorno da venda ou ajuste formal antes de alterar a origem |
| Vincular toda baixa a venda, romaneio ou ajuste | Permite explicar cada alteração de saldo |
| Exigir motivo para ajuste e estorno | Facilita conferência e responsabilização |

## Indicadores propostos

O módulo poderá apresentar produção por dia, por madeira, por fita/máquina, por bitola, por lote e por operador. Quando o volume de entrada das plaquetas for registrado, também será possível medir rendimento, perdas, saldo de matéria-prima e giro de cada produto serrado.

| Indicador | Fórmula ou origem |
|---|---|
| Produção diária | Peças, metros lineares e m³ confirmados no romaneio |
| Estoque disponível | Entradas de produção + ajustes − saídas de venda |
| Rendimento de serragem | Volume de peças produzidas ÷ volume consumido de plaquetas |
| Perdas e ajustes | Movimentos classificados como perda ou ajuste |
| Venda por produção | Itens de venda vinculados aos lotes produzidos |
| Saldo por produto | Madeira + dimensões + comprimento |

## Plano de implementação sugerido

| Etapa | Entrega | Resultado |
|---|---|---|
| 1 | Cadastro de plaquetas e movimentação de entrada | Matéria-prima controlada no estoque |
| 2 | Romaneio diário e cálculo automático | Produção registrada sem depender da planilha |
| 3 | Estoque de peças e rastreabilidade por lote | Peças disponíveis por medida e origem |
| 4 | Integração com vendas | Reserva/baixa automática e reversão ao excluir venda |
| 5 | Relatórios e inventário inicial | Gestão de rendimento, perdas e saldos físicos |
| 6 | Importação assistida da planilha histórica | Carga somente após conferência e aprovação do saldo inicial |

## Decisões que precisam de confirmação

Antes de iniciar a implementação, preciso confirmar os pontos abaixo para que o estoque reflita exatamente a operação física.

| Decisão | Pergunta objetiva | Recomendação inicial |
|---|---|---|
| Plaqueta | Quais dados identificam uma plaqueta: código próprio, espécie, volume, dimensões, fornecedor e localização? | Código único, madeira, m³ inicial, data e localização |
| Consumo | Um romaneio pode usar mais de uma plaqueta? | **Não. Um romaneio consome uma única plaqueta, identificada e não reutilizável.** |
| Comprimentos | As linhas 2,0 a 8,5 da planilha representam comprimento em metros? | **Sim. Comprimento em metros e largura em centímetros.** |
| Blocos na planilha | Os dois blocos de 03/08 representam fitas, turnos ou romaneios independentes? | Tratar como romaneios independentes vinculados à mesma data |
| Venda | A baixa deve ocorrer na aprovação da venda ou somente na entrega física? | **Somente na entrega física, atrelada à confirmação do recebimento.** |
| Lotes | O operador precisa escolher a plaqueta/lote na venda ou pode usar FIFO automático? | FIFO automático com opção de escolha manual |
| Histórico | Deseja importar as abas antigas ou começar o estoque pelo inventário físico atual? | **Começar a partir de agora, com entradas e baixas manuais; não importar plaquetas da planilha.** |

## Regras confirmadas para a implementação

| Regra confirmada | Aplicação no ERP |
|---|---|
| Comprimento da tora em metros; largura em centímetros | O romaneio usará comprimento em metros e as dimensões comerciais em centímetros, com cálculo automático de m³. |
| Plaqueta única | Cada plaqueta receberá um código único. Após ser consumida em um romaneio, não poderá ser selecionada novamente, exceto após um estorno formal do próprio romaneio. |
| Um romaneio por plaqueta | O formulário de produção permitirá selecionar uma única plaqueta por romaneio, criando rastreabilidade direta entre matéria-prima e peças. |
| Saída na entrega e no recebimento confirmado | A venda aprovada não baixa estoque. O sistema exigirá uma ação de entrega/recebimento para baixar as peças e registrar a conclusão comercial. |
| Inventário a partir de agora | Não haverá importação de plaquetas ou saldo histórico da planilha. O primeiro saldo será construído pelas entradas manuais que a equipe lançar. |

## Referências

[1]: `/home/ubuntu/upload/ProduçãoAGOSTO.xlsx` "Planilha ProduçãoAGOSTO fornecida pelo usuário"
