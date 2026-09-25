# FINANCEIRO V2 — Etapa 6E

## Diagnóstico das fontes de custo e proposta de integração à Rentabilidade da Madeira

**Data da auditoria:** 27/08/2026  
**Autor:** Manus AI  
**Estado:** diagnóstico concluído; **nenhuma integração foi implementada**.

> **Regra central:** a Rentabilidade da Madeira deve consumir uma única fonte econômica por evento. A classificação gerencial indica como essa fonte participa da análise; ela não cria uma segunda despesa, não duplica título financeiro e não usa a baixa/pagamento como custo.

## 1. Escopo, método e limite desta etapa

Esta Etapa 6E foi conduzida exclusivamente em leitura. Foram revisados o schema, os repositórios e as regras de negócio de diesel, financeiro, vendas, romaneios, plaquetas e RH, além de consultas agregadas na base vigente. Não foram criadas tabelas, migrations, lançamentos, rateios, cálculos de custo, alterações em documentos operacionais ou mudanças de interface.

As conclusões abaixo distinguem o **evento econômico original** de seus reflexos financeiros. Em particular, `titulosFinanceiros`, `baixasFinanceiras`, conciliação e transferências pertencem ao controle de caixa, obrigação ou recebimento; eles não passam automaticamente a ser custos da madeira. Esta separação segue a diretriz formal da Etapa 6E e a arquitetura já entregue na Etapa 6. [1] [2]

| Procedimento aplicado | Resultado | Limite assumido |
|---|---|---|
| Leitura de schema e regras de negócio | Identificadas as chaves, datas e relações de cada fonte | A existência de campo não foi interpretada como autorização automática de custo |
| Consulta agregada de dados atuais | Confirmada a utilização real das principais fontes e exceções de vínculo | Os números são uma fotografia da base em 27/08/2026 e não representam recálculo histórico |
| Comparação entre evento e título derivado | Identificados riscos de dupla apropriação | Nenhuma inconsistência foi corrigida nesta etapa, por proibição expressa |
| Revisão da camada gerencial existente | Confirmada a preservação de centros, categorias, lançamentos, rateios e cálculos | A estrutura atual não foi preenchida, alterada ou automatizada |

## 2. Resumo executivo

A cadeia de **matéria-prima e frete de entrada** é a fonte mais madura para rentabilidade: o romaneio de carga registra frete por m³ e total, e a plaqueta preserva o custo físico rastreável até a produção. O título financeiro do romaneio é um reflexo da obrigação de pagamento e não deve ser somado a esse custo. [3] [4]

Para **diesel**, a regra já está tecnicamente definida: a nota abastece o estoque do tanque e pode gerar um lembrete financeiro; o custo operacional nasce somente quando ocorre o abastecimento, pelo custo médio móvel. Portanto, a nota e seu título derivado nunca devem ser apropriados junto do abastecimento. [5] [6]

Vendas possuem frete, comissão e taxas explicitamente registrados. A comissão é a fonte comercial mais apta a uma futura apropriação direta, mas apenas se for positiva e se uma categoria gerencial autorizar expressamente `incluirComissaoVendaAutomatica`. Frete comercial e taxas ainda exigem decisão de negócio sobre quem suporta o valor, porque os campos da venda também podem compor o acerto cobrado do cliente. [7] [8]

Existem estruturas de RH para estimativa gerencial, competências e folha materializada, mas não há colaboradores, itens de folha, custos recorrentes ativos ou salários estimados materializados na base atual. Consequentemente, **não existe hoje custo salarial de produção disponível para integração automática**. O simples cadastro futuro de funcionário também não será, por si só, um custo salarial disponível. [9] [10]

Não foram encontrados módulos ou categorias financeiras estruturadas especificamente para manutenção, energia, contabilidade, aluguel, telefone, internet ou outros gastos administrativos. Para esses grupos, a conclusão atual é: **não existe fonte estruturada disponível atualmente**. Títulos manuais poderão ser considerados no futuro somente após classificação explícita e identificação estável do evento, jamais por inferência de texto.

