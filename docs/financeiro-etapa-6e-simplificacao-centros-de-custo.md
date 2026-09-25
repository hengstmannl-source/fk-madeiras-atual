# FINANCEIRO V2 — Etapa 6E

## Diagnóstico da Rentabilidade da Madeira e proposta de simplificação por Centros de Custo

**Data do diagnóstico:** 27/08/2026  
**Estado:** proposta para aprovação; **nenhuma migration, alteração de dado ou modificação funcional foi executada**.

> **Princípio proposto:** um evento econômico deve ter uma única classificação financeira e um único centro de custo. A Rentabilidade da Madeira consulta e interpreta essa classificação; ela não cria um segundo lançamento de despesa.

## 1. Objetivo da revisão

O objetivo desta revisão é transformar a Rentabilidade da Madeira em uma área de **cálculo e análise**, e não em um segundo módulo de lançamento de custos. A classificação central passa a ser: lançamento financeiro, categoria financeira, centro de custo e tipo do centro. A partir desses elementos, a rentabilidade deverá apresentar custos industriais, comerciais/administrativos, matéria-prima, produção própria e custo por metro cúbico.

O diagnóstico preserva uma ressalva essencial já validada no funcionamento da empresa: título financeiro, pagamento e baixa não são automaticamente o mesmo que o consumo econômico. Há fontes operacionais específicas — especialmente consumo de diesel e custo físico de matéria-prima — cuja duplicação com títulos derivados precisa continuar bloqueada. Portanto, a centralização financeira deve ser implantada com regras explícitas de elegibilidade por origem, e não por simples soma de todas as contas a pagar. [1] [2]

## 2. Diagnóstico da arquitetura atual

A implementação vigente criou uma camada gerencial própria, paralela ao Financeiro. Ela foi concebida para registrar custos por competência, configurar categorias e bases de rateio, gerar rateios mensais e materializar cálculos versionados por produção, lote e venda. Esses recursos são auditáveis, mas exigem que o usuário mantenha estruturas e lançamentos adicionais para uma despesa que, em muitos casos, já existe no Financeiro. [3] [4]

| Elemento atual | Finalidade atual | Problema perante a nova diretriz | Situação na base em 27/08/2026 |
|---|---|---|---|
| `centrosCustosGerenciais` | Separar industrial de comercial/administrativo | O campo `codigo` é um enum com somente dois valores e permite apenas um centro de cada tipo; não comporta Produção, Serraria, Frota, Administração etc. | 1 registro |
| `categoriasCustosGerenciais` | Recriar categoria, natureza, base e vínculo opcional à categoria financeira | Duplica a função de `categoriasFinanceiras` e concentra configurações que não são necessárias na primeira versão simplificada | 0 registros |
| `lancamentosCustosGerenciais` | Registrar uma nova despesa por competência, manual ou referenciada | Cria possibilidade de lançar na rentabilidade um custo já registrado no Financeiro | 0 registros |
| `rateiosCustosGerenciais` | Versionar o rateio mensal de custos | É útil como memória de cálculo, mas depende da categoria e do lançamento paralelo | 0 registros |
| `itensRateiosCustosGerenciais` | Guardar bases, fatores e memória de cada rateio | É derivado do rateio paralelo e não deve ser novo ponto de entrada operacional | 0 registros |
| `calculosCustosGerenciais` | Materializar versão de custo por romaneio, lote ou venda | Pode preservar auditoria histórica, porém a nova visão deverá calcular diretamente a partir da classificação financeira | 0 registros |
| `componentesCalculosCustosGerenciais` | Registrar as parcelas usadas em cada cálculo materializado | É histórico derivado, não uma fonte econômica primária | 0 registros |

Não há custos, categorias, rateios ou cálculos materializados na camada gerencial a serem convertidos neste momento. O único registro é um centro gerencial. Isso reduz o risco de migração, mas **não autoriza apagar a estrutura atual**: tabelas e código devem permanecer íntegros até a nova leitura financeira estar validada e até existir uma decisão formal sobre retenção histórica. [5]

### 2.1 Fluxos atuais que comprovam a duplicidade

