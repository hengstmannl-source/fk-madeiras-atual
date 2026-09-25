# FINANCEIRO V2 — Etapa 2B: implementação em validação

- As transferências são persistidas em `transferenciasFinanceiras` e geram dois movimentos vinculados em `movimentosTransferenciasFinanceiras`, sem criar títulos, baixas ou categorias.
- A criação ocorre em transação; exige contas distintas, existentes e ativas, além de valor positivo.
- O estorno atualiza condicionalmente a transferência original e cria uma transferência inversa vinculada, preservando a trilha de auditoria.
- O fluxo de caixa e a previsão semanal continuam baseados exclusivamente em baixas de títulos, portanto não classificam transferências como receita ou despesa.
- A suíte integral identificou apenas mocks da página financeira sem o novo contrato `financeiro.transferencias`; a implementação da tela será acompanhada da atualização desses mocks antes da nova execução completa.

As regras unitárias já cobrem contas distintas, contas ativas, valor positivo e o reflexo bilateral no saldo por conta. A etapa final acrescentará uma regressão estrutural do repositório para assegurar que transferências não criem títulos ou baixas e sejam sempre registradas como par patrimonial vinculado.
