-- Histórico append-only de reapresentações, depósitos, devoluções e regularizações.
-- Não executar em produção sem plano de backup, homologação e autorização.
-- A tabela não altera nem reescreve os cheques, recebimentos ou dados históricos existentes.
CREATE TABLE `movimentacoesCheques` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empresaId` int NOT NULL,
  `chequeId` int NOT NULL,
  `tipo` enum('devolucao','reapresentacao','deposito','compensacao','regularizacao') NOT NULL,
  `tentativa` int,
  `valor` decimal(14,2),
  `dataOperacao` timestamp NOT NULL,
  `motivo` text,
  `formaPagamento` enum('pix','dinheiro','cheque','transferencia','boleto','cartao_credito','cartao_debito','outro'),
  `referencia` varchar(300),
  `contaDestinoId` int,
  `baixaFinanceiraId` int,
  `chaveIdempotencia` varchar(64),
  `criadoPor` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `mov_cheques_empresa_cheque_data_idx` (`empresaId`,`chequeId`,`dataOperacao`,`id`),
  INDEX `mov_cheques_empresa_cheque_tipo_idx` (`empresaId`,`chequeId`,`tipo`),
  INDEX `mov_cheques_baixa_financeira_idx` (`baixaFinanceiraId`),
  UNIQUE INDEX `mov_cheques_empresa_idempotencia_unico` (`empresaId`,`chaveIdempotencia`),
  UNIQUE INDEX `mov_cheques_empresa_cheque_tipo_tentativa_unico` (`empresaId`,`chequeId`,`tipo`,`tentativa`)
) ENGINE=InnoDB;
