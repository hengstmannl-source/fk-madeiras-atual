import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, boolean, index, uniqueIndex } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Perfil operacional direto do sistema interno, sem vínculo de tenant por usuário. */
  papel: mysqlEnum("papel", ["proprietario", "administrador", "financeiro", "rh", "vendas", "producao", "consulta"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Empresas independentes que utilizam a plataforma. */
export const empresas = mysqlTable("empresas", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 300 }).notNull(),
  nomeFantasia: varchar("nomeFantasia", { length: 300 }),
  documento: varchar("documento", { length: 30 }),
  email: varchar("email", { length: 320 }),
  telefone: varchar("telefone", { length: 100 }),
  ativa: boolean("ativa").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Empresa = typeof empresas.$inferSelect;
export type InsertEmpresa = typeof empresas.$inferInsert;

export const empresaMembros = mysqlTable("empresaMembros", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  papel: mysqlEnum("papel", ["proprietario", "administrador", "financeiro", "rh", "vendas", "producao", "consulta"]).notNull().default("consulta"),
  ativo: boolean("ativo").notNull().default(true),
  convidadoPor: int("convidadoPor"),
  entrouEm: timestamp("entrouEm").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaUsuarioUnico: uniqueIndex("empresa_membros_empresa_usuario_unico").on(table.empresaId, table.usuarioId),
  empresaIndice: index("empresa_membros_empresa_indice").on(table.empresaId),
  usuarioIndice: index("empresa_membros_usuario_indice").on(table.usuarioId),
}));

export type EmpresaMembro = typeof empresaMembros.$inferSelect;
export type InsertEmpresaMembro = typeof empresaMembros.$inferInsert;