A página atual de Rentabilidade expõe seis abas: Visão gerencial, Centros e categorias, Lançamentos, Rateios, Custos apurados e Simular preço. As abas de configuração, lançamentos e rateios permitem registrar e classificar valores fora do Financeiro; além disso, a tela oferece autorização genérica para comissão automática. Esse desenho é o principal ponto a simplificar. [6]

No backend, a categoria gerencial possui centro próprio, categoria financeira opcional, natureza (`estrutural` ou `direto_venda`), base de apropriação e indicador de comissão automática. Um lançamento gerencial pode referenciar título, venda, carga, produção, lote ou nota de diesel, mas continua sendo uma nova linha monetária. Em consequência, uma despesa financeira pode aparecer novamente na apuração se não houver disciplina manual rigorosa. [5]

## 3. Situação do Financeiro e pontos seguros de integração

`titulosFinanceiros` é a fonte canônica de contas a pagar e receber. Cada título possui categoria financeira, origem, valor, emissão, vencimento, competência, estado e vínculos para eventos automáticos, mas **não possui atualmente `centroCustoId`**. A categoria existente continua necessária, pois informa o que foi gasto ou recebido; o novo centro deverá informar a área responsável pelo evento. [7]

| Caminho de criação/alteração | Comportamento atual | Mudança necessária em fase posterior |
|---|---|---|
| Lançamento manual | Cria título com tipo, categoria, valor, datas, competência e contraparte | Seleção obrigatória de centro de custo para novos lançamentos |
| Parcelamento | Gera títulos individuais no mesmo grupo de parcelamento | Replicar ou selecionar um centro único para todas as parcelas |
| Edição individual e em lote | Atualiza dados financeiros preservando o ciclo de baixas | Permitir classificar ou corrigir centro sem tocar em baixas/conciliação |
| Importação CSV | Importa lançamentos e protege chaves de importação | Acrescentar coluna de centro e uma etapa de validação; não inferir centro por texto ou categoria |
| Recorrência financeira | Gera títulos futuros a partir do cadastro recorrente | Guardar o centro no cadastro recorrente e propagá-lo ao título gerado |
| Conciliação com criação de título | Pode criar título explícito a partir de movimento bancário | Exigir a escolha de centro no momento de criar a conta financeira correspondente |
| Origem automática | Romaneio de carga, nota de diesel, venda, serragem e folha criam títulos idempotentes | Receber centro explícito da operação de origem ou aplicar regra de origem aprovada; nunca adivinhar |

Os mecanismos de idempotência, importação, recorrência, conciliação, baixa, estorno e edição já protegem o ciclo financeiro. O novo vínculo deve atravessar todos esses caminhos sem alterar `valorBaixado`, estado, conciliação, pagamento, anexos ou o identificador de origem. [7]

### 3.1 Fotografia atual de títulos e competência

| Origem | Tipo | Categoria financeira | Quantidade | Valor original | Sem competência | Leitura para a nova arquitetura |
|---|---|---|---:|---:|---:|---|
| `orcamento` | Receber | Receitas de vendas | 19 | R$ 240.909,97 | 2 | Pode receber centro comercial, mas títulos a receber não devem compor custo |
| `romaneio_carga` | Pagar | Custo de matéria-prima | 17 | R$ 407.995,85 | 0 | É relevante para o custo de compra; requer regra de fonte única diante da cadeia de plaquetas/carga |
| `nota_diesel` | Pagar | Pagamento de nota de diesel | 1 | R$ 64.700,00 | 0 | Não pode virar custo operacional automaticamente, pois a regra vigente reconhece diesel no abastecimento |
| `serragem_terceiros` | Receber | Serviço de serragem | 11 | R$ 28.090,39 | 0 | É receita de serviço e não custo da madeira própria |
| `manual` | Receber | Receitas de vendas | 2 | R$ 65.000,00 | 2 | Deve permanecer fora de custos; classificação histórica não pode ser presumida |
| `manual` | Receber | Venda Cavaco | 2 | R$ 330.000,00 | 2 | Deve permanecer fora de custos; classificação histórica não pode ser presumida |

