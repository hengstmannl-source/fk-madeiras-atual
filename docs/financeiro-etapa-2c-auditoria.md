# Auditoria — FINANCEIRO V2 Etapa 2C

Fonte de requisitos: `/home/ubuntu/upload/pasted_content_17.txt`.

## Premissas verificadas

| Garantia | Resultado |
|---|---|
| Importação não cria baixas ou títulos automaticamente | Confirmada por implementação e regressão estrutural |
| Movimentos OFX preservam FITID, memo, documento e saldo consolidado quando presentes | Confirmada por regressões do parser |
| Importação repetida é idempotente por conta e identificador externo | Confirmada por chave única, bloqueio transacional e regressão estrutural |
| Transferências internas não viram receitas, despesas ou baixas | Confirmada por regressão de fronteira |
| Reversão preserva auditoria e só estorna baixa criada pela conciliação | Confirmada por regressão de fronteira |

## Auditoria de dados em 26/08/2026

| Item consultado | Resultado |
|---|---:|
| Extratos bancários | 0 |
| Movimentos de extrato | 0 |
| Vínculos de conciliação | 0 |
| Auditorias de conciliação | 0 |
| Vínculos sem movimento, baixa ou transferência | 0 |
| Movimentos conciliados sem referência financeira | 0 |

Não existiam extratos nem vínculos históricos para conversão. A auditoria foi somente de leitura e não alterou dados preexistentes.