/** Credencial local usada pelo login próprio, sem depender da conta Manus. */
export const credenciaisUsuarios = mysqlTable("credenciaisUsuarios", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId").notNull().unique(),
  emailNormalizado: varchar("emailNormalizado", { length: 320 }).notNull().unique(),
  senhaHash: varchar("senhaHash", { length: 500 }).notNull(),
  senhaDefinidaEm: timestamp("senhaDefinidaEm").defaultNow().notNull(),
  tentativasFalhas: int("tentativasFalhas").notNull().default(0),
  bloqueadoAte: timestamp("bloqueadoAte"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CredencialUsuario = typeof credenciaisUsuarios.$inferSelect;
export type InsertCredencialUsuario = typeof credenciaisUsuarios.$inferInsert;

export const convitesEmpresa = mysqlTable("convitesEmpresa", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  emailNormalizado: varchar("emailNormalizado", { length: 320 }).notNull(),
  papel: mysqlEnum("papel", ["administrador", "financeiro", "rh", "vendas", "producao", "consulta"]).notNull().default("consulta"),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiraEm: timestamp("expiraEm").notNull(),
  aceitoEm: timestamp("aceitoEm"),
  canceladoEm: timestamp("canceladoEm"),
  convidadoPor: int("convidadoPor").notNull(),
  aceitoPor: int("aceitoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConviteEmpresa = typeof convitesEmpresa.$inferSelect;
export type InsertConviteEmpresa = typeof convitesEmpresa.$inferInsert;

export const recuperacoesSenha = mysqlTable("recuperacoesSenha", {
  id: int("id").autoincrement().primaryKey(),
  usuarioId: int("usuarioId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiraEm: timestamp("expiraEm").notNull(),
  usadoEm: timestamp("usadoEm"),
  solicitadoEm: timestamp("solicitadoEm").defaultNow().notNull(),
});

export type RecuperacaoSenha = typeof recuperacoesSenha.$inferSelect;
export type InsertRecuperacaoSenha = typeof recuperacoesSenha.$inferInsert;

export const madeiras = mysqlTable("madeiras", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  nome: varchar("nome", { length: 200 }).notNull(),
  descricao: text("descricao"),
  precoM3: decimal("precoM3", { precision: 12, scale: 2 }).notNull().default("0"),
  unidadeMedida: varchar("unidadeMedida", { length: 20 }).notNull().default("m³"),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Madeira = typeof madeiras.$inferSelect;
export type InsertMadeira = typeof madeiras.$inferInsert;

export const bitolas = mysqlTable("bitolas", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  madeiraId: int("madeiraId").notNull(),
  espessura: decimal("espessura", { precision: 8, scale: 2 }).notNull(),
  largura: decimal("largura", { precision: 8, scale: 2 }).notNull(),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }),
  descricao: text("descricao"),
  criadoPor: int("criadoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Bitola = typeof bitolas.$inferSelect;
export type InsertBitola = typeof bitolas.$inferInsert;

export const clientes = mysqlTable("clientes", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  nome: varchar("nome", { length: 300 }).notNull(),
  contacto: varchar("contacto", { length: 100 }),
  email: varchar("email", { length: 300 }),
  morada: text("morada"),
  nif: varchar("nif", { length: 20 }),
  observacoes: text("observacoes"),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = typeof clientes.$inferInsert;

export const orcamentos = mysqlTable("orcamentos", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  numero: varchar("numero", { length: 20 }).unique(),
  clienteId: int("clienteId").notNull(),
  estado: mysqlEnum("estado", ["rascunho", "enviado", "aprovado", "rejeitado"]).notNull().default("rascunho"),
  desconto: decimal("desconto", { precision: 12, scale: 2 }).notNull().default("0"),
  frete: decimal("frete", { precision: 12, scale: 2 }).notNull().default("0"),
  fretePorTonelada: decimal("fretePorTonelada", { precision: 12, scale: 2 }).notNull().default("0"),
  pesoCargaToneladas: decimal("pesoCargaToneladas", { precision: 12, scale: 3 }).notNull().default("0"),
  abatimentoFrete: decimal("abatimentoFrete", { precision: 12, scale: 2 }).notNull().default("0"),
  baseAposFrete: decimal("baseAposFrete", { precision: 14, scale: 2 }).notNull().default("0"),
  comissaoTipo: mysqlEnum("comissaoTipo", ["percentual", "fixo"]).notNull().default("percentual"),
  comissaoValor: decimal("comissaoValor", { precision: 12, scale: 2 }).notNull().default("0"),
  comissaoCalculada: decimal("comissaoCalculada", { precision: 12, scale: 2 }).notNull().default("0"),
  taxaDescricao: varchar("taxaDescricao", { length: 120 }),
  taxaTipo: mysqlEnum("taxaTipo", ["percentual", "fixo"]).notNull().default("percentual"),
  taxaValor: decimal("taxaValor", { precision: 12, scale: 2 }).notNull().default("0"),
  taxaCalculada: decimal("taxaCalculada", { precision: 12, scale: 2 }).notNull().default("0"),
  subtotal: decimal("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 14, scale: 2 }).notNull().default("0"),
  totalPecas: int("totalPecas").notNull().default(0),
  totalMetroLinear: decimal("totalMetroLinear", { precision: 14, scale: 4 }).notNull().default("0"),
  totalVolume: decimal("totalVolume", { precision: 14, scale: 6 }).notNull().default("0"),
  /** Classificação comercial explícita, propagada aos recebíveis gerados pela venda. */
  centroCustoId: int("centroCustoId"),
  observacoes: text("observacoes"),
  vendedor: varchar("vendedor", { length: 200 }),
  criadoPor: int("criadoPor"),
  dataValidade: timestamp("dataValidade"),
  dataVencimento: timestamp("dataVencimento"),
  competencia: timestamp("competencia"),
  pago: boolean("pago").notNull().default(false),
  pagoEm: timestamp("pagoEm"),
  formaPagamento: varchar("formaPagamento", { length: 50 }),
  pagoPor: int("pagoPor"),
  entregue: boolean("entregue").notNull().default(false),
  entregueEm: timestamp("entregueEm"),
  entreguePor: int("entreguePor"),
  modalidadeEntrega: varchar("modalidadeEntrega", { length: 50 }),
  observacoesEntrega: text("observacoesEntrega"),
  responsavelEntrega: varchar("responsavelEntrega", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Orcamento = typeof orcamentos.$inferSelect;
export type InsertOrcamento = typeof orcamentos.$inferInsert;

/** Ajustes comerciais independentes aplicados à base da venda já descontada do frete. */
export const taxasAdicionaisOrcamento = mysqlTable("taxasAdicionaisOrcamento", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  orcamentoId: int("orcamentoId").notNull(),
  descricao: varchar("descricao", { length: 120 }).notNull(),
  tipo: mysqlEnum("tipo", ["percentual", "fixo"]).notNull().default("percentual"),
  valor: decimal("valor", { precision: 12, scale: 4 }).notNull(),
  calculado: decimal("calculado", { precision: 12, scale: 2 }).notNull().default("0"),
  ordem: int("ordem").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type TaxaAdicionalOrcamento = typeof taxasAdicionaisOrcamento.$inferSelect;
export type InsertTaxaAdicionalOrcamento = typeof taxasAdicionaisOrcamento.$inferInsert;

/** Sequência imutável usada exclusivamente para numerar vendas aprovadas. */
export const sequenciasVendas = mysqlTable("sequenciasVendas", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  orcamentoId: int("orcamentoId").notNull().unique(),
  numero: varchar("numero", { length: 20 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SequenciaVenda = typeof sequenciasVendas.$inferSelect;

/** Contadores independentes por empresa para os documentos emitidos após a padronização. */
export const sequenciasDocumentos = mysqlTable("sequenciasDocumentos", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  tipo: mysqlEnum("tipo", ["venda", "romaneio_entrada"]).notNull(),
  ultimoNumero: int("ultimoNumero").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaTipoUnico: uniqueIndex("sequenciasDocumentos_empresa_tipo_unq").on(table.empresaId, table.tipo),
}));

export type SequenciaDocumento = typeof sequenciasDocumentos.$inferSelect;

export const itensOrcamento = mysqlTable("itensOrcamento", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  orcamentoId: int("orcamentoId").notNull(),
  madeiraId: int("madeiraId"),
  bitolaId: int("bitolaId"),
  madeiraNome: varchar("madeiraNome", { length: 200 }).notNull(),
  bitolaDescricao: varchar("bitolaDescricao", { length: 200 }).notNull(),
  espessura: decimal("espessura", { precision: 8, scale: 2 }).notNull(),
  largura: decimal("largura", { precision: 8, scale: 2 }).notNull(),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }).notNull(),
  quantidade: int("quantidade").notNull(),
  produtoComercialId: int("produtoComercialId"),
  /** Forma como o item foi negociado, sem alterar a medida física usada pelo estoque quando ela existir. */
  tipoComercializacao: mysqlEnum("tipoComercializacao", ["metro_cubico", "unidade", "pacote"]).notNull().default("metro_cubico"),
  /** Quantidade de peças físicas representadas por uma unidade comercial; zero indica item sem baixa no estoque serrado. */
  unidadesPorComercializacao: int("unidadesPorComercializacao").notNull().default(1),
  precoM3: decimal("precoM3", { precision: 12, scale: 2 }).notNull(),
  precoLinear: decimal("precoLinear", { precision: 12, scale: 4 }).notNull(),
  valorPeca: decimal("valorPeca", { precision: 12, scale: 2 }).notNull(),
  valorTotal: decimal("valorTotal", { precision: 12, scale: 2 }).notNull(),
});

export type ItemOrcamento = typeof itensOrcamento.$inferSelect;
export type InsertItemOrcamento = typeof itensOrcamento.$inferInsert;

/** Componentes físicos que formam um pacote negociado em uma Venda. */
export const componentesPacoteOrcamento = mysqlTable("componentesPacoteOrcamento", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  itemOrcamentoId: int("itemOrcamentoId").notNull(),
  descricao: varchar("descricao", { length: 240 }).notNull(),
  madeiraNome: varchar("madeiraNome", { length: 200 }),
  espessura: decimal("espessura", { precision: 8, scale: 2 }),
  largura: decimal("largura", { precision: 8, scale: 2 }),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }),
  quantidadePorPacote: int("quantidadePorPacote").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ComponentePacoteOrcamento = typeof componentesPacoteOrcamento.$inferSelect;
export type InsertComponentePacoteOrcamento = typeof componentesPacoteOrcamento.$inferInsert;

/** Catálogo reutilizável de produtos vendidos por unidade ou pacote. */
export const produtosComerciais = mysqlTable("produtosComerciais", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  nome: varchar("nome", { length: 200 }).notNull(),
  tipoComercializacao: mysqlEnum("tipoComercializacao", ["unidade", "pacote"]).notNull(),
  precoPadrao: decimal("precoPadrao", { precision: 12, scale: 2 }).notNull(),
  ativo: boolean("ativo").notNull().default(true),
  observacoes: text("observacoes"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("produtosComerciais_empresa_ativo_idx").on(table.empresaId, table.ativo)]);

export type ProdutoComercial = typeof produtosComerciais.$inferSelect;
export type InsertProdutoComercial = typeof produtosComerciais.$inferInsert;

/** Itens que compõem um produto comercial do tipo pacote. */
export const componentesProdutoComercial = mysqlTable("componentesProdutoComercial", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  produtoComercialId: int("produtoComercialId").notNull(),
  descricao: varchar("descricao", { length: 240 }).notNull(),
  madeiraNome: varchar("madeiraNome", { length: 200 }),
  espessura: decimal("espessura", { precision: 8, scale: 2 }),
  largura: decimal("largura", { precision: 8, scale: 2 }),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }),
  quantidade: int("quantidade").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ComponenteProdutoComercial = typeof componentesProdutoComercial.$inferSelect;
export type InsertComponenteProdutoComercial = typeof componentesProdutoComercial.$inferInsert;

/** Aproveitamentos volumétricos reservados no romaneio comercial antes da baixa física na entrega. */
export const aproveitamentosOrcamento = mysqlTable("aproveitamentosOrcamento", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  orcamentoId: int("orcamentoId").notNull(),
  madeiraNome: varchar("madeiraNome", { length: 200 }).notNull(),
  volume: decimal("volume", { precision: 12, scale: 3 }).notNull(),
  precoM3: decimal("precoM3", { precision: 12, scale: 2 }).notNull(),
  valorTotal: decimal("valorTotal", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AproveitamentoOrcamento = typeof aproveitamentosOrcamento.$inferSelect;
export type InsertAproveitamentoOrcamento = typeof aproveitamentosOrcamento.$inferInsert;

export const modelosMedidaVenda = mysqlTable("modelosMedidaVenda", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  nome: varchar("nome", { length: 120 }).notNull(),
  madeiraId: int("madeiraId"),
  madeiraNome: varchar("madeiraNome", { length: 200 }).notNull(),
  precoM3: decimal("precoM3", { precision: 12, scale: 2 }).notNull(),
  espessuraCm: decimal("espessuraCm", { precision: 8, scale: 2 }).notNull(),
  larguraCm: decimal("larguraCm", { precision: 8, scale: 2 }).notNull(),
  comprimentos: text("comprimentos").notNull(),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ModeloMedidaVenda = typeof modelosMedidaVenda.$inferSelect;
export type InsertModeloMedidaVenda = typeof modelosMedidaVenda.$inferInsert;

export const historicoAlteracoes = mysqlTable("historicoAlteracoes", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  orcamentoId: int("orcamentoId").notNull(),
  usuarioId: int("usuarioId").notNull(),
  tipo: mysqlEnum("tipo", ["criacao", "alteracao", "exclusao", "estado"]).notNull(),
  detalhes: text("detalhes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type HistoricoAlteracao = typeof historicoAlteracoes.$inferSelect;

export const empresaConfiguracoes = mysqlTable("empresaConfiguracoes", {
  /** Configuração visual exclusiva da empresa. */
  id: int("id").primaryKey(),
  empresaId: int("empresaId").notNull().unique(),
  logoKey: varchar("logoKey", { length: 500 }),
  logoUrl: varchar("logoUrl", { length: 700 }),
  logoMimeType: varchar("logoMimeType", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmpresaConfiguracao = typeof empresaConfiguracoes.$inferSelect;
export type InsertEmpresaConfiguracao = typeof empresaConfiguracoes.$inferInsert;

// ─── Produção e estoque de madeira serrada ───
export const romaneiosCargaToras = mysqlTable("romaneiosCargaToras", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  numero: varchar("numero", { length: 30 }).notNull().unique(),
  dataCarga: timestamp("dataCarga").notNull(),
  dataVencimento: timestamp("dataVencimento").notNull(),
  origem: varchar("origem", { length: 200 }),
  fornecedorId: int("fornecedorId"),
  /** Centro de Custo explicitamente escolhido para a compra e seu título automático. */
  centroCustoId: int("centroCustoId"),
  responsavel: varchar("responsavel", { length: 200 }),
  observacoes: text("observacoes"),
  totalPlaquetas: int("totalPlaquetas").notNull().default(0),
  volumeTotal: decimal("volumeTotal", { precision: 14, scale: 6 }).notNull().default("0"),
  valorProdutos: decimal("valorProdutos", { precision: 14, scale: 2 }).notNull().default("0"),
  fretePorMetroCubico: decimal("fretePorMetroCubico", { precision: 14, scale: 2 }).notNull().default("0"),
  frete: decimal("frete", { precision: 14, scale: 2 }).notNull().default("0"),
  valorTotal: decimal("valorTotal", { precision: 14, scale: 2 }).notNull().default("0"),
  tituloFinanceiroId: int("tituloFinanceiroId").unique(),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RomaneioCargaToras = typeof romaneiosCargaToras.$inferSelect;

export const plaquetas = mysqlTable("plaquetas", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  codigo: varchar("codigo", { length: 80 }).notNull().unique(),
  codigoFisico: varchar("codigoFisico", { length: 80 }),
  situacaoIdentificacao: mysqlEnum("situacaoIdentificacao", ["identificada", "sem_plaqueta", "duplicada"]).notNull().default("identificada"),
  madeiraNome: varchar("madeiraNome", { length: 200 }).notNull(),
  espessura: decimal("espessura", { precision: 8, scale: 2 }),
  largura: decimal("largura", { precision: 8, scale: 2 }),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }),
  diametro: decimal("diametro", { precision: 8, scale: 2 }),
  volumeInicial: decimal("volumeInicial", { precision: 14, scale: 6 }).notNull(),
  volumeDisponivel: decimal("volumeDisponivel", { precision: 14, scale: 6 }).notNull(),
  valorMetroCubico: decimal("valorMetroCubico", { precision: 14, scale: 2 }).notNull().default("0"),
  valorTotal: decimal("valorTotal", { precision: 14, scale: 2 }).notNull().default("0"),
  dataEntrada: timestamp("dataEntrada").notNull(),
  romaneioCargaId: int("romaneioCargaId"),
  origem: varchar("origem", { length: 200 }),
  localizacao: varchar("localizacao", { length: 200 }),
  observacoes: text("observacoes"),
  estado: mysqlEnum("estado", ["disponivel", "consumida", "cancelada"]).notNull().default("disponivel"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Plaqueta = typeof plaquetas.$inferSelect;
export type InsertPlaqueta = typeof plaquetas.$inferInsert;

/**
 * Corrige volume físico informado indevidamente sem apagar a medição, o consumo
 * ou o romaneio original. Cada regularização registra o valor anterior, o valor
 * confirmado e quem justificou a alteração.
 */
export const regularizacoesVolumePlaquetas = mysqlTable("regularizacoesVolumePlaquetas", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  plaquetaId: int("plaquetaId").notNull(),
  romaneioProducaoId: int("romaneioProducaoId"),
  volumeAnterior: decimal("volumeAnterior", { precision: 14, scale: 6 }).notNull(),
  volumeConfirmado: decimal("volumeConfirmado", { precision: 14, scale: 6 }).notNull(),
  justificativa: text("justificativa").notNull(),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  plaquetaIndice: index("regularizacoes_volume_plaquetas_plaqueta_indice").on(table.empresaId, table.plaquetaId, table.createdAt),
  romaneioIndice: index("regularizacoes_volume_plaquetas_romaneio_indice").on(table.empresaId, table.romaneioProducaoId),
}));

export type RegularizacaoVolumePlaqueta = typeof regularizacoesVolumePlaquetas.$inferSelect;

/** Conferências registradas para alertas de volume atípico por essência. */
export const conferenciasVariacaoPlaquetas = mysqlTable("conferenciasVariacaoPlaquetas", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  essencia: varchar("essencia", { length: 200 }).notNull(),
  assinatura: varchar("assinatura", { length: 255 }).notNull(),
  confirmadoPor: int("confirmadoPor").notNull(),
  confirmadoEm: timestamp("confirmadoEm").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaEssenciaUnica: uniqueIndex("conferencias_variacao_plaquetas_empresa_essencia_unica").on(table.empresaId, table.essencia),
  empresaIndice: index("conferencias_variacao_plaquetas_empresa_indice").on(table.empresaId),
}));

export type ConferenciaVariacaoPlaqueta = typeof conferenciasVariacaoPlaquetas.$inferSelect;

export const romaneiosProducao = mysqlTable("romaneiosProducao", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  numero: varchar("numero", { length: 30 }).notNull().unique(),
  plaquetaId: int("plaquetaId"),
  totalToras: int("totalToras").notNull().default(1),
  madeiraTora: varchar("madeiraTora", { length: 200 }),
  espessuraTora: decimal("espessuraTora", { precision: 8, scale: 2 }),
  larguraTora: decimal("larguraTora", { precision: 8, scale: 2 }),
  comprimentoTora: decimal("comprimentoTora", { precision: 8, scale: 2 }),
  volumeTora: decimal("volumeTora", { precision: 14, scale: 6 }),
  aproveitamento: decimal("aproveitamento", { precision: 8, scale: 2 }),
  volumeAproveitamento: decimal("volumeAproveitamento", { precision: 14, scale: 6 }).notNull().default("0"),
  incluirAproveitamentoNoRendimento: boolean("incluirAproveitamentoNoRendimento").notNull().default(false),
  dataProducao: timestamp("dataProducao").notNull(),
  fita: varchar("fita", { length: 100 }),
  responsavel: varchar("responsavel", { length: 200 }),
  observacoes: text("observacoes"),
  estado: mysqlEnum("estado", ["rascunho", "confirmado", "cancelado"]).notNull().default("rascunho"),
  confirmadoEm: timestamp("confirmadoEm"),
  confirmadoPor: int("confirmadoPor"),
  canceladoEm: timestamp("canceladoEm"),
  canceladoPor: int("canceladoPor"),
  motivoCancelamento: text("motivoCancelamento"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RomaneioProducao = typeof romaneiosProducao.$inferSelect;
export type InsertRomaneioProducao = typeof romaneiosProducao.$inferInsert;

export const itensRomaneioToras = mysqlTable("itensRomaneioToras", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  romaneioId: int("romaneioId").notNull(),
  plaquetaId: int("plaquetaId").notNull().unique(),
  madeiraNome: varchar("madeiraNome", { length: 200 }).notNull(),
  diametro: decimal("diametro", { precision: 8, scale: 2 }),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }),
  volume: decimal("volume", { precision: 14, scale: 6 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ItemRomaneioTora = typeof itensRomaneioToras.$inferSelect;
export type InsertItemRomaneioTora = typeof itensRomaneioToras.$inferInsert;

export const itensRomaneioProducao = mysqlTable("itensRomaneioProducao", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  romaneioId: int("romaneioId").notNull(),
  madeiraNome: varchar("madeiraNome", { length: 200 }).notNull(),
  espessura: decimal("espessura", { precision: 8, scale: 2 }).notNull(),
  largura: decimal("largura", { precision: 8, scale: 2 }).notNull(),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }).notNull(),
  quantidade: int("quantidade").notNull(),
  metrosLineares: decimal("metrosLineares", { precision: 14, scale: 4 }).notNull(),
  volume: decimal("volume", { precision: 14, scale: 6 }).notNull(),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const aproveitamentosRomaneioProducao = mysqlTable("aproveitamentosRomaneioProducao", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  romaneioId: int("romaneioId").notNull(),
  madeiraNome: varchar("madeiraNome", { length: 200 }).notNull(),
  volume: decimal("volume", { precision: 14, scale: 6 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  romaneioIndice: index("aproveitamentos_romaneio_producao_romaneio_indice").on(table.empresaId, table.romaneioId),
}));

export type ItemRomaneioProducao = typeof itensRomaneioProducao.$inferSelect;
export type InsertItemRomaneioProducao = typeof itensRomaneioProducao.$inferInsert;

/** Serviço executado com toras de um cliente, sem ingresso no estoque próprio de toras. */
export const serragensTerceiros = mysqlTable("serragensTerceiros", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  numero: varchar("numero", { length: 40 }).notNull().unique(),
  clienteId: int("clienteId").notNull(),
  /** Centro de Custo explicitamente escolhido para o recebível do serviço. */
  centroCustoId: int("centroCustoId"),
  dataProducao: timestamp("dataProducao").notNull(),
  responsavel: varchar("responsavel", { length: 200 }),
  observacoes: text("observacoes"),
  valorServico: decimal("valorServico", { precision: 14, scale: 2 }).notNull(),
  valorMetroCubico: decimal("valorMetroCubico", { precision: 14, scale: 2 }).notNull().default("0"),
  dataVencimento: timestamp("dataVencimento").notNull(),
  volumeToras: decimal("volumeToras", { precision: 14, scale: 6 }).notNull(),
  volumeProduzido: decimal("volumeProduzido", { precision: 14, scale: 6 }).notNull(),
  aproveitamento: decimal("aproveitamento", { precision: 8, scale: 2 }).notNull(),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaClienteIndice: index("serragens_terceiros_empresa_cliente_indice").on(table.empresaId, table.clienteId, table.dataProducao),
}));

export const itensSerragemToras = mysqlTable("itensSerragemToras", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  serragemId: int("serragemId").notNull(),
  referencia: varchar("referencia", { length: 120 }).notNull(),
  madeiraNome: varchar("madeiraNome", { length: 200 }).notNull(),
  diametro: decimal("diametro", { precision: 8, scale: 2 }),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }),
  volume: decimal("volume", { precision: 14, scale: 6 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const itensSerragemPecas = mysqlTable("itensSerragemPecas", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  serragemId: int("serragemId").notNull(),
  madeiraNome: varchar("madeiraNome", { length: 200 }).notNull(),
  espessura: decimal("espessura", { precision: 8, scale: 2 }).notNull(),
  largura: decimal("largura", { precision: 8, scale: 2 }).notNull(),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }).notNull(),
  quantidade: int("quantidade").notNull(),
  metrosLineares: decimal("metrosLineares", { precision: 14, scale: 4 }).notNull(),
  volume: decimal("volume", { precision: 14, scale: 6 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const retiradasSerragemTerceiros = mysqlTable("retiradasSerragemTerceiros", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  serragemId: int("serragemId").notNull(),
  clienteId: int("clienteId").notNull(),
  dataRetirada: timestamp("dataRetirada").notNull(),
  responsavel: varchar("responsavel", { length: 200 }),
  observacoes: text("observacoes"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  serragemIndice: index("retiradas_serragem_terceiros_serragem_indice").on(table.empresaId, table.serragemId),
}));

export const itensRetiradaSerragemTerceiros = mysqlTable("itensRetiradaSerragemTerceiros", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  retiradaId: int("retiradaId").notNull(),
  loteId: int("loteId").notNull(),
  quantidade: int("quantidade").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  retiradaIndice: index("itens_retirada_serragem_terceiros_retirada_indice").on(table.empresaId, table.retiradaId),
  loteIndice: index("itens_retirada_serragem_terceiros_lote_indice").on(table.empresaId, table.loteId),
}));

export const lotesPecasSerradas = mysqlTable("lotesPecasSerradas", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  romaneioId: int("romaneioId"),
  itemRomaneioId: int("itemRomaneioId").unique(),
  serragemTerceirosId: int("serragemTerceirosId"),
  itemSerragemId: int("itemSerragemId").unique(),
  propriedade: mysqlEnum("propriedade", ["proprio", "terceiro"]).notNull().default("proprio"),
  clienteProprietarioId: int("clienteProprietarioId"),
  tipo: mysqlEnum("tipo", ["peca", "aproveitamento"]).notNull().default("peca"),
  madeiraNome: varchar("madeiraNome", { length: 200 }).notNull(),
  espessura: decimal("espessura", { precision: 8, scale: 2 }).notNull(),
  largura: decimal("largura", { precision: 8, scale: 2 }).notNull(),
  comprimento: decimal("comprimento", { precision: 8, scale: 2 }).notNull(),
  quantidadeProduzida: int("quantidadeProduzida").notNull(),
  quantidadeDisponivel: int("quantidadeDisponivel").notNull(),
  metrosLineares: decimal("metrosLineares", { precision: 14, scale: 4 }).notNull(),
  volume: decimal("volume", { precision: 14, scale: 6 }).notNull(),
  estado: mysqlEnum("estado", ["disponivel", "esgotado", "cancelado", "negativo"]).notNull().default("disponivel"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  serragemIndice: index("lotes_pecas_serradas_serragem_indice").on(table.empresaId, table.serragemTerceirosId),
}));

export type LotePecasSerradas = typeof lotesPecasSerradas.$inferSelect;
export type InsertLotePecasSerradas = typeof lotesPecasSerradas.$inferInsert;

export const movimentacoesPlaquetas = mysqlTable("movimentacoesPlaquetas", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  plaquetaId: int("plaquetaId").notNull(),
  romaneioId: int("romaneioId"),
  tipo: mysqlEnum("tipo", ["entrada", "consumo", "estorno", "ajuste"]).notNull(),
  volume: decimal("volume", { precision: 14, scale: 6 }).notNull(),
  motivo: text("motivo"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MovimentacaoPlaqueta = typeof movimentacoesPlaquetas.$inferSelect;

export const movimentacoesEstoqueSerrado = mysqlTable("movimentacoesEstoqueSerrado", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  loteId: int("loteId").notNull(),
  itemVendaId: int("itemVendaId"),
  orcamentoId: int("orcamentoId"),
  tipo: mysqlEnum("tipo", ["entrada_producao", "saida_entrega", "estorno_entrega", "retirada_terceiro", "ajuste"]).notNull(),
  quantidade: int("quantidade").notNull(),
  volume: decimal("volume", { precision: 14, scale: 6 }).notNull().default("0"),
  motivo: text("motivo"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MovimentacaoEstoqueSerrado = typeof movimentacoesEstoqueSerrado.$inferSelect;

// ─── Financeiro ───
export const fornecedores = mysqlTable("fornecedores", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  nome: varchar("nome", { length: 300 }).notNull(),
  contacto: varchar("contacto", { length: 100 }),
  email: varchar("email", { length: 300 }),
  documento: varchar("documento", { length: 30 }),
  endereco: text("endereco"),
  observacoes: text("observacoes"),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Fornecedor = typeof fornecedores.$inferSelect;
export type InsertFornecedor = typeof fornecedores.$inferInsert;

export const categoriasFinanceiras = mysqlTable("categoriasFinanceiras", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  nome: varchar("nome", { length: 150 }).notNull(),
  tipo: mysqlEnum("tipo", ["receita", "despesa", "ambos"]).notNull().default("ambos"),
  categoriaPaiId: int("categoriaPaiId"),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CategoriaFinanceira = typeof categoriasFinanceiras.$inferSelect;
export type InsertCategoriaFinanceira = typeof categoriasFinanceiras.$inferInsert;

export const contasFinanceiras = mysqlTable("contasFinanceiras", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  nome: varchar("nome", { length: 150 }).notNull(),
  tipo: mysqlEnum("tipo", ["caixa", "caixa_cheque", "banco", "carteira", "outro"]).notNull().default("caixa"),
  banco: varchar("banco", { length: 150 }),
  agencia: varchar("agencia", { length: 40 }),
  numeroConta: varchar("numeroConta", { length: 60 }),
  dataInicio: timestamp("dataInicio"),
  saldoInicial: decimal("saldoInicial", { precision: 14, scale: 2 }).notNull().default("0"),
  ativa: boolean("ativa").notNull().default(true),
  observacoes: text("observacoes"),
  criadoPor: int("criadoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContaFinanceira = typeof contasFinanceiras.$inferSelect;
export type InsertContaFinanceira = typeof contasFinanceiras.$inferInsert;

/** Transferência interna entre duas contas da mesma empresa, sem natureza de receita ou despesa. */
export const transferenciasFinanceiras = mysqlTable("transferenciasFinanceiras", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  contaOrigemId: int("contaOrigemId").notNull(),
  contaDestinoId: int("contaDestinoId").notNull(),
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull(),
  dataTransferencia: timestamp("dataTransferencia").notNull(),
  descricao: varchar("descricao", { length: 300 }),
  observacoes: text("observacoes"),
  estado: mysqlEnum("estado", ["efetivada", "estornada"]).notNull().default("efetivada"),
  estornadaEm: timestamp("estornadaEm"),
  estornadaPor: int("estornadaPor"),
  motivoEstorno: text("motivoEstorno"),
  transferenciaOrigemId: int("transferenciaOrigemId").unique(),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  origemIndice: index("transferencias_financeiras_origem_indice").on(table.empresaId, table.contaOrigemId, table.dataTransferencia),
  destinoIndice: index("transferencias_financeiras_destino_indice").on(table.empresaId, table.contaDestinoId, table.dataTransferencia),
  estadoIndice: index("transferencias_financeiras_estado_indice").on(table.empresaId, table.estado, table.dataTransferencia),
}));

export type TransferenciaFinanceira = typeof transferenciasFinanceiras.$inferSelect;
export type InsertTransferenciaFinanceira = typeof transferenciasFinanceiras.$inferInsert;

/** Lançamentos patrimoniais espelhados, auditáveis e vinculados à mesma transferência. */
export const movimentosTransferenciasFinanceiras = mysqlTable("movimentosTransferenciasFinanceiras", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  transferenciaId: int("transferenciaId").notNull(),
  contaFinanceiraId: int("contaFinanceiraId").notNull(),
  tipo: mysqlEnum("tipo", ["entrada", "saida"]).notNull(),
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull(),
  dataMovimento: timestamp("dataMovimento").notNull(),
  descricao: varchar("descricao", { length: 300 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  transferenciaTipoUnico: uniqueIndex("movimentos_transferencia_tipo_unico").on(table.transferenciaId, table.tipo),
  contaDataIndice: index("movimentos_transferencia_conta_data_indice").on(table.empresaId, table.contaFinanceiraId, table.dataMovimento),
}));

export type MovimentoTransferenciaFinanceira = typeof movimentosTransferenciasFinanceiras.$inferSelect;
export type InsertMovimentoTransferenciaFinanceira = typeof movimentosTransferenciasFinanceiras.$inferInsert;

export const notasDiesel = mysqlTable("notasDiesel", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  numeroNota: varchar("numeroNota", { length: 100 }),
  fornecedorId: int("fornecedorId").notNull(),
  litros: decimal("litros", { precision: 14, scale: 3 }).notNull(),
  valorTotal: decimal("valorTotal", { precision: 14, scale: 2 }).notNull(),
  dataNota: timestamp("dataNota").notNull(),
  dataVencimento: timestamp("dataVencimento").notNull(),
  /** Centro de Custo da obrigação de compra; não é fonte de custo operacional do diesel. */
  centroCustoId: int("centroCustoId"),
  observacoes: text("observacoes"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotaDiesel = typeof notasDiesel.$inferSelect;
export type InsertNotaDiesel = typeof notasDiesel.$inferInsert;

export const abastecimentosDiesel = mysqlTable("abastecimentosDiesel", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  destino: varchar("destino", { length: 200 }).notNull(),
  responsavel: varchar("responsavel", { length: 200 }),
  litros: decimal("litros", { precision: 14, scale: 3 }).notNull(),
  custoUnitario: decimal("custoUnitario", { precision: 14, scale: 4 }).notNull(),
  custoTotal: decimal("custoTotal", { precision: 14, scale: 2 }).notNull(),
  dataAbastecimento: timestamp("dataAbastecimento").notNull(),
  /** Centro de Custo do consumo físico de diesel. */
  centroCustoId: int("centroCustoId"),
  observacoes: text("observacoes"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AbastecimentoDiesel = typeof abastecimentosDiesel.$inferSelect;
export type InsertAbastecimentoDiesel = typeof abastecimentosDiesel.$inferInsert;

/** Centro de custo utilizado para classificar a área econômica de títulos financeiros. */
export const centrosCustosGerenciais = mysqlTable("centrosCustosGerenciais", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  /** Código técnico estável. Não representa mais o tipo do centro. */
  codigo: varchar("codigo", { length: 80 }).notNull(),
  nome: varchar("nome", { length: 150 }).notNull(),
  tipo: mysqlEnum("tipo", ["industrial", "comercial_administrativo", "nao_apropriavel"]).notNull().default("industrial"),
  ativo: boolean("ativo").notNull().default(true),
  observacoes: text("observacoes"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaCodigoUnico: uniqueIndex("centros_custos_gerenciais_empresa_codigo_unico").on(table.empresaId, table.codigo),
  empresaTipoAtivoIndice: index("centros_custos_gerenciais_empresa_tipo_ativo_indice").on(table.empresaId, table.tipo, table.ativo),
}));

export type CentroCustoGerencial = typeof centrosCustosGerenciais.$inferSelect;
export type InsertCentroCustoGerencial = typeof centrosCustosGerenciais.$inferInsert;

/** Categoria configurável e sua base de apropriação; não altera a categoria financeira original. */
export const categoriasCustosGerenciais = mysqlTable("categoriasCustosGerenciais", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  centroCustoId: int("centroCustoId").notNull(),
  categoriaFinanceiraId: int("categoriaFinanceiraId"),
  codigo: varchar("codigo", { length: 80 }).notNull(),
  nome: varchar("nome", { length: 150 }).notNull(),
  tipo: mysqlEnum("tipo", ["estrutural", "direto_venda"]).notNull().default("estrutural"),
  baseApropriacao: mysqlEnum("baseApropriacao", ["m3_produzido", "m3_vendido", "valor_vendido", "quantidade_vendida", "carga", "pedido", "percentual_receita", "manual"]).notNull(),
  /** Só permite aproveitar a comissão já calculada na venda quando configurado expressamente. */
  incluirComissaoVendaAutomatica: boolean("incluirComissaoVendaAutomatica").notNull().default(false),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaCodigoUnico: uniqueIndex("categorias_custos_gerenciais_empresa_codigo_unico").on(table.empresaId, table.codigo),
  centroIndice: index("categorias_custos_gerenciais_centro_indice").on(table.empresaId, table.centroCustoId, table.ativo),
}));

export type CategoriaCustoGerencial = typeof categoriasCustosGerenciais.$inferSelect;
export type InsertCategoriaCustoGerencial = typeof categoriasCustosGerenciais.$inferInsert;

/** Custo gerencial por competência, independente da baixa ou do título financeiro de origem. */
export const lancamentosCustosGerenciais = mysqlTable("lancamentosCustosGerenciais", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  categoriaCustoId: int("categoriaCustoId").notNull(),
  competencia: timestamp("competencia").notNull(),
  /** Competência padrão de origem; em venda direta é a competência da própria venda. */
  competenciaOriginal: timestamp("competenciaOriginal"),
  competenciaAlteradaEm: timestamp("competenciaAlteradaEm"),
  competenciaAlteradaPor: int("competenciaAlteradaPor"),
  justificativaCompetencia: text("justificativaCompetencia"),
  descricao: varchar("descricao", { length: 300 }).notNull(),
  /** Define se valor representa moeda ou percentual; nunca é inferido da categoria. */
  unidadeValor: mysqlEnum("unidadeValor", ["monetario", "percentual"]).notNull().default("monetario"),
  valor: decimal("valor", { precision: 14, scale: 4 }).notNull(),
  origem: mysqlEnum("origem", ["manual", "financeiro_referenciado", "venda_direta"]).notNull().default("manual"),
  tituloFinanceiroId: int("tituloFinanceiroId"),
  orcamentoId: int("orcamentoId"),
  romaneioCargaId: int("romaneioCargaId"),
  romaneioProducaoId: int("romaneioProducaoId"),
  loteId: int("loteId"),
  notaDieselId: int("notaDieselId"),
  comprovanteUrl: varchar("comprovanteUrl", { length: 1000 }),
  observacoes: text("observacoes"),
  estado: mysqlEnum("estado", ["ativo", "cancelado"]).notNull().default("ativo"),
  canceladoEm: timestamp("canceladoEm"),
  canceladoPor: int("canceladoPor"),
  motivoCancelamento: text("motivoCancelamento"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  competenciaIndice: index("lancamentos_custos_gerenciais_competencia_indice").on(table.empresaId, table.competencia, table.estado),
  categoriaCompetenciaIndice: index("lancamentos_custos_gerenciais_categoria_competencia_indice").on(table.empresaId, table.categoriaCustoId, table.competencia),
  vendaIndice: index("lancamentos_custos_gerenciais_venda_indice").on(table.empresaId, table.orcamentoId, table.estado),
}));

export type LancamentoCustoGerencial = typeof lancamentosCustosGerenciais.$inferSelect;
export type InsertLancamentoCustoGerencial = typeof lancamentosCustosGerenciais.$inferInsert;

/** Versão imutável de um rateio mensal, preservando a base e os fatores utilizados no cálculo. */
export const rateiosCustosGerenciais = mysqlTable("rateiosCustosGerenciais", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  competencia: timestamp("competencia").notNull(),
  versao: int("versao").notNull(),
  estado: mysqlEnum("estado", ["vigente", "substituido"]).notNull().default("vigente"),
  criteriosSnapshot: text("criteriosSnapshot").notNull(),
  criadoPor: int("criadoPor").notNull(),
  substituidoEm: timestamp("substituidoEm"),
  substituidoPor: int("substituidoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  empresaCompetenciaVersaoUnica: uniqueIndex("rateios_custos_gerenciais_empresa_competencia_versao_unico").on(table.empresaId, table.competencia, table.versao),
  competenciaEstadoIndice: index("rateios_custos_gerenciais_competencia_estado_indice").on(table.empresaId, table.competencia, table.estado),
}));

export type RateioCustoGerencial = typeof rateiosCustosGerenciais.$inferSelect;
export type InsertRateioCustoGerencial = typeof rateiosCustosGerenciais.$inferInsert;

/** Componente calculado de uma versão de rateio, usado para auditoria sem recalcular o histórico. */
export const itensRateiosCustosGerenciais = mysqlTable("itensRateiosCustosGerenciais", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  rateioId: int("rateioId").notNull(),
  categoriaCustoId: int("categoriaCustoId").notNull(),
  baseApropriacao: mysqlEnum("baseApropriacao", ["m3_produzido", "m3_vendido", "valor_vendido", "quantidade_vendida", "carga", "pedido", "percentual_receita", "manual"]).notNull(),
  baseTotal: decimal("baseTotal", { precision: 18, scale: 6 }).notNull(),
  valorRateado: decimal("valorRateado", { precision: 14, scale: 2 }).notNull(),
  fatorUnitario: decimal("fatorUnitario", { precision: 18, scale: 8 }).notNull(),
  coberturaPercentual: decimal("coberturaPercentual", { precision: 8, scale: 2 }).notNull().default("100"),
  memoriaCalculo: text("memoriaCalculo").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  rateioCategoriaUnica: uniqueIndex("itens_rateios_custos_gerenciais_rateio_categoria_unico").on(table.rateioId, table.categoriaCustoId),
  categoriaIndice: index("itens_rateios_custos_gerenciais_categoria_indice").on(table.empresaId, table.categoriaCustoId),
}));

export type ItemRateioCustoGerencial = typeof itensRateiosCustosGerenciais.$inferSelect;
export type InsertItemRateioCustoGerencial = typeof itensRateiosCustosGerenciais.$inferInsert;

/** Cálculo imutável por produção, lote ou venda; nunca altera o documento operacional de origem. */
export const calculosCustosGerenciais = mysqlTable("calculosCustosGerenciais", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  entidadeTipo: mysqlEnum("entidadeTipo", ["romaneio_producao", "lote", "venda"]).notNull(),
  entidadeId: int("entidadeId").notNull(),
  competencia: timestamp("competencia").notNull(),
  versao: int("versao").notNull(),
  estado: mysqlEnum("estado", ["vigente", "substituido"]).notNull().default("vigente"),
  rateioId: int("rateioId"),
  custoMateriaPrima: decimal("custoMateriaPrima", { precision: 14, scale: 2 }).notNull().default("0"),
  custoIndustrial: decimal("custoIndustrial", { precision: 14, scale: 2 }).notNull().default("0"),
  custoAdministrativo: decimal("custoAdministrativo", { precision: 14, scale: 2 }).notNull().default("0"),
  custoComercial: decimal("custoComercial", { precision: 14, scale: 2 }).notNull().default("0"),
  custoTotal: decimal("custoTotal", { precision: 14, scale: 2 }).notNull().default("0"),
  coberturaPercentual: decimal("coberturaPercentual", { precision: 8, scale: 2 }).notNull().default("0"),
  statusCobertura: mysqlEnum("statusCobertura", ["completo", "parcial", "nao_determinado", "sem_volume_produzido"]).notNull(),
  criteriosSnapshot: text("criteriosSnapshot").notNull(),
  criadoPor: int("criadoPor").notNull(),
  substituidoEm: timestamp("substituidoEm"),
  substituidoPor: int("substituidoPor"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  empresaEntidadeVersaoUnica: uniqueIndex("calculos_custos_gerenciais_empresa_entidade_versao_unico").on(table.empresaId, table.entidadeTipo, table.entidadeId, table.versao),
  entidadeEstadoIndice: index("calculos_custos_gerenciais_entidade_estado_indice").on(table.empresaId, table.entidadeTipo, table.entidadeId, table.estado),
  rateioIndice: index("calculos_custos_gerenciais_rateio_indice").on(table.empresaId, table.rateioId),
}));

export type CalculoCustoGerencial = typeof calculosCustosGerenciais.$inferSelect;
export type InsertCalculoCustoGerencial = typeof calculosCustosGerenciais.$inferInsert;

/** Parcelas do cálculo gerencial que preservam origem, categoria e memória de cada custo. */
export const componentesCalculosCustosGerenciais = mysqlTable("componentesCalculosCustosGerenciais", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  calculoId: int("calculoId").notNull(),
  categoriaCustoId: int("categoriaCustoId"),
  itemRateioId: int("itemRateioId"),
  lancamentoCustoId: int("lancamentoCustoId"),
  tipo: mysqlEnum("tipo", ["materia_prima", "industrial", "administrativo", "comercial", "frete_comercial", "comissao", "taxa", "direto_venda"]).notNull(),
  origemTipo: mysqlEnum("origemTipo", ["consumo_tora", "rateio_categoria", "lancamento_direto", "venda"]).notNull(),
  origemId: int("origemId"),
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull(),
  coberturaPercentual: decimal("coberturaPercentual", { precision: 8, scale: 2 }).notNull().default("100"),
  memoriaCalculo: text("memoriaCalculo").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  calculoIndice: index("componentes_calculos_custos_gerenciais_calculo_indice").on(table.empresaId, table.calculoId),
  categoriaIndice: index("componentes_calculos_custos_gerenciais_categoria_indice").on(table.empresaId, table.categoriaCustoId),
  lancamentoIndice: index("componentes_calculos_custos_gerenciais_lancamento_indice").on(table.empresaId, table.lancamentoCustoId),
}));

export type ComponenteCalculoCustoGerencial = typeof componentesCalculosCustosGerenciais.$inferSelect;
export type InsertComponenteCalculoCustoGerencial = typeof componentesCalculosCustosGerenciais.$inferInsert;

export const titulosFinanceiros = mysqlTable("titulosFinanceiros", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  tipo: mysqlEnum("tipo", ["receber", "pagar"]).notNull(),
  origem: mysqlEnum("origem", ["orcamento", "romaneio_carga", "nota_diesel", "serragem_terceiros", "folha_pagamento", "manual", "recorrencia"]).notNull().default("manual"),
  chaveImportacao: varchar("chaveImportacao", { length: 120 }).unique(),
  descricao: varchar("descricao", { length: 300 }).notNull(),
  clienteId: int("clienteId"),
  fornecedorId: int("fornecedorId"),
  contraparteNome: varchar("contraparteNome", { length: 300 }),
  orcamentoId: int("orcamentoId"),
  romaneioCargaId: int("romaneioCargaId").unique(),
  notaDieselId: int("notaDieselId").unique(),
  serragemTerceirosId: int("serragemTerceirosId").unique(),
  categoriaId: int("categoriaId").notNull(),
  /** Centro de Custo do evento financeiro. Históricos não classificados permanecem nulos. */
  centroCustoId: int("centroCustoId"),
  recorrenciaId: int("recorrenciaId"),
  grupoParcelamento: varchar("grupoParcelamento", { length: 64 }),
  numeroParcela: int("numeroParcela"),
  totalParcelas: int("totalParcelas"),
  valorOriginal: decimal("valorOriginal", { precision: 14, scale: 2 }).notNull(),
  desconto: decimal("desconto", { precision: 14, scale: 2 }).notNull().default("0"),
  juros: decimal("juros", { precision: 14, scale: 2 }).notNull().default("0"),
  valorBaixado: decimal("valorBaixado", { precision: 14, scale: 2 }).notNull().default("0"),
  dataEmissao: timestamp("dataEmissao").notNull(),
  dataVencimento: timestamp("dataVencimento").notNull(),
  competencia: timestamp("competencia"),
  estado: mysqlEnum("estado", ["aberto", "parcial", "quitado", "vencido", "cancelado"]).notNull().default("aberto"),
  codigoBarrasBoleto: varchar("codigoBarrasBoleto", { length: 60 }),
  linhaDigitavelBoleto: varchar("linhaDigitavelBoleto", { length: 60 }),
  boletoConfirmadoEm: timestamp("boletoConfirmadoEm"),
  observacoes: text("observacoes"),
  canceladoEm: timestamp("canceladoEm"),
  canceladoPor: int("canceladoPor"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  centroCompetenciaIndice: index("titulos_financeiros_centro_competencia_indice").on(table.empresaId, table.centroCustoId, table.competencia, table.estado),
}));

export type TituloFinanceiro = typeof titulosFinanceiros.$inferSelect;
export type InsertTituloFinanceiro = typeof titulosFinanceiros.$inferInsert;

export const anexosFinanceiros = mysqlTable("anexosFinanceiros", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  tituloId: int("tituloId").notNull(),
  nomeArquivo: varchar("nomeArquivo", { length: 300 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  tamanhoBytes: int("tamanhoBytes").notNull(),
  tipo: mysqlEnum("tipo", ["nota_fiscal", "boleto", "comprovante", "outro"]).notNull().default("outro"),
  storageKey: varchar("storageKey", { length: 500 }).notNull().unique(),
  url: varchar("url", { length: 1000 }).notNull(),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnexoFinanceiro = typeof anexosFinanceiros.$inferSelect;
export type InsertAnexoFinanceiro = typeof anexosFinanceiros.$inferInsert;

export const baixasFinanceiras = mysqlTable("baixasFinanceiras", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  tituloId: int("tituloId").notNull(),
  contaFinanceiraId: int("contaFinanceiraId").notNull(),
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull(),
  dataBaixa: timestamp("dataBaixa").notNull(),
  formaPagamento: varchar("formaPagamento", { length: 50 }).notNull(),
  observacoes: text("observacoes"),
  /** Distingue uma baixa assistida por extrato de uma baixa feita diretamente no Financeiro. */
  origemBaixa: mysqlEnum("origemBaixa", ["manual", "conciliacao"]).notNull().default("manual"),
  conciliada: boolean("conciliada").notNull().default(false),
  conciliadaEm: timestamp("conciliadaEm"),
  estornada: boolean("estornada").notNull().default(false),
  estornadaEm: timestamp("estornadaEm"),
  estornadaPor: int("estornadaPor"),
  motivoEstorno: text("motivoEstorno"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BaixaFinanceira = typeof baixasFinanceiras.$inferSelect;
export type InsertBaixaFinanceira = typeof baixasFinanceiras.$inferInsert;

/** Cheques recebidos e guardados em uma conta do tipo Caixa Cheque. */
export const chequesFinanceiros = mysqlTable("chequesFinanceiros", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  contaFinanceiraId: int("contaFinanceiraId").notNull(),
  baixaEntradaId: int("baixaEntradaId").notNull(),
  baixaSaidaId: int("baixaSaidaId"),
  clienteId: int("clienteId").notNull(),
  referencia: varchar("referencia", { length: 120 }).notNull(),
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull(),
  dataRecebimento: timestamp("dataRecebimento").notNull(),
  dataCompensacao: timestamp("dataCompensacao"),
  utilizadoEm: timestamp("utilizadoEm"),
  depositadoEm: timestamp("depositadoEm"),
  contaDestinoId: int("contaDestinoId"),
  estado: mysqlEnum("estado", ["disponivel", "utilizado", "estornado", "depositado"]).notNull().default("disponivel"),
  estornadoEm: timestamp("estornadoEm"),
  motivoEstorno: text("motivoEstorno"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  referenciaPorContaUnica: uniqueIndex("cheques_financeiros_conta_referencia_unica").on(table.empresaId, table.contaFinanceiraId, table.referencia),
  contaEstadoIndice: index("cheques_financeiros_conta_estado_indice").on(table.empresaId, table.contaFinanceiraId, table.estado),
  compensacaoIndice: index("cheques_financeiros_compensacao_indice").on(table.empresaId, table.estado, table.dataCompensacao),
  clienteIndice: index("cheques_financeiros_cliente_indice").on(table.empresaId, table.clienteId),
  entradaIndice: index("cheques_financeiros_entrada_indice").on(table.baixaEntradaId),
  saidaIndice: index("cheques_financeiros_saida_indice").on(table.baixaSaidaId),
  destinoIndice: index("cheques_financeiros_destino_indice").on(table.empresaId, table.contaDestinoId, table.depositadoEm),
}));

export type ChequeFinanceiro = typeof chequesFinanceiros.$inferSelect;
export type InsertChequeFinanceiro = typeof chequesFinanceiros.$inferInsert;

export const extratosBancarios = mysqlTable("extratosBancarios", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  contaFinanceiraId: int("contaFinanceiraId").notNull(),
  nomeArquivo: varchar("nomeArquivo", { length: 300 }).notNull(),
  formato: mysqlEnum("formato", ["csv", "ofx"]).notNull(),
  periodoInicial: timestamp("periodoInicial"),
  periodoFinal: timestamp("periodoFinal"),
  saldoFinalBanco: decimal("saldoFinalBanco", { precision: 14, scale: 2 }),
  dataSaldoFinalBanco: timestamp("dataSaldoFinalBanco"),
  totalLinhas: int("totalLinhas").notNull().default(0),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExtratoBancario = typeof extratosBancarios.$inferSelect;
export type InsertExtratoBancario = typeof extratosBancarios.$inferInsert;

export const movimentosExtratoBancario = mysqlTable("movimentosExtratoBancario", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  extratoId: int("extratoId").notNull(),
  contaFinanceiraId: int("contaFinanceiraId").notNull(),
  dataMovimento: timestamp("dataMovimento").notNull(),
  descricao: varchar("descricao", { length: 500 }).notNull(),
  tipo: mysqlEnum("tipo", ["entrada", "saida"]).notNull(),
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull(),
  identificadorExterno: varchar("identificadorExterno", { length: 300 }),
  memoOriginal: text("memoOriginal"),
  numeroDocumento: varchar("numeroDocumento", { length: 160 }),
  saldoAposMovimento: decimal("saldoAposMovimento", { precision: 14, scale: 2 }),
  chaveUnica: varchar("chaveUnica", { length: 180 }).notNull().unique(),
  estado: mysqlEnum("estado", ["pendente", "conciliado", "ignorado", "divergente"]).notNull().default("pendente"),
  baixaFinanceiraId: int("baixaFinanceiraId").unique(),
  movimentoTransferenciaFinanceiraId: int("movimentoTransferenciaFinanceiraId").unique("movimentos_extrato_transferencia_unico"),
  conciliadoEm: timestamp("conciliadoEm"),
  conciliadoPor: int("conciliadoPor"),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  fitIdPorContaUnico: uniqueIndex("movimentos_extrato_fitid_por_conta_unico").on(table.empresaId, table.contaFinanceiraId, table.identificadorExterno),
  contaEstadoDataIndice: index("movimentos_extrato_conta_estado_data_indice").on(table.empresaId, table.contaFinanceiraId, table.estado, table.dataMovimento),
}));

/** Vínculo histórico entre a evidência bancária e as baixas ou transferências do Financeiro. */
export const vinculosConciliacaoBancaria = mysqlTable("vinculosConciliacaoBancaria", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  movimentoExtratoBancarioId: int("movimentoExtratoBancarioId").notNull(),
  baixaFinanceiraId: int("baixaFinanceiraId"),
  movimentoTransferenciaFinanceiraId: int("movimentoTransferenciaFinanceiraId"),
  tipo: mysqlEnum("tipo", ["baixa_existente", "baixa_gerada", "transferencia"]).notNull(),
  valorVinculado: decimal("valorVinculado", { precision: 14, scale: 2 }).notNull(),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  desfeitoEm: timestamp("desfeitoEm"),
  desfeitoPor: int("desfeitoPor"),
  motivoDesfeito: text("motivoDesfeito"),
}, (table) => ({
  movimentoAtivoIndice: index("vinculos_conciliacao_movimento_indice").on(table.empresaId, table.movimentoExtratoBancarioId, table.desfeitoEm),
  baixaIndice: index("vinculos_conciliacao_baixa_indice").on(table.empresaId, table.baixaFinanceiraId),
  baixaUnico: uniqueIndex("vinculos_conciliacao_baixa_unico").on(table.baixaFinanceiraId),
  transferenciaUnico: uniqueIndex("vinculos_conciliacao_transferencia_unico").on(table.movimentoTransferenciaFinanceiraId),
}));

export type VinculoConciliacaoBancaria = typeof vinculosConciliacaoBancaria.$inferSelect;
export type InsertVinculoConciliacaoBancaria = typeof vinculosConciliacaoBancaria.$inferInsert;

/** Auditoria mínima de importações e decisões tomadas sobre movimentos bancários. */
export const auditoriasConciliacaoBancaria = mysqlTable("auditoriasConciliacaoBancaria", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  movimentoExtratoBancarioId: int("movimentoExtratoBancarioId").notNull(),
  vinculoConciliacaoId: int("vinculoConciliacaoId"),
  acao: mysqlEnum("acao", ["importado", "conciliado_baixa", "conciliado_transferencia", "ignorado", "divergente", "desfeito", "baixa_criada"]).notNull(),
  detalhes: text("detalhes"),
  usuarioId: int("usuarioId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  movimentoDataIndice: index("auditorias_conciliacao_movimento_data_indice").on(table.empresaId, table.movimentoExtratoBancarioId, table.createdAt),
}));

export type MovimentoExtratoBancario = typeof movimentosExtratoBancario.$inferSelect;
export type InsertMovimentoExtratoBancario = typeof movimentosExtratoBancario.$inferInsert;

export const recorrenciasFinanceiras = mysqlTable("recorrenciasFinanceiras", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  tipo: mysqlEnum("tipo", ["receber", "pagar"]).notNull(),
  descricao: varchar("descricao", { length: 300 }).notNull(),
  clienteId: int("clienteId"),
  fornecedorId: int("fornecedorId"),
  contraparteNome: varchar("contraparteNome", { length: 300 }),
  categoriaId: int("categoriaId").notNull(),
  /** Centro herdado por cada título futuro da recorrência. */
  centroCustoId: int("centroCustoId"),
  contaFinanceiraId: int("contaFinanceiraId"),
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull(),
  frequencia: mysqlEnum("frequencia", ["semanal", "mensal", "trimestral", "semestral", "anual"]).notNull(),
  proximoVencimento: timestamp("proximoVencimento").notNull(),
  dataFim: timestamp("dataFim"),
  ativa: boolean("ativa").notNull().default(true),
  observacoes: text("observacoes"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  centroAtivaIndice: index("recorrencias_financeiras_centro_ativa_indice").on(table.empresaId, table.centroCustoId, table.ativa),
}));

export type RecorrenciaFinanceira = typeof recorrenciasFinanceiras.$inferSelect;
export type InsertRecorrenciaFinanceira = typeof recorrenciasFinanceiras.$inferInsert;

export const configuracoesFinanceiras = mysqlTable("configuracoesFinanceiras", {
  id: int("id").primaryKey(),
  empresaId: int("empresaId").notNull().unique(),
  alertaDiasAntecedencia: int("alertaDiasAntecedencia").notNull().default(7),
  alertaCronTaskUid: varchar("alertaCronTaskUid", { length: 65 }),
  ultimoProcessamentoEm: timestamp("ultimoProcessamentoEm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConfiguracaoFinanceira = typeof configuracoesFinanceiras.$inferSelect;

export const alertasFinanceiros = mysqlTable("alertasFinanceiros", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  tituloId: int("tituloId").notNull(),
  tipo: mysqlEnum("tipo", ["vence_em_breve", "vencido"]).notNull(),
  mensagem: varchar("mensagem", { length: 500 }).notNull(),
  estado: mysqlEnum("estado", ["ativo", "resolvido"]).notNull().default("ativo"),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  resolvidoEm: timestamp("resolvidoEm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AlertaFinanceiro = typeof alertasFinanceiros.$inferSelect;
export type InsertAlertaFinanceiro = typeof alertasFinanceiros.$inferInsert;

// ─── Recursos Humanos e folha de pagamento ───
// Os valores tributários ficam em tabelas versionadas; não existem alíquotas fixas no código.
export const departamentosRh = mysqlTable("departamentosRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  nome: varchar("nome", { length: 160 }).notNull(),
  descricao: text("descricao"),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaNomeUnico: uniqueIndex("departamentos_rh_empresa_nome_unico").on(table.empresaId, table.nome),
}));

export type DepartamentoRh = typeof departamentosRh.$inferSelect;

export const cargosRh = mysqlTable("cargosRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  nome: varchar("nome", { length: 160 }).notNull(),
  descricao: text("descricao"),
  cbo: varchar("cbo", { length: 20 }),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaNomeUnico: uniqueIndex("cargos_rh_empresa_nome_unico").on(table.empresaId, table.nome),
}));

export type CargoRh = typeof cargosRh.$inferSelect;

export const colaboradoresRh = mysqlTable("colaboradoresRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  usuarioId: int("usuarioId"),
  departamentoId: int("departamentoId"),
  cargoId: int("cargoId"),
  /** Centro de Custo que poderá ser propagado aos títulos de folha do colaborador. */
  centroCustoId: int("centroCustoId"),
  nome: varchar("nome", { length: 300 }).notNull(),
  cpf: varchar("cpf", { length: 20 }),
  rg: varchar("rg", { length: 30 }),
  pis: varchar("pis", { length: 30 }),
  email: varchar("email", { length: 320 }),
  telefone: varchar("telefone", { length: 100 }),
  dataNascimento: timestamp("dataNascimento"),
  dataAdmissao: timestamp("dataAdmissao").notNull(),
  dataDesligamento: timestamp("dataDesligamento"),
  tipoContrato: mysqlEnum("tipoContrato", ["clt", "temporario", "aprendiz", "estagiario", "autonomo"]).notNull().default("clt"),
  situacao: mysqlEnum("situacao", ["ativo", "afastado", "desligado"]).notNull().default("ativo"),
  salarioAtual: decimal("salarioAtual", { precision: 14, scale: 2 }).notNull(),
  cargaHorariaSemanal: decimal("cargaHorariaSemanal", { precision: 6, scale: 2 }).notNull().default("44"),
  banco: varchar("banco", { length: 120 }),
  agencia: varchar("agencia", { length: 40 }),
  contaBancaria: varchar("contaBancaria", { length: 80 }),
  chavePix: varchar("chavePix", { length: 320 }),
  observacoes: text("observacoes"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaCpfUnico: uniqueIndex("colaboradores_rh_empresa_cpf_unico").on(table.empresaId, table.cpf),
  empresaSituacaoIndice: index("colaboradores_rh_empresa_situacao_indice").on(table.empresaId, table.situacao),
}));

export type ColaboradorRh = typeof colaboradoresRh.$inferSelect;

export const historicosSalariaisRh = mysqlTable("historicosSalariaisRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  colaboradorId: int("colaboradorId").notNull(),
  salario: decimal("salario", { precision: 14, scale: 2 }).notNull(),
  vigenciaInicio: timestamp("vigenciaInicio").notNull(),
  motivo: varchar("motivo", { length: 300 }),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  colaboradorVigenciaUnica: uniqueIndex("historicos_salariais_rh_colaborador_vigencia_unico").on(table.empresaId, table.colaboradorId, table.vigenciaInicio),
}));

export type HistoricoSalarialRh = typeof historicosSalariaisRh.$inferSelect;

/** Parâmetros internos de planejamento de custo, sem valor legal ou de folha oficial. */
export const configuracoesCustosRh = mysqlTable("configuracoesCustosRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  fgtsPercentual: decimal("fgtsPercentual", { precision: 8, scale: 4 }).notNull().default("8"),
  inssPatronalPercentual: decimal("inssPatronalPercentual", { precision: 8, scale: 4 }).notNull().default("20"),
  inssPatronalEstimadoAtivo: boolean("inssPatronalEstimadoAtivo").notNull().default(true),
  descontoInssEstimadoAtivo: boolean("descontoInssEstimadoAtivo").notNull().default(false),
  provisaoDecimoTerceiroAtiva: boolean("provisaoDecimoTerceiroAtiva").notNull().default(true),
  provisaoFeriasAtiva: boolean("provisaoFeriasAtiva").notNull().default(true),
  provisaoTercoFeriasAtiva: boolean("provisaoTercoFeriasAtiva").notNull().default(true),
  observacoes: text("observacoes"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaUnica: uniqueIndex("configuracoes_custos_rh_empresa_unica").on(table.empresaId),
}));

/** Custos recorrentes definidos para toda a equipe, como benefícios ou encargos estimados. */
export const custosEmpresaRh = mysqlTable("custosEmpresaRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  descricao: varchar("descricao", { length: 200 }).notNull(),
  tipo: mysqlEnum("tipo", ["fixo", "percentual"]).notNull(),
  valor: decimal("valor", { precision: 14, scale: 4 }).notNull(),
  escopo: mysqlEnum("escopo", ["por_colaborador", "equipe"]).notNull().default("por_colaborador"),
  recorrente: boolean("recorrente").notNull().default(true),
  dataInicio: timestamp("dataInicio").notNull(),
  dataFim: timestamp("dataFim"),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaAtivoIndice: index("custos_empresa_rh_empresa_ativo_indice").on(table.empresaId, table.ativo),
}));

/** Benefícios e outros custos internos vinculados a um colaborador específico. */
export const custosColaboradorRh = mysqlTable("custosColaboradorRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  colaboradorId: int("colaboradorId").notNull(),
  categoria: mysqlEnum("categoria", ["vale_alimentacao", "vale_refeicao", "vale_transporte", "plano_saude", "plano_odontologico", "seguro_vida", "auxilio_educacao", "auxilio_combustivel", "outro"]).notNull().default("outro"),
  descricao: varchar("descricao", { length: 200 }).notNull(),
  tipo: mysqlEnum("tipo", ["fixo", "percentual"]).notNull(),
  valor: decimal("valor", { precision: 14, scale: 4 }).notNull(),
  recorrente: boolean("recorrente").notNull().default(true),
  descontarDoLiquido: boolean("descontarDoLiquido").notNull().default(false),
  dataInicio: timestamp("dataInicio").notNull(),
  dataFim: timestamp("dataFim"),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  colaboradorAtivoIndice: index("custos_colaborador_rh_colaborador_ativo_indice").on(table.empresaId, table.colaboradorId, table.ativo),
}));

export type ConfiguracaoCustosRh = typeof configuracoesCustosRh.$inferSelect;
export type CustoEmpresaRh = typeof custosEmpresaRh.$inferSelect;
export type CustoColaboradorRh = typeof custosColaboradorRh.$inferSelect;

/** Categorias internas usadas no extrato financeiro dos colaboradores. */
export const categoriasLancamentosRh = mysqlTable("categoriasLancamentosRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  nome: varchar("nome", { length: 160 }).notNull(),
  tipo: mysqlEnum("tipo", ["credito", "debito", "ambos"]).notNull().default("ambos"),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaNomeUnico: uniqueIndex("categorias_lancamentos_rh_empresa_nome_unico").on(table.empresaId, table.nome),
}));

