# FINANCEIRO V2 — Etapa 2C: conciliação bancária assistida

## Objetivo

Esta etapa trata o extrato bancário como uma fonte externa de conferência. A importação cria movimentos bancários próprios e preserva os dados informados pelo arquivo; ela **não cria títulos, baixas, receitas, despesas ou categorias**.

## Estrutura e idempotência

As tabelas `extratosBancarios`, `movimentosExtratoBancario`, `vinculosConciliacaoBancaria` e `auditoriasConciliacaoBancaria` sustentam o fluxo. Um movimento importado mantém data, valor, sentido, descrição, FITID/identificador externo, memo, documento, saldo e referência do arquivo quando disponíveis.

O identificador externo é único por conta. Quando um arquivo é importado novamente, movimentos já reconhecidos são ignorados de forma idempotente; a importação é bloqueada por conta dentro da transação. O parser também rejeita duplicidades internas antes de qualquer persistência.

## Conciliação assistida

As sugestões são determinísticas e explicáveis. Para baixas existentes, exigem conta, natureza e valor compatíveis, além de avaliar proximidade de data e descrição. Para transferências internas, exigem conta, sentido, valor e data compatíveis, apresentando a contrapartida como evidência.

Ao confirmar uma baixa já existente, a conciliação somente vincula o movimento e marca a baixa como conciliada. Ao criar um lançamento explicitamente, o repositório delega a criação de título ao motor financeiro idempotente e a baixa ao ciclo central. Assim, saldo, estado e `valorBaixado` do título continuam derivados pelas regras já existentes.

## Transferências internas e reversões

Uma transferência é conciliada pelo respectivo movimento patrimonial, nunca por título ou baixa. Essa associação não afeta receita, despesa, categoria, fluxo de caixa ou previsão de caixa.

Ignorar, sinalizar divergência e desfazer conciliação registram auditoria com usuário e motivo. A reversão estorna somente a baixa que foi gerada explicitamente pela conciliação; uma baixa preexistente volta apenas ao estado não conciliado. Vínculos desfeitos são reativados quando o mesmo item é conciliado novamente, preservando a trilha histórica e respeitando as chaves únicas.

## Fora do escopo

Não houve reclassificação nem conversão automática de extratos, baixas, cheques ou transferências históricas. OFX/CSV continua sendo importação assistida, sujeita à revisão humana antes de qualquer confirmação financeira.

