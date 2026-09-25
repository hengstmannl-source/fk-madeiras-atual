# FINANCEIRO V2 — Etapa 6: implementação de rentabilidade da madeira

## Objetivo e fronteiras

Esta etapa introduz uma camada de **custo gerencial auditável** para a madeira própria. Ela calcula, registra e consulta custos sem modificar romaneios, plaquetas, lotes, movimentações de estoque, pedidos, títulos, baixas ou conciliações já existentes. Os cálculos são versões independentes, vinculadas às evidências que os originaram.

> O módulo não usa pagamento, baixa, título quitado, conciliação bancária, média histórica, último preço ou inferência por espécie/fornecedor como custo automático.

| Tema | Regra implementada |
|---|---|
| Matéria-prima | Compra registrada na plaqueta consumida, acrescida do frete de entrada do romaneio de carga. |
| Produção própria | Somente lotes com propriedade `proprio` participam de custo e das bases industriais. |
| Produção de terceiros | Permanece fora de denominadores, custo de estoque próprio e rateios industriais. |
| Origem ou custo ausente | É exibido como custo não determinado/parcial; nenhuma média substitui a ausência. |
| Frete comercial | Nunca se mistura ao frete de entrada. Pode ser custo direto referenciado à venda ou categoria rateada. |
| Comissão | Só é incluída automaticamente quando a venda possui comissão válida **e** a categoria direta autoriza explicitamente esse uso. |
| Financeiro | Pode ser referência documental; não cria título, baixa, pagamento ou conciliação. |
| Formação de preço | É apenas simulação por markup ou margem sobre o preço; não altera qualquer preço operacional. |

## Mapeamento da rastreabilidade

O custo da matéria-prima percorre apenas a cadeia física comprovável abaixo. O repositório de custos consulta essas entidades em lote para evitar reconstrução baseada em saldo ou movimento financeiro.

```text
Romaneio de carga + frete de entrada
  → Plaqueta com valor por m³
    → Tora consumida no romaneio de produção
      → Lote próprio serrado
        → Movimentação de saída vinculada ao item da venda
          → Cálculo gerencial materializado da venda
```

| Camada | Evidência usada | Parcela resultante |
|---|---|---|
| Entrada | `romaneiosCargaToras` e `plaquetas` | Compra da tora e frete de entrada por volume consumido. |
| Produção | `itensRomaneioToras`, `romaneiosProducao` e `lotesPecasSerradas` | Custo rastreável de produção e distribuição aos lotes próprios pelo volume produzido. |
| Venda | `movimentacoesEstoqueSerrado`, item de venda e lote | Volume físico entregue, custo dos lotes e custos comerciais diretos/rateados explicitamente configurados. |
| Rateio | Categorias, lançamentos ativos e bases da competência | Parcela estrutural por categoria, com snapshot e memória de cálculo. |

O volume histórico de `movimentacoesEstoqueSerrado` não é usado isoladamente, pois há registros antigos com volume zerado. A saída é recomposta pelo vínculo físico, quantidade efetivamente baixada e dimensões/volume do lote ou do item correspondente.

## Fórmulas e cobertura

Para cada tora com origem e valor identificáveis, o custo consumido é a soma dos valores efetivamente consumidos:

```text
custo de matéria-prima rastreável = Σ(custo de compra consumido + frete de entrada consumido)
custo por m³ coberto = custo rastreável ÷ volume coberto
cobertura física = volume coberto ÷ volume total consumido
```

O custo conhecido é repartido pelos lotes próprios do romaneio conforme o volume produzido. O rendimento/aproveitamento é um **indicador físico**. Ele só participa do denominador quando a produção o incluiu explicitamente; não existe uma linha de custo artificial de “aproveitamento”. Serragem e produção de terceiros não entram na base de custo próprio.

| Base configurável por categoria | Critério |
|---|---|
| `m3_produzido` | Volume de lotes próprios confirmados na competência. |
| `m3_vendido` | Volume físico vendido/reconstruído na competência. |
| `valor_vendido` | Receita de vendas aprovadas da competência. |
| `quantidade_vendida` | Quantidade física dos itens vendidos. |
| `carga` | Quantidade de romaneios de carga na competência. |
| `pedido` | Quantidade de pedidos/vendas aprovados na competência. |
| `percentual_receita` | Aplica o percentual somente sobre a receita da competência. |
| `manual` | Mantém o valor registrado, sem fator unitário implícito. |