/** Competência de controle gerencial. Não representa folha de pagamento oficial. */
export const competenciasFinanceirasRh = mysqlTable("competenciasFinanceirasRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  competencia: timestamp("competencia").notNull(),
  estado: mysqlEnum("estado", ["aberta", "fechada"]).notNull().default("aberta"),
  observacoes: text("observacoes"),
  fechadaEm: timestamp("fechadaEm"),
  fechadaPor: int("fechadaPor"),
  reabertaEm: timestamp("reabertaEm"),
  reabertaPor: int("reabertaPor"),
  motivoReabertura: text("motivoReabertura"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaCompetenciaUnica: uniqueIndex("competencias_financeiras_rh_empresa_competencia_unico").on(table.empresaId, table.competencia),
}));

/** Lançamentos cronológicos que formam a ficha financeira individual do colaborador. */
export const lancamentosColaboradoresRh = mysqlTable("lancamentosColaboradoresRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  colaboradorId: int("colaboradorId").notNull(),
  categoriaId: int("categoriaId"),
  tipo: mysqlEnum("tipo", ["credito", "debito", "pagamento"]).notNull(),
  origem: mysqlEnum("origem", ["manual", "adiantamento", "migracao"]).notNull().default("manual"),
  competencia: timestamp("competencia").notNull(),
  dataLancamento: timestamp("dataLancamento").notNull(),
  descricao: varchar("descricao", { length: 300 }).notNull(),
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull(),
  estado: mysqlEnum("estado", ["pendente", "liquidado", "cancelado"]).notNull().default("pendente"),
  tituloFinanceiroId: int("tituloFinanceiroId").unique(),
  observacoes: text("observacoes"),
  canceladoEm: timestamp("canceladoEm"),
  canceladoPor: int("canceladoPor"),
  motivoCancelamento: text("motivoCancelamento"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  colaboradorCompetenciaIndice: index("lancamentos_colaboradores_rh_colaborador_competencia_indice").on(table.empresaId, table.colaboradorId, table.competencia, table.dataLancamento),
  competenciaEstadoIndice: index("lancamentos_colaboradores_rh_competencia_estado_indice").on(table.empresaId, table.competencia, table.estado),
}));

