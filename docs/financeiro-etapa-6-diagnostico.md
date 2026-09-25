# FINANCEIRO V2 — Etapa 6: diagnóstico antes da implementação

## Objetivo da auditoria

Este diagnóstico compara o escopo reenviado da Etapa 6 com os dados e fluxos já existentes. Nenhuma tabela, dado histórico, regra de estoque, produção, venda ou financeiro foi alterada nesta fase.

## Cadeia operacional existente

| Etapa | Fonte atual | Rastreabilidade disponível | Situação para custo real |
| --- | --- | --- | --- |
| Entrada de tora | `romaneiosCargaToras` e `plaquetas` | Romaneio, fornecedor, data, volume, valor por m³, valor da tora e frete por m³ | **Adequada** para matéria-prima e frete de entrada. |
| Consumo na produção | `itensRomaneioToras` e `plaquetas` | Plaqueta, romaneio de produção, essência e volume consumido | **Adequada** para relacionar a tora de origem à produção. |
| Produção serrada | `itensRomaneioProducao`, `lotesPecasSerradas` e aproveitamentos | Romaneio, essência, medidas, quantidade, volume e lote | **Adequada** para rendimento físico, mas sem custo materializado no lote. |
| Estoque serrado | `lotesPecasSerradas` e `movimentacoesEstoqueSerrado` | Lote, produção, saldo, venda e tipo de movimentação | **Adequada** para rastrear peças; ainda não há valoração de estoque. |
| Venda | `orcamentos`, itens e movimentações de saída | Pedido, item, preço, quantidade e lote baixado | **Adequada** para receita e saída; a margem atual é somente comercial. |
| Financeiro | `titulosFinanceiros` e baixas | Contas a pagar/receber e origem | **Não deve ser usado como origem de custo**: pagamento não representa consumo. |

## Evidência da base atual

| Indicador auditado | Resultado |
| --- | ---: |
| Romaneios de carga | 15 |
| Plaquetas cadastradas | 495 |
| Plaquetas com custo de tora | 479 |
| Plaquetas sem custo | 16 |
| Romaneios de produção confirmados | 15 |
| Toras consumidas e rastreadas na produção | 180 |
| Toras consumidas com origem em romaneio de carga | 164 |
| Toras consumidas sem romaneio de carga | 16 |
| Volume comprado | 547,566523 m³ |
| Custo de madeira comprado | R$ 380.411,78 |
| Frete total de entrada | R$ 18.751,81 |
| Volume consumido em produção | 192,096450 m³ |
| Custo de tora rastreável já consumido | R$ 128.909,87 |
| Frete de entrada rastreável já consumido | R$ 5.747,75 |
| Volume produzido em lotes próprios | 151,034137 m³ |
| Lotes próprios / de terceiros | 965 / 388 |
| Notas e abastecimentos de diesel registrados | 0 / 0 |
| Vendas aprovadas | 4 |
| Saídas de estoque por entrega | 482 |
| Saídas vinculadas a venda | 479 |

## Constatações

1. **A matéria-prima é recuperável por origem real.** As plaquetas originadas de romaneios guardam valor por m³ e os romaneios guardam frete por m³. O custo de compra e o frete de entrada podem ser atribuídos às toras efetivamente consumidas, sem usar títulos pagos ou em aberto.
2. **A produção já fornece o denominador físico.** Cada romaneio possui toras consumidas, itens produzidos, essência, volumes e lotes. Isso permite calcular rendimento e distribuir o custo rastreado pelas saídas produtivas do mesmo romaneio.
3. **Há uma cobertura histórica incompleta, mas mensurável.** Dezesseis toras consumidas não possuem vínculo a romaneio de carga e também não possuem custo informado. Elas devem aparecer como custo de matéria-prima indisponível, nunca receber valor estimado silenciosamente.
4. **Diesel não pode integrar o custo de produção ainda.** Não há notas nem abastecimentos cadastrados e, mesmo quando existirem, o modelo atual não associa abastecimento a romaneio, lote, essência ou venda. A Etapa 6 precisa de uma convenção explícita de apropriação, não de uma inferência pelo financeiro.
5. **Fretes adicionais, mão de obra e demais despesas diretas ainda não têm vínculo produtivo.** A base não permite atribuí-los a uma produção ou lote sem um mecanismo explícito e auditável.
6. **A margem publicada hoje não é margem de custo.** Ela considera preço, desconto, frete comercial, comissão e taxas, mas não custo de tora, frete de entrada, produção ou estoque. A nova margem deve ser apresentada separadamente para evitar reinterpretação do relatório existente.
7. **A saída de estoque é rastreável por lote e venda, porém o campo de volume da movimentação está zerado no histórico atual.** O cálculo de custo vendido deve recuperar a quantidade e o volume do lote/item relacionado, preservando a quantidade efetivamente baixada, em vez de confiar nesse campo histórico.

## Proposta técnica para confirmação

> Construir uma camada de custo gerencial por leitura, rastreável e sem reprocessar o estoque: matéria-prima e frete de entrada partem da plaqueta e do romaneio de carga; a apropriação aos lotes ocorre pelo romaneio de produção e pelo volume produzido; a venda recupera o custo a partir dos lotes efetivamente baixados. Itens sem custo de origem permanecem explicitamente como **cobertura incompleta**.

Para diesel, frete adicional, mão de obra e outras despesas diretas, a implementação deve usar lançamentos de apropriação com vínculo explícito a um romaneio de produção ou aceitar um critério escolhido pelo usuário. Não será adotada atribuição automática a partir de pagamentos, títulos financeiros, taxas comerciais, estimativas ou médias históricas ocultas.

## Premissas que exigem validação do responsável

| Decisão | Opções analisadas | Recomendação inicial |
| --- | --- | --- |
| Base de apropriação do custo da tora no romaneio | volume serrado sem aproveitamento; volume serrado com aproveitamento; custo por lote de saída | Usar o **volume produzido por lote**, mantendo aproveitamento separado e permitindo incluí-lo quando o romaneio já o marcar como parte do rendimento. |
| Custos de diesel, frete adicional e mão de obra | não incluir até haver vínculo; lançar por romaneio; ratear por período | Registrar/apropriar **por romaneio de produção**; não ratear por período sem confirmação. |
| Toras sem custo de origem | estimar por média; bloquear cálculo; informar cobertura parcial | Informar **cobertura parcial**, sem estimativa automática. |
| Custo em vendas antigas | reescrever histórico; calcular leitura atual com cobertura | Calcular em leitura, sem alterar dados históricos. |

## Próximo passo bloqueado por validação

A próxima fase exige confirmação destas premissas para que os custos sejam economicamente explicáveis e auditáveis. Após a aprovação, será detalhado o modelo de dados mínimo, a regra de apropriação e as telas de custo, margem e preço sugerido.
