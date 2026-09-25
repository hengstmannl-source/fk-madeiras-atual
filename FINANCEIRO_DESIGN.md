# Módulo Financeiro — Modelo de Referência

## Objetivo

O módulo financeiro será uma camada própria do FK Madeiras. Ele receberá informações dos orçamentos, mas não dependerá deles para funcionar. Dessa forma, o sistema poderá registrar receitas geradas pela venda de madeira, despesas operacionais, entradas e saídas excepcionais, recorrências e pagamentos parciais sem alterar o histórico comercial de cada orçamento.

> O orçamento descreve a negociação comercial. O título financeiro representa o compromisso de receber ou pagar. A baixa financeira representa cada valor efetivamente liquidado.

## Entidades centrais

| Entidade | Responsabilidade | Vínculos principais |
|---|---|---|
| **Fornecedor** | Cadastro de quem fornece produtos ou serviços à empresa. | Pode ser associado a títulos a pagar. |
| **Categoria financeira** | Classificação de receitas e despesas, podendo ter uma categoria-pai. | Obrigatória para todo título. |
| **Conta financeira** | Caixa, banco ou carteira usada para registrar a movimentação efetiva. | Associada às baixas e à conciliação. |
| **Título financeiro** | Conta a pagar ou receber com valor, vencimento, status e contraparte. | Pode nascer de orçamento, lançamento manual ou recorrência. |
| **Baixa financeira** | Registro imutável de uma liquidação total ou parcial. | Pertence a um título e informa valor, data, forma e conta financeira. |
| **Recorrência financeira** | Regra que gera títulos periódicos. | Produz títulos futuros e mantém o próximo vencimento. |

## Regras de negócio

Um orçamento aprovado deverá criar uma **conta a receber** vinculada ao seu identificador, ao cliente e ao valor total. O vencimento inicialmente será a data da aprovação, podendo ser ajustado na tela financeira. Registros de pagamento já existentes no módulo de orçamentos permanecem apenas como histórico; a geração automática passará a valer para novos orçamentos após a publicação desta expansão.

Os lançamentos não programados terão origem **manual** e poderão ser classificados como pagar ou receber. Eles não precisarão de orçamento, cliente, fornecedor ou recorrência vinculados, mas sempre exigirão descrição, categoria, valor e vencimento. A contraparte poderá ser informada em texto livre quando não houver um cadastro correspondente.

O status de um título será calculado a partir do valor previsto, das baixas e do vencimento. Um título poderá estar **aberto**, **parcial**, **quitado**, **vencido** ou **cancelado**. Baixas nunca serão substituídas: uma correção deverá ocorrer por estorno e novo lançamento, mantendo trilha de auditoria.

| Situação | Condição |
|---|---|
| **Aberto** | Não possui baixa e ainda não venceu. |
| **Parcial** | Possui baixa inferior ao valor líquido do título. |
| **Quitado** | A soma das baixas atinge o valor líquido do título. |
| **Vencido** | Possui saldo em aberto e a data de vencimento já passou. |
| **Cancelado** | Foi cancelado antes da quitação e conserva seu histórico. |

Parcelamentos serão implementados como vários títulos independentes, agrupados por um mesmo código de parcela. Isso permite vencimentos diferentes, baixas parciais e cancelamento individual sem perder a relação com a operação original.

As recorrências terão periodicidade semanal, mensal, trimestral, semestral ou anual, uma data de início, data final opcional e próximo vencimento. Uma verificação diária gerará somente os títulos que já atingiram sua data programada, de maneira idempotente. Os alertas iniciais serão mostrados no painel financeiro para títulos vencidos e para vencimentos próximos; canais externos poderão ser conectados posteriormente.

## Conciliação e contas financeiras

As baixas informarão a conta financeira de entrada ou saída, como caixa, conta bancária ou carteira. O sistema terá conciliação manual: cada baixa poderá ser marcada como conciliada, com data e observação. A importação automática de extratos e integrações bancárias não faz parte desta primeira implementação, mas o modelo fica preparado para receber essas referências futuramente.

## Proteções de dados

Os valores monetários serão armazenados como decimais e toda alteração sensível ficará associada ao usuário responsável. Orçamentos continuarão como fonte comercial; o financeiro guardará o vínculo de origem sem copiar ou alterar itens, medidas ou preços do orçamento. Um título ligado a orçamento não poderá ser apagado de modo silencioso: deverá ser cancelado, para preservar a rastreabilidade.