/** Encargos editáveis para planejamento, sem pretensão de cálculo legal ou de folha oficial. */
export const encargosGerenciaisRh = mysqlTable("encargosGerenciaisRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  nome: varchar("nome", { length: 160 }).notNull(),
  tipo: mysqlEnum("tipo", ["fixo", "percentual"]).notNull().default("percentual"),
  valor: decimal("valor", { precision: 14, scale: 4 }).notNull(),
  baseCalculo: mysqlEnum("baseCalculo", ["salario_bruto"]).notNull().default("salario_bruto"),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaNomeUnico: uniqueIndex("encargos_gerenciais_rh_empresa_nome_unico").on(table.empresaId, table.nome),
}));

/** Linhas congeladas de salário e custo gerencial por competência, independentes da ficha financeira. */
export const salariosCompetenciasRh = mysqlTable("salariosCompetenciasRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  competenciaId: int("competenciaId").notNull(),
  colaboradorId: int("colaboradorId").notNull(),
  salarioBruto: decimal("salarioBruto", { precision: 14, scale: 2 }).notNull(),
  fgtsEstimado: decimal("fgtsEstimado", { precision: 14, scale: 2 }).notNull().default("0"),
  inssPatronalEstimado: decimal("inssPatronalEstimado", { precision: 14, scale: 2 }).notNull().default("0"),
  outrosEncargosEstimados: decimal("outrosEncargosEstimados", { precision: 14, scale: 2 }).notNull().default("0"),
  provisaoDecimoTerceiro: decimal("provisaoDecimoTerceiro", { precision: 14, scale: 2 }).notNull().default("0"),
  provisaoFerias: decimal("provisaoFerias", { precision: 14, scale: 2 }).notNull().default("0"),
  provisaoTercoFerias: decimal("provisaoTercoFerias", { precision: 14, scale: 2 }).notNull().default("0"),
  beneficios: decimal("beneficios", { precision: 14, scale: 2 }).notNull().default("0"),
  custoMensalEstimado: decimal("custoMensalEstimado", { precision: 14, scale: 2 }).notNull().default("0"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  competenciaColaboradorUnico: uniqueIndex("salarios_competencias_rh_competencia_colaborador_unico").on(table.empresaId, table.competenciaId, table.colaboradorId),
}));