Há títulos cancelados em algumas dessas origens; a futura consulta de rentabilidade deverá excluir títulos cancelados. Para custos por competência, a base proposta é o valor econômico do título na competência definida, e não `valorBaixado` nem a data de baixa. A regra exata para desconto e juros deverá ser validada antes de implementação, evitando que a rentabilidade varie apenas porque um pagamento foi realizado ou conciliado em data posterior. [7]

## 4. Proposta de modelo-alvo

A proposta adota o Centro de Custo como classificação comum do Financeiro e elimina a necessidade de configurar uma categoria paralela de rentabilidade. O tipo pertence ao centro e determina a elegibilidade geral. A categoria financeira permanece como classificação contábil/operacional do lançamento.

```text
Evento econômico / lançamento financeiro
        ↓
Categoria financeira: o que foi gasto ou recebido
        ↓
Centro de custo: em que área o evento pertence
        ↓
Tipo do centro: Industrial | Comercial/Administrativo | Não apropriável
        ↓
Rentabilidade: filtra por competência e interpreta o custo elegível
```

| Tipo de centro | Finalidade | Tratamento na Rentabilidade | Exemplos de centros |
|---|---|---|---|
| **Industrial** | Custos ligados à produção de madeira | Participa do custo industrial do período e do custo industrial por m³ próprio produzido | Produção, Serraria, Manutenção Industrial, Frota de Produção |
| **Comercial/Administrativo** | Estrutura comercial e administrativa que deve ser analisada na madeira | Participa da segunda camada de custos, exibida separadamente até que a metodologia detalhada de alocação seja aprovada | Administração, Comercial, Expedição, Vendas |
| **Não apropriável à madeira** | Eventos financeiros sem relação com custo da madeira | Fica visível no Financeiro e Fluxo de Caixa, mas é excluído integralmente da Rentabilidade | Financeiro, Investimentos, Empréstimos, Transferências internas, Retiradas |

O centro deverá possuir **nome, tipo, situação ativo/inativo e observações opcionais**. O centro inativo não poderá ser escolhido em novos lançamentos, mas continuará exibido em títulos históricos para preservar a classificação que existia na época.

## 5. Como adaptar a estrutura existente com segurança

A tabela `centrosCustosGerenciais` pode ser adaptada e passar a ser tratada na interface como **Centros de Custo**, sem renomear fisicamente a tabela na primeira migration. Essa escolha evita um rename desnecessário, preserva o registro existente e reduz impactos nos repositórios. O sufixo técnico `Gerenciais` pode ser removido da linguagem da interface e da documentação operacional; uma mudança de nome físico só deve ser considerada depois de a nova operação estar estável.

| Estrutura atual | Estratégia proposta | Motivo | Ação sobre dados existentes |
|---|---|---|---|
| `centrosCustosGerenciais` | **Adaptar e reutilizar** | Já é a entidade adequada para centro de custo | Preservar todos os IDs; derivar o novo tipo a partir do código atual quando possível |
| `categoriasCustosGerenciais` | **Deixar de utilizar para novos fluxos** | A categoria financeira já responde “o que foi gasto” | Manter tabela e dados legados intactos; remover da operação principal |
| `lancamentosCustosGerenciais` | **Descontinuar como entrada operacional** | Evita lançamento de custo duplicado | Manter somente leitura/histórico; não criar novos registros pela nova interface |
| `rateiosCustosGerenciais` | **Não gerar novos rateios na primeira versão** | A prioridade é competência + centro + tipo, sem natureza/base obrigatória | Preservar versões antigas para auditoria |
| `itensRateiosCustosGerenciais` | **Preservar como histórico derivado** | Depende de rateios existentes | Sem migração ou exclusão |
| `calculosCustosGerenciais` | **Preservar como histórico, fora da operação principal** | Pode conter memória auditável caso exista no futuro | Sem migração ou exclusão |
| `componentesCalculosCustosGerenciais` | **Preservar como histórico derivado** | É dependente de cálculo materializado | Sem migração ou exclusão |