## 3. Fotografia da base auditada

Os totais seguintes têm finalidade diagnóstica. Eles não foram escritos de volta no sistema, não foram usados para recalcular rentabilidade e não substituem o relatório financeiro operacional.

| Área | Evidência atual | Leitura para a Etapa 6E |
|---|---:|---|
| Romaneios de carga | 16 romaneios; 558,025 m³; R$ 18.751,81 de frete; 13 com frete por m³ | Fonte física de compra e frete de entrada existe e possui datas de carga/vencimento |
| Plaquetas | 527 plaquetas; 570,886 m³ iniciais; R$ 387.090,15 de valor total; 511 ligadas a carga; 213 consumidas | Há rastreabilidade física suficiente para custo de matéria-prima, com entradas também fora de romaneio de carga |
| Títulos de romaneio de carga | 17 títulos; R$ 407.995,85; 16 romaneios apontam para título | Há um título de `romaneio_carga` sem vínculo atual com romaneio; não deve ser usado como custo automático |
| Notas e abastecimentos de diesel | 0 notas; 0 abastecimentos | Não há custo de diesel operacional disponível no recorte atual |
| Título de nota de diesel | 1 título de `nota_diesel`; R$ 64.700,00; sem nota atual | É documento financeiro derivado/orfão na fotografia atual; deve ficar excluído de custo automático |
| Vendas | 5 aprovadas, R$ 120.432,82 e 53,207 m³; 1 enviada, R$ 150,00 e 0,100 m³ | A venda mantém fontes comerciais explícitas e competência própria |
| Frete, comissão e taxas em vendas aprovadas | Frete/abatimento R$ 18.022,50; comissão R$ 6.157,82; 2 taxas adicionais somando R$ 1.998,24 | Valores existem, mas frete/taxa ainda precisam de regra de responsabilidade econômica |
| RH | 0 colaboradores; 0 itens de folha; 0 competências de salário estimado; 1 folha sem itens | Não há custo de pessoal materializado para apropriar no momento |
| Rentabilidade gerencial | 1 centro; 0 categorias, lançamentos, rateios, cálculos ou componentes | A camada deve ser preservada e configurada antes de uma integração futura |

> **Exceção documental observada:** a base possui um título derivado de diesel sem nota atual e um título de romaneio de carga sem vínculo atual com romaneio. Não houve correção, cancelamento ou recálculo. Até revisão operacional específica, ambos devem ficar fora da seleção automática de custos para impedir apropriação sem evento-fonte verificável.

## 4. Mapa de fontes de custo