export type CategoriaLancamentoRh = typeof categoriasLancamentosRh.$inferSelect;
export type CompetenciaFinanceiraRh = typeof competenciasFinanceirasRh.$inferSelect;
export type LancamentoColaboradorRh = typeof lancamentosColaboradoresRh.$inferSelect;
export type EncargoGerencialRh = typeof encargosGerenciaisRh.$inferSelect;
export type SalarioCompetenciaRh = typeof salariosCompetenciasRh.$inferSelect;

export const dependentesRh = mysqlTable("dependentesRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  colaboradorId: int("colaboradorId").notNull(),
  nome: varchar("nome", { length: 300 }).notNull(),
  cpf: varchar("cpf", { length: 20 }),
  dataNascimento: timestamp("dataNascimento"),
  deduzIrrf: boolean("deduzIrrf").notNull().default(true),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DependenteRh = typeof dependentesRh.$inferSelect;

export const eventosFolhaRh = mysqlTable("eventosFolhaRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  codigo: varchar("codigo", { length: 30 }).notNull(),
  nome: varchar("nome", { length: 200 }).notNull(),
  tipo: mysqlEnum("tipo", ["provento", "desconto", "informativo"]).notNull(),
  incideInss: boolean("incideInss").notNull().default(false),
  incideIrrf: boolean("incideIrrf").notNull().default(false),
  deduzIrrf: boolean("deduzIrrf").notNull().default(false),
  incideFgts: boolean("incideFgts").notNull().default(false),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaCodigoUnico: uniqueIndex("eventos_folha_rh_empresa_codigo_unico").on(table.empresaId, table.codigo),
}));