O `codigo` atual do centro é limitado a `industrial` e `comercial_administrativo`, com unicidade por empresa. Esse modelo impede que se cadastrem vários centros do mesmo tipo. A migration futura deverá substituir o enum limitado por um código de texto estável — se ele continuar necessário — e introduzir um campo `tipo` com os três valores propostos. O centro existente será mantido; não haverá exclusão, recriação silenciosa ou troca de identificador. [5]

## 6. Onde incluir `centroCustoId` e quais dados complementares devem acompanhar

O vínculo principal deverá ser inserido em `titulosFinanceiros`, como `centroCustoId` inicialmente anulável. A nulidade é necessária para preservar títulos históricos sem classificação e para impedir uma classificação artificial. A interface exibirá esses títulos como **Centro de Custo: Não informado**, sem criar um centro fictício e sem atribuir-lhes indevidamente o tipo “Não apropriável”. [7]

| Objeto | Campo/alteração futura | Regra de preservação |
|---|---|---|
| `titulosFinanceiros` | Adicionar `centroCustoId` anulável e índice por empresa, centro, competência, tipo e estado | Nenhum título histórico será preenchido automaticamente |
| `centrosCustosGerenciais` | Evoluir para nome, tipo, ativo/inativo, observações e código livre opcional | O ID atual será preservado; o tipo inicial será derivado somente do código já existente |
| `recorrenciasFinanceiras` | Adicionar `centroCustoId` para que novas ocorrências herdem a classificação | Recorrências existentes ficam sem centro até revisão humana |
| Contratos tRPC e formulários financeiros | Incluir centro em criação, edição, lote, parcelamento e importação | A validação aceitará histórico sem centro, mas bloqueará classificação inválida/inativa em novos fluxos |
| Operações automáticas de domínio | Receber centro explicitamente definido na operação que origina o título, quando aplicável | Não utilizar texto do título, fornecedor ou categoria como regra implícita |

O índice de consulta precisa privilegiar a leitura analítica por competência. A forma exata será definida durante a migration, mas deve permitir filtrar títulos por `empresaId`, `centroCustoId`, `competencia`, `tipo` e `estado` sem impactar os índices já usados por importação, origem, parcelamento ou conciliação.

## 7. Regra de competência e tratamento dos históricos

O campo `titulosFinanceiros.competencia` é a referência prioritária da rentabilidade. A data de vencimento ajuda a gerir contas; a baixa, conciliação e pagamento informam caixa. Nenhuma delas deverá substituir automaticamente a competência econômica. [7]

| Situação | Exibição no Financeiro | Tratamento na Rentabilidade |
|---|---|---|
| Título histórico sem centro | Etiqueta “Centro não informado” e filtro específico | Excluído dos custos apropriados; aparece no alerta de custo não classificado |
| Título histórico sem competência | Etiqueta “Competência não informada” | Excluído do período até ajuste explícito e auditável |
| Título futuro/manual sem centro | Formulário deverá exigir centro ativo | Não poderá ser criado sem classificação após a entrada em vigor da regra |
| Título recorrente sem centro | Cadastro recorrente deverá exigir centro antes de novas gerações | Ocorrências antigas permanecem inalteradas |
| Título derivado automaticamente | Operação de origem deverá informar centro ou seguir regra específica aprovada | Não deve ser classificado por suposição |
| Título cancelado | Permanece no histórico financeiro | Não entra em custo do período |

O tratamento “Não informado” é uma condição de qualidade de dados, não uma categoria financeira e não um centro econômico. A nova rentabilidade deverá informar a quantidade e o valor sem classificação, para que o usuário consiga decidir se deseja revisar o histórico. Nenhum centro será preenchido com base em fornecedor, descrição, valor, data ou texto semelhante.

## 8. Elegibilidade e prevenção de dupla apropriação

O filtro por centro não é suficiente para garantir custo correto. A origem do título precisa ser considerada antes da soma, sobretudo onde já há uma fonte física de custo. A proposta mantém o princípio de **uma fonte econômica por evento**, sem criar lançamentos gerenciais duplicados. [1]