| Tipo de custo | Fonte atual encontrada | Registro já existe? | Pode alimentar a rentabilidade? | Competência recomendada | Classificação exigida | Risco principal |
|---|---|---|---|---|---|---|
| Diesel | `abastecimentosDiesel.custoTotal`, calculado por custo médio móvel | Estrutura: sim; dados atuais: não | Sim, quando houver abastecimento válido | `dataAbastecimento` | Industrial → Produção → Diesel → estrutural/rateada, salvo vínculo direto futuro | Somar abastecimento com nota e/ou título `nota_diesel` |
| Manutenção | Nenhuma tabela ou categoria específica encontrada | Não | Não automaticamente | Não aplicável | Futuro título/manual explicitamente classificado | Inferir manutenção por descrição, fornecedor ou palavra-chave |
| Salários de produção | Item de folha (`custoEmpresa`) ou salário estimado por competência (`custoMensalEstimado`) | Estrutura: sim; dados atuais: não | Sim, mas escolhendo **uma** modalidade por competência/colaborador | Competência da folha ou competência salarial estimada | Industrial → Produção → Salários; estrutural/rateada | Somar folha, estimativa e títulos derivados da folha |
| Energia | Nenhuma tabela ou categoria específica encontrada | Não | Não automaticamente | Não aplicável | Futuro título/manual explicitamente classificado | Tratar toda despesa financeira como energia/produção |
| Administrativo | Nenhuma fonte estruturada específica encontrada | Não | Não automaticamente | Não aplicável | Comercial/Administrativo → centro e categoria definidos | Incluir custos sem relação operacional verificável |
| Frete de entrada | `romaneiosCargaToras.fretePorMetroCubico`/`frete`, refletido no custo da plaqueta | Sim | Sim; já integra o custo rastreável da matéria-prima | `dataCarga`/entrada física | Custo de matéria-prima direto à carga/plaqueta | Somar também título `romaneio_carga` ou tratar como frete comercial |
| Frete comercial | Campos `frete`, `fretePorTonelada`, `pesoCargaToneladas` e `abatimentoFrete` em `orcamentos` | Sim | Condicional: somente se confirmado que é custo suportado pela empresa | `orcamentos.competencia` | Comercial → Venda → Frete direto | Somar valor da venda e título/custo financeiro referente ao mesmo evento |
| Comissão | `orcamentos.comissaoCalculada`, com tipo e valor explícitos | Sim | Sim, condicional à categoria autorizada e valor positivo | `orcamentos.competencia` | Comercial → Comissão → direto à venda | Confundir taxa, desconto ou campo percentual com comissão econômica |
| Impostos/taxas | `taxaCalculada` legado e `taxasAdicionaisOrcamento.calculado` | Sim | Não automaticamente | Competência da venda, se houver classificação de custo suportado | Categoria identificável, com natureza e responsabilidade econômica | Tratar taxa cobrada do cliente como despesa da empresa |
| Títulos financeiros manuais | `titulosFinanceiros` com origem `manual`, categoria e competência opcionais | Sim | Apenas por seleção/classificação explícita | Competência preenchida e validada; nunca baixa/pagamento | Centro/categoria/natureza/base definidos pelo usuário | Incluir empréstimos, transferências, dívidas, retiradas ou movimentos internos |

## 5. Datas disponíveis e regra de competência

| Fonte | Datas disponíveis | Data proposta para competência | Ajuste manual futuro | Data que não deve definir competência automaticamente |
|---|---|---|---|---|
| Abastecimento de diesel | `dataAbastecimento`, criação do registro | Data do abastecimento | Sim, com justificativa auditável em exceção | Vencimento/pagamento da nota |
| Nota de diesel | `dataNota`, `dataVencimento` | Não é selecionada como custo operacional | Não aplicável enquanto a fonte for o abastecimento | Pagamento do título da nota |
| Romaneio de carga/plaqueta | `dataCarga`, `dataEntrada`, vencimento do romaneio | Entrada física/carga; o custo seguirá o consumo físico já rastreável | Excepcional, preservando memória da origem | Pagamento do título de matéria-prima |
| Venda, comissão e frete comercial | `competencia`, vencimento, criação, pagamento/entrega | `orcamentos.competencia` | Sim, com justificativa e trilha de alteração | Baixa/recebimento da venda |
| Taxas de venda | Datas da venda a que pertencem | Competência da venda, após comprovar que a empresa suporta o valor | Sim, com motivo | Recebimento da venda |
| Folha materializada | `folhasPagamentoRh.competencia`, fechamento e reabertura | Competência da folha | Somente por exceção auditável | Vencimento/pagamento dos títulos de folha |
| Estimativa salarial | Competência salarial materializada | Competência da estimativa | Sim, desde que não concorra com folha efetiva | Data de criação do cálculo |
| Título manual classificado | Emissão, vencimento, competência opcional e baixa | Competência declarada e validada no próprio título/classificação | Obrigatório quando não houver competência de origem | Data de baixa/conciliação |

> **Regra inegociável:** pagamento, baixa financeira, depósito, conciliação ou transferência não serão usados como competência automática de custo. Eles descrevem caixa, não o período econômico do consumo ou serviço.

## 6. Fonte única, chaves de deduplicação e exclusões