export type EventoFolhaRh = typeof eventosFolhaRh.$inferSelect;

export const adiantamentosRh = mysqlTable("adiantamentosRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  colaboradorId: int("colaboradorId").notNull(),
  competencia: timestamp("competencia").notNull(),
  dataAdiantamento: timestamp("dataAdiantamento").notNull(),
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull(),
  saldoPendente: decimal("saldoPendente", { precision: 14, scale: 2 }).notNull(),
  estado: mysqlEnum("estado", ["aberto", "descontado", "cancelado"]).notNull().default("aberto"),
  tituloFinanceiroId: int("tituloFinanceiroId").unique(),
  observacoes: text("observacoes"),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  colaboradorCompetenciaIndice: index("adiantamentos_rh_colaborador_competencia_indice").on(table.empresaId, table.colaboradorId, table.competencia, table.estado),
}));

export type AdiantamentoRh = typeof adiantamentosRh.$inferSelect;

export const parcelasAdiantamentosRh = mysqlTable("parcelasAdiantamentosRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  adiantamentoId: int("adiantamentoId").notNull(),
  numero: int("numero").notNull(),
  competencia: timestamp("competencia").notNull(),
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull(),
  estado: mysqlEnum("estado", ["pendente", "descontada", "cancelada"]).notNull().default("pendente"),
  folhaId: int("folhaId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  adiantamentoNumeroUnico: uniqueIndex("parcelas_adiantamentos_rh_numero_unico").on(table.adiantamentoId, table.numero),
  competenciaIndice: index("parcelas_adiantamentos_rh_competencia_indice").on(table.empresaId, table.competencia, table.estado),
}));

