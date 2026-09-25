# FINANCEIRO V2 — Etapa 6: metodologia e arquitetura proposta

## Escopo e salvaguardas

Esta proposta cria uma **camada gerencial de custo e formação de preço**. Ela não altera romaneios, plaquetas, lotes, estoque, vendas, títulos financeiros ou baixas já existentes. Nenhum custo será inferido a partir de pagamentos, títulos ou médias históricas. Quando faltar origem ou valor, o resultado será apresentado como **custo não determinado** ou **custo parcial**, com a origem da limitação visível.

O financeiro continua respondendo por obrigações, recebimentos e caixa. A nova camada responde pela competência de custo e por sua rastreabilidade. Uma ligação opcional a um título financeiro poderá servir apenas como referência documental informada pelo usuário; nunca será criada automaticamente e nunca definirá competência, centro de custo ou valor do custo.

## Diagnóstico revalidado

| Elo da cadeia | Fonte operacional existente | Uso proposto | Situação |
| --- | --- | --- | --- |
| Compra e frete de tora | `romaneiosCargaToras` e `plaquetas` | Custo rastreável da matéria-prima | Disponível quando a plaqueta possui romaneio e valor por m³ |
| Consumo | `itensRomaneioToras` | Vincula a tora consumida ao romaneio de produção | Disponível |
| Produção e rendimento | `romaneiosProducao`, itens, aproveitamentos e lotes | Denominador físico e custo rastreável por lote | Disponível para produção própria confirmada |
| Saída na venda | `movimentacoesEstoqueSerrado` e item de venda | Recupera os lotes efetivamente baixados | Disponível; o volume histórico da movimentação não será tomado como fonte isolada |
| Diesel | `notasDiesel` e `abastecimentosDiesel` | Possível origem documental de lançamento industrial explícito | Não há vínculo automático com custo ou rateio |
| Custos e rateios gerenciais | Não há estrutura própria | Centro, lançamento, competência, base e versão | Deve ser criado após aprovação |

O levantamento já identificado mantém **16 toras consumidas sem romaneio de carga e sem custo de origem**. Elas permanecerão sem valor atribuído. A cobertura da matéria-prima será expressa pelo volume de tora consumido com origem conhecida sobre o volume total consumido; o sistema também exibirá o volume e os itens sem custo determinado.

## Cadeia de cálculo proposta

```text
Romaneio de carga + plaqueta
        ↓
Compra da tora + frete de entrada
        ↓
Tora consumida no romaneio de produção
        ↓
Lotes próprios gerados no romaneio
        ↓
Custo rastreável de matéria-prima por m³ e por lote
        +
Rateio industrial mensal por m³
        +
Rateio comercial/administrativo mensal por m³
        ↓
Custo gerencial completo por m³
        ↓
Markup ou margem sobre preço
        ↓
Preço sugerido, sem alterar o preço comercial existente
```

## Regras de cálculo

### Matéria-prima rastreável

Para cada tora consumida com origem conhecida, o custo é composto por `volume consumido × (valor da tora por m³ + frete de entrada por m³)`. O custo conhecido do romaneio de produção é a soma dessas parcelas. O custo de matéria-prima por m³ serrado é o custo conhecido dividido pelo volume de produção elegível do romaneio.

O aproveitamento continua exclusivamente como indicador físico. A base de volume elegível usará os lotes próprios produzidos; o volume de aproveitamento somente participa quando o romaneio estiver marcado para incluí-lo no rendimento. Essa regra preserva a escolha já registrada no romaneio e não cria custo artificial.

Se alguma tora consumida não possuir custo rastreável, o valor desconhecido não será preenchido. O cálculo exibirá a parcela conhecida, a cobertura física e a lista das toras que impedem cobertura integral. Lotes e vendas derivados de produção com cobertura incompleta receberão esse mesmo status na leitura.

### Rateio industrial

Cada lançamento será classificado explicitamente em um centro do tipo **Industrial/Produção**, com competência mensal. A base inicial é o volume em m³ de lotes próprios produzidos no mês. O rateio é calculado como `total de lançamentos industriais aprovados ÷ m³ próprio produzido no período`.

Notas e abastecimentos de diesel poderão ser referenciados por um lançamento gerencial informado pelo usuário, mas não serão convertidos automaticamente. Manutenção, mão de obra produtiva, energia e materiais seguirão a mesma regra: só entram no cálculo depois de lançamento e classificação explícitos.

### Rateio comercial e administrativo

