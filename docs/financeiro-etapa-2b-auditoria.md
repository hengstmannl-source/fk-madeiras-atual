# FINANCEIRO V2 — Etapa 2B: Auditoria inicial

Fonte de requisitos: `/home/ubuntu/upload/pasted_content_16.txt`.

## Premissas confirmadas

- Transferência interna é movimentação patrimonial entre duas contas da empresa; não cria título financeiro, receita, despesa, baixa, categoria ou efeito líquido no fluxo de caixa.
- Cada operação deverá produzir movimentos vinculados de saída e entrada, gravados na mesma transação e identificados pela mesma transferência.
- A operação exige contas de origem e destino distintas, ambas ativas e pertencentes à empresa única, valor positivo e data válida.
- O estorno não apaga a transferência original; deverá ser uma operação de reversão auditável e idempotente.
- Depósitos de cheque existentes permanecem no fluxo próprio de cheques e não serão reinterpretados como transferências nesta etapa.

## Auditoria de dados em 26/08/2026

| Item consultado | Resultado |
|---|---:|
| Cheques depositados | 0 |
| Cheques depositados sem conta de destino | 0 |
| Baixas financeiras válidas | 12 |
| Títulos financeiros existentes | 50 |

Não há candidato histórico a ser convertido automaticamente nesta etapa. Nenhum dado foi alterado pela auditoria.
