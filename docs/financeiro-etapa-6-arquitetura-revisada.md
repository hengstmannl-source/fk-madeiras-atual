# FINANCEIRO V2 — Etapa 6: arquitetura revisada para validação

## Decisão de arquitetura

O módulo será uma **camada gerencial de custo e formação de preço**. Ele lerá a cadeia existente de estoque, produção e vendas, mas manterá seus próprios registros de classificação, competência, base, critério e versão de apropriação. Nenhum romaneio, plaqueta, lote, venda, orçamento, título financeiro, baixa ou movimento de estoque existente será regravado para calcular custos.

O princípio central é que **cada parcela de custo conserva sua identidade**. Matéria-prima rastreável, industrial, administrativa e comercial permanecem separadas até a visualização final. O custo completo e o preço sugerido serão resultados de leitura, nunca valores que substituam preços de estoque, vendas ou tabelas comerciais.

## 1. Estrutura final das entidades

| Entidade proposta | Finalidade | Dados principais |
| --- | --- | --- |
| `centrosCustosGerenciais` | Organiza o custo por área gerencial. | nome, tipo (`producao`, `administracao`, `comercial`), ativo, ordem, observação. |
| `categoriasCustosGerenciais` | Define a natureza e a forma de apropriação de cada custo. | centro, nome, base de apropriação, critério, modo (`rateado`, `direto_venda`, `percentual_receita`), ativo. |
| `lancamentosCustosGerenciais` | Registra custo explícito por competência. | categoria, competência, valor, descrição, referência documental opcional, título financeiro opcional, venda/pedido/carga opcional, responsável e estado. |
| `rateiosCustosGerenciais` | Guarda cada versão do cálculo por categoria e competência. | categoria, competência, base adotada, critério, total de custo, total da base, valor unitário/percentual, versão, vigência, usuário e data. |
| `itensRateiosCustosGerenciais` | Mantém a evidência dos lançamentos e alvos considerados pelo rateio. | rateio, lançamento, alvo operacional, valor/base considerada, parcela apropriada. |
| `calculosCustosGerenciais` | Materializa de forma auditável a composição de custo de produção, lote ou venda. | escopo, referência, competência, custo de matéria-prima, industrial, administrativo, comercial, cobertura, versão e status. |
| `componentesCustosGerenciais` | Detalha a composição calculada por centro e categoria sem reduzir tudo a um total. | cálculo, centro, categoria, origem, valor, base, regra e versão de rateio. |

As tabelas novas serão exclusivamente gerenciais e terão `empresaId`, trilha de criação/alteração e índices por competência, categoria, escopo e referência operacional. O desenho não cria estoque paralelo nem move valores para o módulo Financeiro.

## 2. Base e critério de apropriação

A categoria de custo, e não apenas o centro, definirá como seu valor é distribuído. A **base** responde “sobre qual medida o custo será apropriado”; o **critério** responde “como a parcela será aplicada ao alvo”. Ambos ficam congelados no rateio para preservar o histórico mesmo que a categoria seja reconfigurada futuramente.

| Base configurável | Unidade | Aplicação inicial | Critério associado |
| --- | --- | --- | --- |
| `m3_produzido` | m³ de lotes próprios produzidos | Produção e estrutura administrativa | Proporcional ao volume do lote próprio. |
| `m3_vendido` | m³ efetivamente baixado para a venda | Amarração, preparação e alguns custos comerciais | Proporcional ao volume efetivamente baixado. |
| `valor_vendido` | Receita dos itens vendidos | Comissão ou taxa comercial com valor fixo no período | Proporcional ao valor de venda elegível. |
| `quantidade_vendida` | Unidades efetivamente baixadas | Custos comerciais por peça | Proporcional à quantidade. |
| `carga` | Cargas/pedidos elegíveis | Material ou operação por carga | Valor igual ou proporcional por carga. |
| `pedido` | Pedidos/vendas elegíveis | Custo administrativo por pedido | Valor igual ou proporcional por pedido. |
| `percentual_receita` | Percentual de receita | Impostos ou comissão percentual | Cálculo direto sobre a receita da venda. |
| `direto_venda` | Referência de venda/pedido/carga | Frete comercial ou despesa identificada | Valor integral somente no alvo indicado. |