Cada lançamento será classificado explicitamente em um centro do tipo **Comercial/Administração**, também por competência mensal. A base inicial proposta é o volume em m³ de lotes próprios produzidos no mês. O cálculo segue `total comercial/admin aprovado ÷ base mensal`.

Impostos, comissões e materiais de amarração poderão ser classificados neste centro ou mantidos como componentes comerciais específicos, mas somente mediante decisão e classificação explícita. Nada será inferido dos valores já existentes em vendas ou títulos.

### Custo completo, margem e preço sugerido

O custo gerencial completo por m³ será sempre composto por três parcelas independentes: matéria-prima rastreável, industrial rateado e comercial/administrativo rateado. A formação de preço aceitará dois métodos explicitamente identificados:

| Método | Fórmula | Exemplo para custo de R$ 2.580 e percentual de 20% |
| --- | --- | ---: |
| Markup | `custo × (1 + percentual)` | R$ 3.096,00 |
| Margem sobre o preço | `custo ÷ (1 - percentual)` | R$ 3.225,00 |

O resultado será apenas uma recomendação gerencial. Não atualizará automaticamente vendas, tabelas comerciais, margens existentes ou preços de estoque.

## Entidades novas propostas

| Entidade | Propósito | Campos essenciais |
| --- | --- | --- |
| `centrosCustosGerenciais` | Cadastro configurável dos centros Industrial e Comercial/Administração | nome, tipo, ativo, ordem, observação |
| `categoriasCustosGerenciais` | Agrupamento configurável dentro do centro | centro, nome, ativo, ordem |
| `lancamentosCustosGerenciais` | Registro explícito de custo por competência | centro, categoria, competência mensal, valor, descrição, origem documental opcional, responsável, estado |
| `rateiosCustosGerenciais` | Cabeçalho versionado de cada cálculo mensal | centro, competência, base, volume-base, total, valor por m³, versão, calculado por/em, estado |
| `itensRateiosCustosGerenciais` | Evidência dos lançamentos considerados no cálculo | rateio, lançamento, valor considerado |
| `calculosCustosGerenciais` | Materialização/versionamento da leitura por produção, lote ou venda | escopo/origem, competência, parcelas de custo, cobertura, status, versão de rateio, calculado em |

As entidades de custo terão referências aos registros operacionais de origem. Recalcular criará uma nova versão ou invalidará explicitamente a versão anterior; o histórico de cálculo nunca será apagado silenciosamente. A operação continuará single-tenant e protegida por permissões administrativas para cadastro, classificação e recálculo.

## Relacionamentos

```text
plaqueta → romaneio de carga → custo de compra/frete
plaqueta → item de tora consumida → romaneio de produção
romaneio de produção → lote próprio → movimentação de estoque → item de venda

centro de custo → categoria → lançamento de custo → rateio mensal versionado
rateio mensal + custo rastreável → cálculo por produção/lote/venda
```

Serragem de terceiros e lotes de propriedade de terceiros não entram na base de custo da madeira própria nem na formação de preço de estoque próprio. Eles poderão ser analisados futuramente como rentabilidade de serviço, em fluxo separado.

## Decisões que exigem confirmação

| Decisão | Proposta inicial | Confirmação necessária |
| --- | --- | --- |
| Base industrial | m³ de lotes próprios produzidos no mês | Confirmar |
| Base comercial/admin | m³ de lotes próprios produzidos no mês | Confirmar ou substituir por m³ vendido |
| Período dos rateios | Mensal, por competência | Confirmar |
| Matéria-prima | Compra da tora + frete de entrada | Confirmar |
| Aproveitamento | Participa na base apenas quando já marcado no romaneio | Confirmar |
| Produção de terceiros | Excluída da base e do custo de estoque próprio | Confirmar |
| Política de preço | Oferecer markup e margem sobre o preço, sem alterar preço atual | Confirmar |
| Impostos/comissões | Configuração explícita entre comercial/admin e componente comercial | Definir política inicial |

## Limites assumidos nesta etapa

Esta arquitetura não introduz custo médio oculto, revaloração de estoque, alteração de movimentos históricos, baixa automática de financeiro, impostos automáticos, contabilização fiscal, apropriação direta por máquina ou mecanismo de custo estimado. Também não tornará custo desconhecido em conhecido por média de espécie, fornecedor ou último preço.

## Próximo passo bloqueado

Após a validação das decisões acima, o trabalho seguirá para o modelo físico do banco, migration não destrutiva, regras puras e contratos. Até essa confirmação, nenhuma tabela, cálculo operacional, tela ou dado histórico será modificado.