| Evento ou origem | Fonte recomendada para a futura análise | Regra de exclusão/deduplicação | Decisão necessária |
|---|---|---|---|
| Compra de matéria-prima / frete de entrada | Título `romaneio_carga` ligado à compra, com exibição separada como matéria-prima, ou a cadeia física já rastreada — nunca ambas | Chave do romaneio/carga e validação de que o mesmo custo não foi considerado pela plaqueta | Confirmar qual das duas leituras será a fonte monetária definitiva |
| Nota de diesel | Não tratar o título `nota_diesel` como custo operacional enquanto ele for apenas lembrete de pagamento | Excluir nota e baixa; não somar compra do tanque com abastecimento | Manter a regra vigente de custo por abastecimento ou redefinir formalmente a política de estoque de diesel |
| Abastecimento de diesel | Registro operacional de abastecimento pelo custo médio móvel | Jamais somar ao título da nota de diesel | Definir como o centro será informado no abastecimento sem criar título a pagar duplicado |
| Folha de pagamento | Folha materializada ou estimativa de RH por competência, jamais título derivado e folha ao mesmo tempo | Uma única fonte por colaborador/competência | Definir se a primeira fase usa folha efetiva, estimativa ou fica fora até haver dados consistentes |
| Comissão de venda | Regra específica futura, vinculada à venda e à comissão calculada | Não habilitar por checkbox genérico de categoria; não somar título/recebimento de venda | Postergar para módulo de rentabilidade por venda, conforme o documento da etapa |
| Frete comercial e taxas | Somente valor comprovadamente suportado pela empresa, com fonte identificada | Não confundir abatimento/repasses ao cliente com despesa própria | Definir metodologia em etapa posterior |
| Empréstimos, transferências, retiradas, investimentos | Título financeiro classificado em centro Não apropriável | Excluir sempre da rentabilidade | Configurar centros e categorias com orientação ao usuário |

> **Ponto de atenção obrigatório:** o pedido de centralizar no Financeiro é compatível com custos gerais de competência, mas não pode revogar silenciosamente a regra já existente de diesel. Hoje a nota de diesel gera obrigação financeira e o custo operacional surge no abastecimento. Fazer a rentabilidade somar todo título industrial sem essa exceção produziria custo em duplicidade ou custo antes do consumo. [2]

## 9. Cálculos propostos para a primeira versão simplificada

Na primeira versão, a prioridade não é atribuir custo direto a cada venda, carga ou pedido. A prioridade é entregar um custo de período transparente, com centros e categorias financeiras identificáveis.

| Indicador | Fórmula proposta | Fonte e filtro |
|---|---|---|
| Total de custos industriais | Soma de títulos econômicos elegíveis por competência | `tipo = pagar`, centro `Industrial`, competência do mês, estado diferente de cancelado e regra de origem válida |
| Produção própria do período | Soma de m³ de lotes próprios confirmados na produção | Cadeia de produção existente, sem alterar estoque ou romaneios |
| Custo industrial por m³ | Total de custos industriais ÷ m³ próprios produzidos | Exibir “não determinado” se não houver produção própria válida |
| Total comercial/administrativo | Soma dos títulos econômicos elegíveis por competência | `tipo = pagar`, centro `Comercial/Administrativo`, competência do mês, estado diferente de cancelado |
| Custo comercial/administrativo por m³ | Total comercial/administrativo ÷ m³ próprios produzidos | Exibir em camada separada, sem atribuição direta por venda nesta fase |
| Matéria-prima | Componente separado por fonte única aprovada | Exibir categoria/origem e bloquear duplicidade com plaquetas/cargas |
| Custo não classificado | Soma de títulos potencialmente relevantes sem centro ou competência | Exibir como alerta; nunca misturar aos custos apropriados |

Os títulos de tipo `receber` não compõem custo apenas por pertencerem a um centro comercial. Eles podem usar centro para fins de organização e análise financeira, mas a rentabilidade de custos deve somar eventos de despesa (`pagar`) elegíveis. A receita continuará visível nos módulos de Vendas, Financeiro e Acerto Comercial, sem contaminar o cálculo de custo por m³. [7]

## 10. Mudanças previstas no frontend

