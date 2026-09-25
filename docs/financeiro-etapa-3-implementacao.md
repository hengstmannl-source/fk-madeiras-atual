# FINANCEIRO V2 — Etapa 3: Fluxo de Caixa Gerencial

## Objetivo

A Etapa 3 adiciona uma visão de caixa para gestão sem alterar o motor financeiro existente. O relatório separa **realizado**, formado exclusivamente por baixas válidas, de **previsto**, formado pelo saldo residual de títulos ainda em aberto.

## Fontes e regras

| Componente | Fonte | Regra aplicada |
| --- | --- | --- |
| Saldo atual | Saldo inicial das contas e baixas válidas anteriores ou no dia de referência | Não usa títulos em aberto nem extratos ainda não conciliados. |
| Realizado | `baixasFinanceiras` não estornadas | Entradas e saídas são classificadas pelo tipo da baixa e entram apenas uma vez. |
| Previsto | `titulosFinanceiros` com estado aberto, parcial ou vencido | Considera somente o saldo residual, já descontadas baixas, juros e descontos aplicáveis. |
| Transferências | `movimentosTransferenciasFinanceiras` vinculados a transferência efetivada | Não entram no consolidado; aparecem somente ao consultar uma conta específica. |
| Extrato pendente | Movimentos bancários não conciliados | É um alerta de revisão e não gera saldo, receita, despesa ou baixa. |

## Garantias

O cálculo é puramente derivado e somente de leitura. Não cria títulos, baixas, transferências, categorias ou movimentos de extrato. Títulos quitados e cancelados não são projetados; baixas estornadas não formam realizado. A visão consolidada elimina transferências internas para evitar duplicidade patrimonial, enquanto a visão individual mostra seu impacto na conta selecionada.

## Interface

A aba **Fluxo de caixa** passa a apresentar filtros por conta e período, atalhos para hoje, sete dias e mês atual, cartões de saldo atual, realizado, previsto e saldo projetado, além de uma grade diária acumulada. A tela também evidencia saldo projetado negativo e pendências de conciliação bancária.
