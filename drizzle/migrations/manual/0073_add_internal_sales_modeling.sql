-- FK Madeiras: preparação aditiva para vendas internas.
-- Referência: 65974e7db30ab06e01f1a0aaabb4d55e31ec98f2.
-- NÃO executar via drizzle-kit migrate nem em produção sem plano, backup e autorização.
-- Este arquivo fica fora do journal histórico porque a cadeia 0000-0072 não está completa
-- no repositório. Tabelas novas herdam charset/collation padrão do schema existente.

-- Os defaults materializam vendas existentes como externas e versão 1, sem reescrever
-- campos comerciais, estados, financeiro ou estoque. INSTANT faz a alteração falhar
-- explicitamente se o servidor não suportar o algoritmo sem cópia da tabela.
ALTER TABLE `orcamentos`
  ADD COLUMN `tipoVenda` enum('externa','interna') NOT NULL DEFAULT 'externa',
  ADD COLUMN `versaoComercial` int NOT NULL DEFAULT 1,
  ADD COLUMN `versaoCalculoComercial` int,
  ALGORITHM=INSTANT;

-- Nulos preservam todos os movimentos existentes fora do modelo de ciclos.
ALTER TABLE `movimentacoesEstoqueSerrado`
  ADD COLUMN `cicloEntregaId` int,
  ADD COLUMN `estornoDeMovimentoId` int,
  ALGORITHM=INSTANT;

-- MySQL/InnoDB permite múltiplos NULL em um índice UNIQUE: movimentos antigos e
-- movimentos que não são estornos continuam válidos; um movimento original só pode
-- aparecer uma vez como estornado.
ALTER TABLE `movimentacoesEstoqueSerrado`
  ADD INDEX `mov_estoque_serrado_empresa_ciclo_idx` (`empresaId`, `cicloEntregaId`),
  ADD UNIQUE INDEX `mov_estoque_serrado_estorno_original_unico` (`estornoDeMovimentoId`),
  ALGORITHM=INPLACE,
  LOCK=NONE;

CREATE TABLE `revisoesVendas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresaId` int NOT NULL,
  `orcamentoId` int NOT NULL,
  `versaoAnterior` int NOT NULL,
  `versaoNova` int NOT NULL,
  `usuarioId` int NOT NULL,
  `motivo` text NOT NULL,
  `totalAnterior` decimal(14,2) NOT NULL,
  `totalNovo` decimal(14,2) NOT NULL,
  `snapshotAnterior` json NOT NULL,
  `snapshotNovo` json NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `revisoes_vendas_empresa_orcamento_versao_unico` (`empresaId`, `orcamentoId`, `versaoNova`),
  INDEX `revisoes_vendas_empresa_orcamento_data_idx` (`empresaId`, `orcamentoId`, `createdAt`)
) ENGINE=InnoDB;

CREATE TABLE `ciclosEntrega` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresaId` int NOT NULL,
  `orcamentoId` int NOT NULL,
  `numeroCiclo` int NOT NULL,
  `estado` enum('entregue','estornado') NOT NULL DEFAULT 'entregue',
  `cicloAtivoOrcamentoId` int GENERATED ALWAYS AS (CASE WHEN `estado` = 'entregue' THEN `orcamentoId` ELSE NULL END) STORED,
  `entregueEm` timestamp NOT NULL,
  `entreguePor` int NOT NULL,
  `estornadoEm` timestamp NULL,
  `estornadoPor` int NULL,
  `motivoEstorno` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ciclos_entrega_empresa_orcamento_numero_unico` (`empresaId`, `orcamentoId`, `numeroCiclo`),
  UNIQUE INDEX `ciclos_entrega_uma_ativa_por_venda_unico` (`empresaId`, `cicloAtivoOrcamentoId`),
  INDEX `ciclos_entrega_empresa_orcamento_estado_idx` (`empresaId`, `orcamentoId`, `estado`),
  CONSTRAINT `ciclos_entrega_motivo_estorno_obrigatorio_chk`
    CHECK (`estado` <> 'estornado' OR (`estornadoEm` IS NOT NULL AND `estornadoPor` IS NOT NULL AND `motivoEstorno` IS NOT NULL AND CHAR_LENGTH(TRIM(`motivoEstorno`)) > 0))
) ENGINE=InnoDB;

CREATE TABLE `reservasEstoqueVenda` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresaId` int NOT NULL,
  `orcamentoId` int NOT NULL,
  `itemOrcamentoId` int NOT NULL,
  `versaoComercial` int NOT NULL,
  `chaveReserva` varchar(120) NOT NULL,
  `tipoComercializacao` enum('metro_cubico','unidade','pacote') NOT NULL,
  `produtoComercialId` int NULL,
  `madeiraId` int NULL,
  `bitolaId` int NULL,
  `loteId` int NULL,
  `descricaoRecurso` varchar(240) NULL,
  `espessura` decimal(8,2) NULL,
  `largura` decimal(8,2) NULL,
  `comprimento` decimal(8,2) NULL,
  `quantidade` decimal(14,6) NOT NULL,
  `unidadeMedida` enum('m3','unidade','pacote','peca') NOT NULL,
  `estado` enum('reservada','consumida','liberada') NOT NULL DEFAULT 'reservada',
  `criadoPor` int NOT NULL,
  `encerradaEm` timestamp NULL,
  `encerradaPor` int NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `reservas_estoque_venda_alocacao_unica` (`empresaId`, `orcamentoId`, `versaoComercial`, `chaveReserva`),
  INDEX `reservas_estoque_venda_empresa_versao_item_idx` (`empresaId`, `orcamentoId`, `versaoComercial`, `itemOrcamentoId`),
  INDEX `reservas_estoque_venda_empresa_lote_estado_idx` (`empresaId`, `loteId`, `estado`),
  CONSTRAINT `reservas_estoque_venda_quantidade_positiva_chk` CHECK (`quantidade` > 0)
) ENGINE=InnoDB;

CREATE TABLE `ajustesFinanceirosVenda` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresaId` int NOT NULL,
  `orcamentoId` int NOT NULL,
  `revisaoVendaId` int NOT NULL,
  `tituloFinanceiroId` int NOT NULL,
  `valorAjuste` decimal(14,2) NOT NULL,
  `criadoPor` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `ajustes_financeiros_venda_revisao_idx` (`revisaoVendaId`),
  INDEX `ajustes_financeiros_venda_titulo_idx` (`tituloFinanceiroId`),
  INDEX `ajustes_financeiros_venda_empresa_orcamento_idx` (`empresaId`, `orcamentoId`)
) ENGINE=InnoDB;

-- Limitação intencional: não são criadas FKs nesta preparação. O schema atual não
-- declara FKs Drizzle e possui referências legadas sem garantias verificadas. A próxima
-- fase deverá validar empresa/venda/itens/lotes/títulos dentro de transações.