| Área | Alteração prevista após aprovação | Elementos que deixam de ser ponto de entrada |
|---|---|---|
| Financeiro — título novo/edição | Campo pesquisável **Centro de Custo**, com nome, tipo e situação visíveis; aviso para centro inativo | Nenhuma nova aba paralela de despesa na rentabilidade |
| Financeiro — edição em lote | Ação explícita para classificar centros de títulos selecionados, sem alterar valores, baixas ou conciliações | Classificação automática por descrição, fornecedor ou categoria |
| Financeiro — importação | Coluna e validação de centro; prévia de linhas sem classificação antes da confirmação | Importação que silenciosamente atribua um centro |
| Financeiro — recorrências | Campo de centro no cadastro e exibição do centro herdado nas ocorrências | Recorrência que gere novo título sem regra de centro definida |
| Operações de origem | Campo/seleção de centro quando a origem efetivamente precisar propagá-lo ao título | Regra automática oculta baseada em texto |
| Rentabilidade da Madeira | Painel por competência com custos por tipo, centro, categoria financeira, matéria-prima, produção, m³ e custo por m³ | Abas “Lançamentos”, “Rateios” e “Centros e categorias” como lançadores de nova despesa |
| Rentabilidade — comissão | Não haverá checkbox genérico de autorização de comissão | Configuração de comissão para diesel, energia, manutenção ou centros genéricos |
| Histórico de rentabilidade | Área secundária/read-only para antigas versões materializadas, se existirem | Exclusão silenciosa de cálculos e componentes históricos |

A aba Simular preço pode ser preservada como ferramenta auxiliar, desde que receba o custo por m³ calculado pela visão simplificada e não crie lançamentos. A definição de comissão por venda, frete específico e custo diretamente vinculado a pedido permanece deliberadamente fora desta primeira versão, conforme o escopo recebido. [1]

## 11. Mudanças previstas no backend

| Camada | Alteração prevista após aprovação | Salvaguarda |
|---|---|---|
| Schema | Migration não destrutiva para adaptar centros e incluir `centroCustoId` nos títulos e recorrências | Coluna inicialmente anulável; nenhum preenchimento histórico automático |
| Repositório financeiro | Propagar/validar centro nos caminhos manual, parcelado, lote, importação, recorrência, conciliação e automático | Manter o repositório financeiro como único escritor de `titulosFinanceiros` |
| Contratos tRPC | Incluir centro nos inputs e respostas necessárias | Validar existência, empresa correta e situação ativa para novos usos |
| Consulta de rentabilidade | Nova leitura por competência, tipo do centro, categoria e origem elegível | Não gravar novo lançamento/cálculo apenas para exibir o painel |
| Regras de origem | Aplicar lista explícita de fontes elegíveis e chaves de deduplicação | Não decidir por descrição livre, pagamento ou baixa |
| Camada gerencial antiga | Tornar criação/despesa/rateio indisponível para o novo fluxo; manter leitura de legado | Nenhuma remoção física nesta fase |
| Testes | Cobrir ausência de centro histórico, centro inativo, importação, recorrência, idempotência, origem automática, exclusões e cálculo por competência | Executar regressões financeiras completas antes de publicar |

O processo de implementação deverá iniciar pelo schema e pelas regras de integridade, antes de alterar formulários. Depois, serão adaptados os caminhos de criação financeira e, por fim, a leitura da Rentabilidade. Essa ordem reduz o risco de uma interface apresentar campos que o backend ainda não preserva. [7]

## 12. Estratégia de migração e preservação de dados

| Etapa futura | Ação | O que permanece protegido |
|---|---|---|
| 1. Backup lógico e auditoria prévia | Levantar IDs, origens, centros e títulos sem classificação antes da migration | Possibilidade de conferir o antes/depois sem modificar valores |
| 2. Migration aditiva | Adicionar campos e índices; adaptar capacidade dos centros sem remover tabelas | IDs, categorias financeiras, títulos, baixas, importações e recorrências existentes |
| 3. Preservação do centro atual | Manter o único centro existente e converter seu significado para o novo tipo correspondente | Nenhuma recriação de registro ou perda de referência |
| 4. Históricos | Manter `centroCustoId` nulo quando não houver confirmação humana | Sem classificação presumida e sem alteração de competência |
| 5. Novos lançamentos | Exigir centro ativo de forma progressiva em cada entrada financeira | Fluxos automáticos somente entram após terem fonte de centro aprovada |
| 6. Interface | Ocultar/remover os lançadores paralelos da navegação operacional e exibir o painel simplificado | Histórico de custo gerencial somente leitura, se necessário |
| 7. Validação | Executar testes, auditoria por origem e revisão visual antes do checkpoint | Sem recalcular históricos nem alterar estoque, romaneios, vendas ou caixa |