Na futura Etapa 6F, cada seleção precisa carregar uma chave estável de origem, uma categoria gerencial e o estado de elegibilidade. A chave não deve ser derivada de descrição livre, fornecedor, valor isolado ou data isolada. A tabela seguinte propõe o identificador conceitual, sem criar qualquer estrutura nesta Etapa 6E.

| Evento econômico | Fonte única futura | Chave de deduplicação proposta | Excluir explicitamente |
|---|---|---|---|
| Consumo de diesel | Abastecimento com custo médio | `diesel:abastecimento:{id}` | Nota de diesel, título `nota_diesel`, baixa e pagamento da nota |
| Matéria-prima e frete de entrada | Plaqueta/carga física que forma o custo rastreável | `plaqueta:{id}:custo-entrada-v1` | Título `romaneio_carga`, baixa, conciliação e segundo frete comercial |
| Comissão da venda | `orcamentos.comissaoCalculada` | `venda:{id}:comissao` | Título/baixa de recebimento, taxa adicional e descontos não identificados como comissão |
| Frete comercial suportado pela empresa | Campo da própria venda **ou** lançamento financeiro direto ligado à venda, nunca ambos | `venda:{id}:frete-comercial` | Frete de entrada, abatimento meramente comercial, título derivado de venda e duplicata de fonte |
| Taxa/imposto suportado pela empresa | Linha de taxa especificamente classificada como custo | `taxa-venda:{id}` | Taxa repassada/cobrada do cliente, título de recebimento e descrição ambígua |
| Folha efetiva | `itensFolhaPagamentoRh.custoEmpresa` | `folha-item:{id}:custo-empresa` | Títulos de salário/encargos, baixas, adiantamento isolado e estimativa concorrente |
| Planejamento de pessoal | `salariosCompetenciasRh.custoMensalEstimado` | `salario-competencia:{id}:estimativa` | Folha efetiva do mesmo colaborador/competência e títulos derivados |
| Despesa manual classificada | Título manual explicitamente classificado, quando não houver fonte operacional | `titulo:{id}:custo-classificado` | Origem derivada, transferência, empréstimo, retirada, dívida e título sem classificação operacional |

As seguintes origens não podem ser inseridas automaticamente na rentabilidade apenas por existirem no Financeiro: `nota_diesel`, `romaneio_carga`, `orcamento`, `folha_pagamento`, `serragem_terceiros`, transferências internas, baixas, conciliações e qualquer título manual sem classificação. Uma venda gera recebível; esse recebível é receita/contas a receber e não é fonte adicional de frete, comissão ou taxa. [11]

## 7. Proposta de arquitetura para aprovação

O desenho futuro deve funcionar como uma leitura com classificação, mantendo os documentos atuais como proprietários de seus dados. A Rentabilidade não deve se tornar uma tabela paralela de despesas.

```text
Fonte original verificável
        ↓
Elegibilidade por regra de fonte única e estado válido
        ↓
Classificação gerencial (estrutura → centro → categoria → natureza → base)
        ↓
Seleção por competência de origem
        ↓
Apropriação direta ou rateio versionado
        ↓
Cálculo auditável por produção, lote ou venda
        ↓
Custo por m³, cobertura e rentabilidade
```

| Camada | Responsabilidade proposta | O que não pode fazer |
|---|---|---|
| Fonte original | Continuar registrando compra, consumo, produção, venda, folha ou título manual | Ser regravada ou ter seus valores recalculados pela rentabilidade |
| Elegibilidade | Verificar origem autorizada, estado válido, competência e chave ainda não usada | Inferir finalidade pela descrição ou selecionar títulos derivados |
| Classificação gerencial | Ligar a fonte ao centro, categoria, natureza e base de apropriação | Criar uma nova despesa, baixa ou conta a pagar/receber |
| Apropriação | Aplicar custo direto ou rateio, mantendo memória/versionamento | Alterar romaneio, plaqueta, venda, título, folha ou estoque |
| Cálculo | Exibir custo, cobertura, componente e preço/margem gerencial | Preencher lacunas com média ou estimativa não autorizada |