Quando uma base exigida está ausente ou é zero, o rateio mantém o valor e a evidência, porém registra fator zero e cobertura zero. Não há divisão, média ou estimativa alternativa.

## Versionamento e competência

As tabelas de configuração, lançamentos, rateios, cálculos e componentes preservam a trilha de auditoria. Uma nova geração de rateio substitui a versão vigente por competência, sem excluir a versão anterior. Cada cálculo materializado tem versão, snapshot de cobertura, referência de rateio e componentes detalhados.

Custos diretos de venda exigem a venda vinculada. A competência padrão é a competência/data da própria venda. Quando a competência é modificada, o sistema preserva a competência original e grava usuário, data e justificativa da exceção.

## Estruturas adicionadas

| Estrutura | Finalidade |
|---|---|
| `centrosCustosGerenciais` | Centros Industrial e Comercial/Administração configuráveis. |
| `categoriasCustosGerenciais` | Base, natureza estrutural/direta e autorização explícita para comissão. |
| `lancamentosCustosGerenciais` | Evidência de custo por competência, com referências opcionais e cancelamento auditável. |
| `rateiosCustosGerenciais` e `itensRateiosCustosGerenciais` | Versões de rateio e memória por categoria. |
| `calculosCustosGerenciais` e `componentesCalculosCustosGerenciais` | Cálculos versionados por produção, lote ou venda e suas parcelas. |

As migrations `0066_premium_darkstar.sql`, `0067_black_abomination.sql`, `0068_omniscient_quasimodo.sql` e `0069_sturdy_electro.sql` são não destrutivas. A auditoria posterior à aplicação confirmou que as sete estruturas gerenciais estavam vazias: nenhum registro operacional, financeiro ou histórico foi migrado, reclassificado ou alterado.

## Interface operacional

A tela **Financeiro → Rentabilidade da madeira** disponibiliza:

| Área | Uso |
|---|---|
| Visão gerencial | Cobertura, valores materializados e competências consultadas. |
| Centros e categorias | Configuração de centro, categoria, base e autorização de comissão. |
| Lançamentos | Registro de evidência monetária ou percentual, sem movimentar o Financeiro. |
| Rateios | Geração mensal de versão auditável. |
| Custos apurados | Consulta/materialização de produção, lote e venda. |
| Simular preço | Comparação transparente entre markup e margem sobre o preço. |

A tela informa expressamente que a margem comercial existente continua distinta da margem gerencial calculada a partir de custo. Ela não usa nem modifica o relatório comercial anterior.

## Limitações conscientes e inconsistências conhecidas

Durante a auditoria prévia foram identificadas toras consumidas sem origem/custo e ausência de lançamentos de diesel/abastecimento. Esses fatos continuam visíveis como cobertura parcial ou custo não determinado. Não foram convertidos em custo por média. Também permanecem fora do escopo desta etapa a contabilidade industrial completa, bloqueio automático de vendas, previsão de preço, sugestão de compra e alterações automáticas de preço.

O módulo inicia vazio por segurança. Centros, categorias, lançamentos e rateios devem ser cadastrados ou gerados de maneira explícita por perfil autorizado antes da materialização de novos custos.

## Arquivos principais

| Arquivo | Responsabilidade |
|---|---|
| `server/custos-gerenciais.logic.ts` | Fórmulas puras de cobertura, lançamento, rateio, margem e preço. |
| `server/repositories/custosGerenciais.ts` | Persistência, consultas em lote, versionamento e materialização. |
| `server/routers/custosGerenciais.ts` | Contratos tRPC protegidos por permissão financeira/administrativa. |
| `client/src/pages/RentabilidadeMadeiraPage.tsx` | Operação, visualização e simulação. |
| `drizzle/schema.ts` | Modelo físico das entidades gerenciais. |
| `drizzle/0066_premium_darkstar.sql` a `0069_sturdy_electro.sql` | Evolução não destrutiva do banco. |
| `server/custos-gerenciais.logic.test.ts` | Regressões das fórmulas e das coberturas. |
| `server/routers/custosGerenciais.test.ts` | Regressões de contratos, permissões e simulação. |