Em nenhum momento será apagada categoria financeira, título, baixa, recorrência, romaneio, plaqueta, venda, folha ou tabela gerencial. A remoção física de tabelas antigas não faz parte desta revisão. Depois de um período de uso e de uma auditoria específica, poderá ser decidido se a estrutura histórica continuará apenas de leitura ou se haverá plano de arquivamento separado.

## 13. Decisões que precisam de aprovação antes de implementar

| Tema | Proposta recomendada | Por que a confirmação é necessária |
|---|---|---|
| Reuso do centro existente | Adaptar `centrosCustosGerenciais` como Centro de Custo, sem rename físico inicial | Evita nova tabela e preserva o único registro atual |
| Tipos de centro | Industrial, Comercial/Administrativo e Não apropriável à madeira | Define a elegibilidade geral da rentabilidade |
| Históricos sem centro | Manter nulos e exibir “Não informado” | Evita inventar classificação e custo histórico |
| Novos títulos | Exigir centro ativo nos fluxos manuais, parcelados, importados e recorrentes | Faz do centro uma classificação central sem reclassificação posterior ambígua |
| Origem automática | Configurar centro explicitamente na operação de origem ou por regra aprovada por origem | Evita inferência por texto e quebra de idempotência |
| Diesel | Manter abastecimento como fonte de custo e excluir a nota/título lembrete da rentabilidade | Preserva o custo médio móvel e evita duplicidade |
| Matéria-prima/frete de entrada | Eleger título de carga ou cadeia física como fonte monetária única | Evita contar a mesma compra na plaqueta e no título |
| Folha | Escolher folha efetiva ou estimativa por competência quando houver dados | Evita somar folha, título e previsão |
| Comissão/frete/taxa de venda | Adiar a apropriação direta para etapa específica de rentabilidade por venda | A regra é específica e não deve aparecer em configurações genéricas |
| Valor econômico do título | Formalizar se a visão usa valor original ou valor original ajustado por desconto/juros | Evita variação de custo por evento de pagamento posterior |

## 14. Conclusão

A simplificação é tecnicamente viável e tem baixo risco de conversão no estado atual, porque as tabelas paralelas estão praticamente vazias. O caminho seguro é adaptar o centro já existente, incorporar `centroCustoId` ao ciclo financeiro inteiro e transformar a Rentabilidade em uma consulta por competência, tipo de centro, centro e categoria financeira.

A implementação não deve começar até que sejam confirmadas as decisões acima, principalmente a exceção de diesel, a fonte única de matéria-prima, o tratamento de folha e a política para títulos automáticos. Essas confirmações garantem que a centralização reduza duplicidade sem fazer a Rentabilidade interpretar lembretes, pagamentos ou documentos derivados como custo econômico.

## Referências internas

[1]: ../../upload/pasted_content_26.txt "Especificação revisada da Etapa 6E: Simplificação da Rentabilidade da Madeira através de Centros de Custo"
[2]: financeiro-etapa-6e-diagnostico-fontes.md "Diagnóstico anterior das fontes econômicas e regra de não duplicidade"
[3]: financeiro-etapa-6-implementacao.md "Documentação da implementação original da Etapa 6"
[4]: ../server/repositories/custosGerenciais.ts "Rotinas de centros, categorias, lançamentos, rateios e cálculos gerenciais"
[5]: ../drizzle/schema.ts "Schema de centros, categorias, lançamentos, rateios e cálculos gerenciais"
[6]: ../client/src/pages/RentabilidadeMadeiraPage.tsx "Interface atual da Rentabilidade da Madeira"
[7]: ../server/repositories/financeiro.ts "Ciclo canônico de títulos, importação, recorrência, conciliação e origens automáticas"