A estrutura atual de centros, categorias, lançamentos complementares, rateios e cálculos deve ser mantida. A futura implementação precisará avaliar campos de referência hoje ausentes para fontes como abastecimento e item de folha; isso deve ser tratado apenas após aprovação, em migration separada, com teste de unicidade de origem. O lançamento gerencial complementar continuará reservado para fonte inexistente, provisão escolhida conscientemente ou ajuste auditável, e não para redigitar diesel, frete, folha ou vendas já existentes.

## 8. Decisões pendentes antes da Etapa 6F

| Decisão requerida | Alternativas mapeadas | Recomendação diagnóstica |
|---|---|---|
| Diesel | Nota/título ou abastecimento | Aprovar somente abastecimento como custo operacional |
| Matéria-prima/frete de entrada | Carga/plaqueta ou título financeiro | Manter cadeia física plaqueta/carga; excluir título derivado |
| Pessoal | Folha efetiva ou estimativa de RH | Escolher uma modalidade por colaborador/competência; hoje não há dados para integrar |
| Frete comercial | Campo de venda ou custo financeiro direto identificado | Definir o que é efetivamente suportado pela empresa e eleger uma única fonte por venda |
| Comissão | Manual, todos os campos de venda ou valor explicitamente calculado | Usar somente `comissaoCalculada > 0` com categoria autorizada |
| Taxas/impostos | Todas as taxas ou somente custos suportados pela empresa | Exigir classificação de responsabilidade econômica antes de qualquer automação |
| Manutenção, energia e administrativo | Descrição livre ou título classificado | Não automatizar enquanto não houver categoria/fonte estruturada e autorização explícita |
| Títulos sem fonte atual | Integrar ou manter excluídos | Manter excluídos, incluindo os dois vínculos documentais incompletos identificados |

## 9. Conclusão e bloqueio de implementação

O diagnóstico confirma que a integração deve começar por fontes físicas e explicitamente identificadas, não pelo somatório de contas pagas. A base já suporta rastreabilidade de matéria-prima/frete de entrada e, futuramente, de diesel por abastecimento e de comissão por venda autorizada. RH possui estrutura, mas não custo de pessoal materializado; manutenção, energia e despesas administrativas ainda não têm fonte estruturada para automação.

Nenhuma ação da Etapa 6F será iniciada sem aprovação explícita desta arquitetura, sobretudo das decisões sobre folha versus estimativa, frete comercial, impostos/taxas e classificação de títulos manuais. Até essa aprovação, permanecem proibidos: criar schema/tabelas, gerar vínculos automáticos, preencher centros ou categorias, criar rateios definitivos, recalcular histórico ou alterar qualquer valor operacional e financeiro.

## Referências internas

[1]: ../../upload/pasted_content_25.txt "Especificação FINANCEIRO V2 — Etapa 6E"
[2]: financeiro-etapa-6-implementacao.md "Implementação anterior da Rentabilidade da Madeira"
[3]: ../drizzle/schema.ts "Schema: romaneios de carga, plaquetas e custo gerencial"
[4]: ../server/repositories/custosGerenciais.ts "Repositório da camada de rentabilidade"
[5]: ../server/diesel.logic.ts "Regra de custo médio móvel do diesel"
[6]: ../server/repositories/diesel.ts "Nota de diesel, título derivado e abastecimento"
[7]: ../server/repositories/vendas.ts "Venda, frete, comissão, taxas e recebível derivado"
[8]: ../server/margemVendas.logic.ts "Acerto comercial por venda"
[9]: ../server/rh.gestao.logic.ts "Estimativa gerencial de custo de colaborador"
[10]: ../server/routers/rh.folha.parcelada.ts "Folha materializada e títulos financeiros derivados"
[11]: ../server/repositories/financeiro.ts "Motor canônico de títulos e baixas financeiras"