export type ParcelaAdiantamentoRh = typeof parcelasAdiantamentosRh.$inferSelect;

export const tabelasTributariasRh = mysqlTable("tabelasTributariasRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  nome: varchar("nome", { length: 200 }).notNull(),
  tipo: mysqlEnum("tipo", ["inss", "irrf", "fgts"]).notNull(),
  vigenciaInicio: timestamp("vigenciaInicio").notNull(),
  vigenciaFim: timestamp("vigenciaFim"),
  deducaoDependente: decimal("deducaoDependente", { precision: 14, scale: 2 }).notNull().default("0"),
  descontoSimplificado: decimal("descontoSimplificado", { precision: 14, scale: 2 }).notNull().default("0"),
  aliquotaFixa: decimal("aliquotaFixa", { precision: 8, scale: 4 }).notNull().default("0"),
  ativo: boolean("ativo").notNull().default(true),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaTipoVigenciaIndice: index("tabelas_tributarias_rh_empresa_tipo_vigencia_indice").on(table.empresaId, table.tipo, table.vigenciaInicio),
}));

export const faixasTributariasRh = mysqlTable("faixasTributariasRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  tabelaTributariaId: int("tabelaTributariaId").notNull(),
  limiteInferior: decimal("limiteInferior", { precision: 14, scale: 2 }).notNull().default("0"),
  limiteSuperior: decimal("limiteSuperior", { precision: 14, scale: 2 }),
  aliquota: decimal("aliquota", { precision: 8, scale: 4 }).notNull(),
  parcelaDeduzir: decimal("parcelaDeduzir", { precision: 14, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tabelaFaixaUnica: uniqueIndex("faixas_tributarias_rh_tabela_inferior_unico").on(table.tabelaTributariaId, table.limiteInferior),
}));

