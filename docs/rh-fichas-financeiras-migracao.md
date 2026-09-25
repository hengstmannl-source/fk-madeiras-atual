# Decisão de reestruturação — RH por fichas financeiras

## Decisão

O módulo será **reestruturado sobre a base existente**, e não removido e recriado. O cadastro de colaboradores, departamentos, cargos, histórico salarial, benefícios e configurações de custos já atende ao novo objetivo de gestão interna e deve ser preservado. O fluxo legado de folha oficial deixará de compor a experiência principal do RH.

## Novo núcleo funcional

A nova fonte operacional será uma ficha financeira por colaborador, formada por lançamentos cronológicos de **crédito**, **débito** e **pagamento**. O saldo será calculado como créditos menos débitos e pagamentos liquidados, com competência, status, categoria, vínculo financeiro opcional, motivo de cancelamento e trilha de auditoria.

## Dados que permanecem válidos

| Estrutura existente | Uso após a reestruturação |
|---|---|
| Colaboradores, cargos, departamentos e histórico salarial | Cadastro e contexto da ficha individual |
| Benefícios e custos por colaborador | Custo gerencial e, quando necessário, débito configurável na ficha |
| Configuração de custos e FGTS estimado | Base da área Salários e Encargos gerenciais |
| Adiantamentos e parcelas existentes | Histórico preservado e referência para migração controlada ao extrato |
| Auditorias existentes | Histórico de operações já realizadas |

## Estruturas a descontinuar da experiência principal

As telas e fluxos de cálculo oficial de folha, IRRF, eventos com incidências legais, tabelas tributárias e fechamento oficial não serão apagados nem terão dados removidos. Eles deixarão de ser o fluxo principal do RH e serão substituídos pelas fichas financeiras, competências gerenciais e relatórios de valores a pagar.

## Regras de migração

1. As migrações de banco serão estritamente não destrutivas.
2. Adiantamentos históricos continuarão disponíveis; somente saldos ainda abertos poderão gerar lançamentos iniciais de débito identificados como migração, evitando duplicidade.
3. Nenhum título financeiro será criado em duplicidade: cada lançamento interno poderá armazenar seu vínculo com a conta a pagar correspondente.
4. Salários, encargos, FGTS, INSS patronal e provisões serão apresentados exclusivamente como estimativas gerenciais, sem cálculo ou promessa de folha oficial.

## Ordem de entrega

Primeiro serão criados o livro de lançamentos, categorias e ficha individual. Em seguida virão pagamento, integração financeira e bloqueio de competências. Por último serão entregues dashboard, Salários e Encargos, Valores a Pagar, relatórios e a reorganização da navegação.