As bases acima serão previstas na arquitetura. A primeira interface pode liberar de imediato `m3_produzido`, `m3_vendido`, `valor_vendido`, `carga`, `pedido`, `percentual_receita` e `direto_venda`; novas bases só serão expostas depois de regra e testes próprios.

## 3. Custo de matéria-prima e aproveitamento

O custo de matéria-prima será reconstruído por rastreabilidade, nunca por média. Para cada plaqueta consumida, a origem será o romaneio de carga e a composição será `compra da tora + frete de entrada`. O custo conhecido do romaneio de produção será a soma do custo das toras consumidas com origem válida.

O denominador será o **volume efetivamente produzido em lotes próprios** no romaneio. Assim, o rendimento influencia naturalmente o custo por m³: mais volume de tora para o mesmo volume serrado eleva o custo da matéria-prima serrada. O aproveitamento permanece como indicador físico da relação entre volume de tora consumida e madeira produzida; não existirá uma linha artificial chamada “custo do aproveitamento”. A configuração já registrada no romaneio sobre incluir aproveitamento no rendimento define se o seu volume compõe a produção elegível.

```text
custo conhecido de toras consumidas + frete de entrada
----------------------------------------------------- = custo de matéria-prima por m³ serrado
volume de lotes próprios efetivamente produzidos
```

Toras sem origem ou valor de origem conhecido não receberão estimativa. Elas permanecerão como **custo não determinado**, com lista dos itens, volume pendente e impacto de cobertura.

## 4. Custos industriais

O centro **Produção** terá inicialmente categorias como Diesel, Manutenção, Salários, Encargos, Energia, Peças, Lubrificantes e Outros. Cada lançamento possuirá competência própria, independentemente de data de pagamento. Uma nota ou abastecimento de diesel, um título financeiro ou outro documento existente pode ser associado como evidência somente quando o usuário o indicar.

A regra inicial para as categorias industriais é `m3_produzido`: o total da categoria na competência dividido pelos m³ de lotes próprios produzidos na mesma competência. Cada lote próprio recebe a parcela proporcional ao seu volume. Produção de terceiros e seus lotes ficam fora do numerador e do denominador desse cálculo.

## 5. Custos administrativos e comerciais

Os custos estruturais do centro **Administração** podem usar `m3_produzido`, por exemplo salários administrativos, contabilidade, aluguel, sistemas e telefone. Essa escolha é configurada por categoria e pode ser alterada para competências futuras, sem reescrever rateios já calculados.

No centro **Comercial**, cada categoria selecionará sua própria base. Uma comissão pode ser `percentual_receita` e chegar diretamente à venda. Uma taxa comercial com valor mensal pode usar `valor_vendido`. Materiais de amarração podem usar `m3_vendido`, `carga` ou `pedido`. O frete comercial/de entrega será sempre separado do frete de entrada e será registrado como `direto_venda` ou apropriado por categoria configurada; nunca integrará o custo da tora.

Impostos serão categorias comerciais configuráveis. Para impostos percentuais, a regra será `valor da receita elegível × percentual registrado`, preservando a composição separada. Para impostos ou taxas de valor fixo, a base poderá ser valor vendido, volume vendido, pedido ou carga. Nenhum percentual será inferido de títulos, baixas ou valores financeiros.

## 6. Como o custo chega ao lote e à venda

O cálculo por lote receberá matéria-prima da produção de origem e as parcelas apropriadas de cada categoria com base aplicável. O cálculo guardará componentes separados e referência às versões de rateio utilizadas.

```text
plaqueta → romaneio de carga → custo rastreável da tora
plaqueta consumida → romaneio de produção → lote próprio
categoria/competência → rateio versionado → parcela do lote
lote baixado → item vendido → parcela efetiva da venda
```

