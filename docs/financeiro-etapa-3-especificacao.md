# FINANCEIRO V2 — Etapa 3: Fluxo de Caixa Gerencial

## Objetivo

Disponibilizar uma camada **somente de leitura e projeção** que permita visualizar saldo atual, realizado, previsto e saldo projetado. Esta etapa não cria uma segunda fonte de verdade e não altera o motor de títulos, baixas, transferências ou conciliação.

## Fontes autorizadas

| Informação | Fonte |
| --- | --- |
| Saldo atual | Saldo inicial de cada conta, baixas válidas e transferências efetivadas no recorte da conta |
| Realizado | Baixas válidas na data efetiva da baixa; movimentos bancários somente quando já vinculados, sem duplicá-los |
| Previsto | Saldo em aberto reconstruído pelo motor de títulos, na data de vencimento |
| Transferências | Par patrimonial por conta individual; impacto líquido zero no consolidado |
| Movimentos de extrato não conciliados | Área de atenção, excluídos do realizado e do previsto |

## Regras obrigatórias

1. Consolidado não classifica transferências internas como receita ou despesa e mantém impacto líquido zero.
2. Conta individual exibe a saída ou entrada de sua própria transferência na data do movimento.
3. Títulos quitados e cancelados não entram na previsão; títulos parciais entram apenas pelo saldo aberto calculado no ciclo central, incluindo juros e descontos.
4. Baixas futuras não são realizado; o realizado usa exclusivamente a data efetiva da baixa.
5. O saldo projetado parte do saldo atual e acumula entradas e saídas previstas do intervalo; deve mostrar menor saldo, data correspondente e alerta quando negativo.
6. Cada agregação precisa devolver itens rastreáveis à conta, título, baixa, transferência ou origem operacional.
7. Sem DRE, forecast probabilístico, cenários, IA, margem ou análises de cliente/fornecedor nesta etapa.

## Critérios de validação

Cobrir saldo de contas, entradas e saídas previstas, parcialidade, quitação, cancelamento, transferências por conta e consolidado, menor saldo, saldo negativo, extrato não conciliado e parcelas. Validar `pnpm check`, `pnpm test`, `pnpm build`, integridade dos dados e interface.
