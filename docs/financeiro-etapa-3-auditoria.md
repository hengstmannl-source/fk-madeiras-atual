# Auditoria — FINANCEIRO V2 Etapa 3

## Escopo verificado

A auditoria foi realizada após a implementação do fluxo de caixa gerencial, sem modificar dados históricos. Foram verificadas as fontes de saldo, baixas válidas, títulos em aberto e integridade dos movimentos de transferências.

| Verificação | Resultado |
| --- | ---: |
| Contas financeiras ativas | 3 |
| Saldo inicial ativo | R$ 0,00 |
| Baixas válidas | 12 |
| Valor total das baixas válidas | R$ 356.034,61 |
| Títulos em aberto, parciais ou vencidos | 27 |
| Transferências internas efetivadas | 0 |
| Movimentos de transferência órfãos | 0 |

## Conclusão

> O relatório gerencial consulta as fontes financeiras existentes e não reconcilia, baixa, estorna ou reprocessa dados históricos.

A ausência de movimentos de transferência órfãos confirma a integridade da fonte patrimonial disponível para o relatório. Como não havia transferências efetivadas na auditoria, a regra de exclusão no consolidado e de exibição por conta foi coberta por regressões determinísticas.