/** Regras adicionais do IRRF aplicadas após a tabela progressiva e versionadas junto da tabela tributária. */
export const regrasReducaoIrrfRh = mysqlTable("regrasReducaoIrrfRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  tabelaTributariaId: int("tabelaTributariaId").notNull(),
  tipo: mysqlEnum("tipo", ["zera_imposto", "formula_linear"]).notNull(),
  limiteInferior: decimal("limiteInferior", { precision: 14, scale: 2 }).notNull().default("0"),
  limiteSuperior: decimal("limiteSuperior", { precision: 14, scale: 2 }),
  valorMaximo: decimal("valorMaximo", { precision: 14, scale: 2 }).notNull().default("0"),
  constante: decimal("constante", { precision: 16, scale: 6 }).notNull().default("0"),
  coeficiente: decimal("coeficiente", { precision: 16, scale: 6 }).notNull().default("0"),
  ordem: int("ordem").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  tabelaOrdemUnica: uniqueIndex("regras_reducao_irrf_rh_tabela_ordem_unico").on(table.tabelaTributariaId, table.ordem),
}));

export type TabelaTributariaRh = typeof tabelasTributariasRh.$inferSelect;
export type FaixaTributariaRh = typeof faixasTributariasRh.$inferSelect;
export type RegraReducaoIrrfRh = typeof regrasReducaoIrrfRh.$inferSelect;

export const folhasPagamentoRh = mysqlTable("folhasPagamentoRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  competencia: timestamp("competencia").notNull(),
  estado: mysqlEnum("estado", ["aberta", "fechada"]).notNull().default("aberta"),
  observacoes: text("observacoes"),
  fechadaEm: timestamp("fechadaEm"),
  fechadaPor: int("fechadaPor"),
  reabertaEm: timestamp("reabertaEm"),
  reabertaPor: int("reabertaPor"),
  motivoReabertura: text("motivoReabertura"),
  tituloEncargosFinanceiroId: int("tituloEncargosFinanceiroId").unique(),
  criadoPor: int("criadoPor").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  empresaCompetenciaUnica: uniqueIndex("folhas_pagamento_rh_empresa_competencia_unico").on(table.empresaId, table.competencia),
}));

export type FolhaPagamentoRh = typeof folhasPagamentoRh.$inferSelect;

export const itensFolhaPagamentoRh = mysqlTable("itensFolhaPagamentoRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  folhaId: int("folhaId").notNull(),
  colaboradorId: int("colaboradorId").notNull(),
  salarioBase: decimal("salarioBase", { precision: 14, scale: 2 }).notNull(),
  totalProventos: decimal("totalProventos", { precision: 14, scale: 2 }).notNull().default("0"),
  inss: decimal("inss", { precision: 14, scale: 2 }).notNull().default("0"),
  baseIrrf: decimal("baseIrrf", { precision: 14, scale: 2 }).notNull().default("0"),
  irrf: decimal("irrf", { precision: 14, scale: 2 }).notNull().default("0"),
  deducoesLegaisIrrf: decimal("deducoesLegaisIrrf", { precision: 14, scale: 2 }).notNull().default("0"),
  descontoSimplificadoIrrf: decimal("descontoSimplificadoIrrf", { precision: 14, scale: 2 }).notNull().default("0"),
  metodoDeducaoIrrf: mysqlEnum("metodoDeducaoIrrf", ["legal", "simplificado", "nenhum"]),
  tabelaIrrfId: int("tabelaIrrfId"),
  memoriaIrrf: text("memoriaIrrf"),
  adiantamentos: decimal("adiantamentos", { precision: 14, scale: 2 }).notNull().default("0"),
  outrosDescontos: decimal("outrosDescontos", { precision: 14, scale: 2 }).notNull().default("0"),
  totalDescontos: decimal("totalDescontos", { precision: 14, scale: 2 }).notNull().default("0"),
  salarioLiquido: decimal("salarioLiquido", { precision: 14, scale: 2 }).notNull(),
  fgts: decimal("fgts", { precision: 14, scale: 2 }).notNull().default("0"),
  custoEmpresa: decimal("custoEmpresa", { precision: 14, scale: 2 }).notNull(),
  tituloFinanceiroId: int("tituloFinanceiroId").unique(),
  criadoAt: timestamp("criadoAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  folhaColaboradorUnico: uniqueIndex("itens_folha_pagamento_rh_folha_colaborador_unico").on(table.empresaId, table.folhaId, table.colaboradorId),
}));

export type ItemFolhaPagamentoRh = typeof itensFolhaPagamentoRh.$inferSelect;

export const eventosItensFolhaRh = mysqlTable("eventosItensFolhaRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  itemFolhaId: int("itemFolhaId").notNull(),
  eventoId: int("eventoId"),
  descricao: varchar("descricao", { length: 300 }).notNull(),
  tipo: mysqlEnum("tipo", ["provento", "desconto", "informativo"]).notNull(),
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull(),
  incideInss: boolean("incideInss").notNull().default(false),
  incideIrrf: boolean("incideIrrf").notNull().default(false),
  deduzIrrf: boolean("deduzIrrf").notNull().default(false),
  incideFgts: boolean("incideFgts").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EventoItemFolhaRh = typeof eventosItensFolhaRh.$inferSelect;

export const auditoriasRh = mysqlTable("auditoriasRh", {
  id: int("id").autoincrement().primaryKey(),
  empresaId: int("empresaId").notNull(),
  entidade: varchar("entidade", { length: 80 }).notNull(),
  entidadeId: int("entidadeId").notNull(),
  acao: varchar("acao", { length: 80 }).notNull(),
  detalhes: text("detalhes"),
  usuarioId: int("usuarioId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  entidadeIndice: index("auditorias_rh_entidade_indice").on(table.empresaId, table.entidade, table.entidadeId),
}));

export type AuditoriaRh = typeof auditoriasRh.$inferSelect;