Na venda, será utilizada a quantidade realmente baixada em `movimentacoesEstoqueSerrado`, recuperando o lote e suas parcelas calculadas. Se o volume histórico da movimentação estiver zerado, a leitura reconstruirá o volume pela quantidade baixada e pelas medidas do lote; não confiará isoladamente no campo zerado. Custos diretos de venda, impostos percentuais e comissão vinculada à venda serão somados somente àquela venda, sem redistribuição para a produção mensal.

Vendas históricas serão somente lidas. Se o lote, a origem da tora ou uma versão de custo estiver indisponível, a margem será classificada como parcial ou não determinada, sem qualquer correção histórica automática.

## 7. Cobertura de custo

| Indicador | Fórmula e comportamento |
| --- | --- |
| Cobertura física | `m³ de tora consumida com origem conhecida ÷ m³ total de tora consumida`. |
| Cobertura financeira | `custo determinado ÷ custo total conhecido/esperado`, apenas quando existir denominador confiável já registrado. |
| Custo parcial | Há parcela conhecida, porém a origem de uma ou mais toras/lotes está ausente. |
| Custo não determinado | Não há origem suficiente para apurar a parcela de matéria-prima. |

Quando a cobertura financeira não possuir denominador válido, ela não será estimada. A interface mostrará somente cobertura física e a razão da limitação.

## 8. Versionamento e recálculo

Cada execução de rateio criará uma nova versão com competência, categoria, base, critério, total de custo, total da base, valor unitário ou percentual, itens considerados, usuário e data. A versão mais recente aprovada fica vigente; as anteriores continuam consultáveis. Recalcular não apaga a versão anterior nem altera valores de documentos operacionais.

Os cálculos de custo por produção, lote e venda também registrarão quais versões de rateio foram usadas. Alterações de classificação ou lançamento serão sinalizadas como necessidade de recálculo, mas somente a ação administrativa de recálculo produzirá uma nova versão.

## 9. Margem e preço sugerido

O custo completo será uma soma exibida, mas suas parcelas continuarão independentes:

```text
matéria-prima rastreável
+ industrial apropriado
+ administrativo apropriado
+ comercial apropriado
= custo gerencial completo
```

O simulador oferecerá métodos distintos: `markup = custo × (1 + percentual)` e `margem sobre preço = custo ÷ (1 - percentual)`. O resultado será **preço sugerido** com composição, cobertura e método utilizado. Ele não altera cadastro de preço, estoque, orçamento, pedido ou venda existente.

## 10. Pontos definidos e pontos que ainda exigem decisão

| Tema | Estado |
| --- | --- |
| Matéria-prima: compra da tora + frete de entrada | Confirmado. |
| Aproveitamento como indicador físico no rendimento | Confirmado. |
| Industrial inicial por m³ próprio produzido | Confirmado. |
| Produção de terceiros fora da madeira própria | Confirmado. |
| Custo parcial sem estimativa | Confirmado. |
| Rateio versionado e auditável | Confirmado. |
| Markup e margem sobre preço | Confirmado. |
| Categoria com base configurável | Confirmado. |
| Uso de comissão/taxa já registrada na venda | **Decidir:** usar apenas se já estiver explícita como custo, ou exigir lançamento gerencial direto por venda. |
| Frete comercial | **Decidir:** registrar sempre como lançamento direto por venda/pedido ou também liberar rateio por carga/m³ vendido desde a primeira versão. |
| Competência de categorias comerciais por venda | **Decidir:** adotar a competência da venda como padrão inicial para custos diretos e percentuais. |

## Próximo passo bloqueado

Com a aprovação desta arquitetura, o próximo passo será definir o esquema físico das tabelas, gerar migration não destrutiva e construir regras puras. Até a confirmação, não serão criadas tabelas, alterados dados históricos, recalculados custos ou modificadas telas operacionais.
