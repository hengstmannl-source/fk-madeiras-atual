# FINANCEIRO V2 — Etapa 5: Matriz de Conformidade Revisada

## Objetivo da revisão

Esta revisão confronta a especificação reenviada em `pasted_content_20.txt` com a versão publicada da Etapa 5. A análise preserva o princípio de que Contas a Pagar e Contas a Receber são somente visões operacionais de `titulosFinanceiros`, `baixasFinanceiras` e dados de apoio existentes; nenhuma tabela, motor ou automatização paralela foi proposta.

## Itens confirmados

| Requisito | Estado | Evidência na implementação |
|---|---:|---|
| Saldo aberto único, derivado de baixas válidas | Conforme | `server/contas-operacionais.logic.ts` e `server/repositories/financeiro.ts` reconstrõem o saldo e excluem títulos quitados ou cancelados. |
| Abertos, parciais, vencidos e vence hoje | Conforme | A consulta operacional aplica as classificações de vencimento e a interface as exibe em cards, aging e lista. |
| Filtros por descrição, valor, vencimento, cliente, fornecedor, categoria, origem e conta de baixa | Conforme | A tela combina filtros financeiros e operacionais no mesmo contrato `contasOperacionais.list`. |
| Lista, aging e cards com o mesmo conjunto filtrado | Conforme | A consulta agregada produz os resumos e itens com a mesma normalização de saldo e filtros. |
| Detalhe com vencimento, competência, parcela, valores, baixas e conciliação | Conforme | O diálogo operacional apresenta o título, as baixas e o atalho à conciliação quando houver baixa conciliada. |
| Fluxo de Caixa separado da gestão de títulos | Conforme | O atalho envia a data de vencimento ao Fluxo de Caixa, sem transformar títulos em baixas ou movimentações realizadas. |

## Lacunas confirmadas na auditoria inicial

| Lacuna | Impacto operacional | Correção delimitada |
|---|---|---|
| Os cards ainda não incluem **Total a vencer**, **Próximos 30 dias** e **% vencido**. | Reduz a leitura imediata da concentração de atrasos e do curto prazo. | Derivar os três indicadores da mesma lista normalizada e tornar os valores clicáveis. |
| A concentração Top 5 é informativa, mas não permite abrir a fila daquela contraparte. | O usuário não chega diretamente aos títulos de um cliente ou fornecedor a partir do agrupamento. | Tornar cada grupo clicável e aplicar o filtro de contraparte já suportado. |
| A prioridade visual trata toda pendência vencida em um único nível. | Não evidencia atrasos críticos de 31–60, 61–90 e acima de 90 dias. | Refinar a prioridade determinística com base no aging, sem alterar o estado financeiro do título. |
| A cobertura automatizada não prova todas as fronteiras e integrações pedidas. | A regra funciona, mas faltam evidências explícitas para bordas do aging, parcelamento, baixa, estorno, conciliação e origens. | Adicionar regressões puras, de repositório e de interface, mantendo o motor financeiro existente. |

## Correções aplicadas

| Ajuste | Resultado preservado |
|---|---|
| Indicadores adicionais | **Total a vencer**, **Próximos 30 dias** e **% vencido** passaram a ser derivados do mesmo conjunto normalizado da fila e permitem abrir o recorte correspondente. |
| Prioridade por aging | A prioridade agora distingue atraso de 1–7, 8–30, 31–60, 61–90 e acima de 90 dias, sem alterar saldo, estado financeiro ou vencimento do título. |
| Concentração rastreável | Os grupos passam a expor o identificador da contraparte e aplicam o filtro de cliente ou fornecedor compatível com a fila em aberto. |
| Regressões | Foram ampliadas as coberturas da lógica, da consulta agregada e da tela para indicadores, prioridades e drill-down. O ciclo central de baixa, estorno e conciliação continua sendo a fonte de verdade. |

## Limites preservados

Não serão adicionados DSO, DPO, cobrança automática, mensagens, boleto, PIX de cobrança, negativação, análise de crédito, previsão probabilística ou outro mecanismo fora da camada operacional de visualização e ação manual.

## Verificação visual da revisão

Em desktop, na rota `/financeiro?aba=receber`, os sete indicadores mantêm a mesma grade, a seção de filtros permanece separada do aging e a fila usa a largura disponível. A concentração aparece após a lista e cada linha continua acionável para aplicar o filtro da contraparte correspondente. Não foi observada rolagem horizontal no painel operacional.

Em largura móvel de 375 px, os indicadores, filtros, aging, fila e concentração passam a uma única coluna. Os controles preservam a sequência de leitura e não há corte horizontal; a tabela mantém as colunas essenciais em escala compacta.

## Validação técnica

Em 26/08/2026, `pnpm check`, `pnpm test` e `pnpm build` foram concluídos com êxito. A suíte integral aprovou **68 arquivos e 351 testes**. O build emite apenas o aviso não bloqueante já conhecido sobre o tamanho de bundles do Vite; não há erro de compilação ou de tipagem.
