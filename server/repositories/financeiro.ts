import { eq, and, asc, desc, gte, lte, ne, inArray, or, sql, type InferSelectModel, type SQL } from "drizzle-orm";
import {
  InsertUser, users, madeiras, bitolas, clientes,
  orcamentos, itensOrcamento, componentesPacoteOrcamento, taxasAdicionaisOrcamento, produtosComerciais, componentesProdutoComercial, modelosMedidaVenda, historicoAlteracoes, empresaConfiguracoes,
  empresas, credenciaisUsuarios, convitesEmpresa, recuperacoesSenha,
  fornecedores, categoriasFinanceiras, contasFinanceiras, titulosFinanceiros, sequenciasVendas, sequenciasDocumentos,
  baixasFinanceiras, chequesFinanceiros, recorrenciasFinanceiras, configuracoesFinanceiras, alertasFinanceiros, extratosBancarios, movimentosExtratoBancario, anexosFinanceiros, transferenciasFinanceiras, movimentosTransferenciasFinanceiras, vinculosConciliacaoBancaria, auditoriasConciliacaoBancaria,
  plaquetas, conferenciasVariacaoPlaquetas, romaneiosCargaToras, romaneiosProducao, itensRomaneioToras, itensRomaneioProducao, aproveitamentosRomaneioProducao, aproveitamentosOrcamento, serragensTerceiros, itensSerragemToras, itensSerragemPecas, retiradasSerragemTerceiros, itensRetiradaSerragemTerceiros, lotesPecasSerradas, movimentacoesPlaquetas, movimentacoesEstoqueSerrado, notasDiesel, abastecimentosDiesel,
  type InsertMadeira, type InsertBitola, type InsertCliente,
  type InsertOrcamento, type InsertItemOrcamento, type InsertComponentePacoteOrcamento, type InsertProdutoComercial, type InsertComponenteProdutoComercial, type InsertModeloMedidaVenda, type InsertFornecedor,
  type InsertCategoriaFinanceira, type InsertContaFinanceira,
  type InsertTituloFinanceiro, type InsertBaixaFinanceira, type InsertChequeFinanceiro, type InsertRecorrenciaFinanceira, type TransferenciaFinanceira,
} from "../../drizzle/schema";
import { ENV } from '../_core/env';
import { calcularCicloTituloFinanceiro, calcularEstadoTitulo, calcularParcelas, calcularPrevisaoSemanal, calcularRelatorioFluxoCaixa, classificarAlertaCompensacaoCheque, decimalParaNumero, planejarAtualizacaoAlertas, podeCancelarTituloFinanceiro, podeEstornarBaixa, proximoVencimento, saldoAbertoTitulo, tipoAlertaAtualDoTitulo, validarDepositoCheque, validarDevolucaoCheque, validarEdicaoTituloFinanceiro, validarExclusaoTituloFinanceiro, validarTransferenciaFinanceira, validarValorBaixaContraSaldo, validarValorDosCheques } from "../financeiro.logic";
import { criarModeloCsvLancamentos, exportarLancamentosCsv, prepararImportacaoLancamentos } from "../financeiro.intercambio";
import { criarModeloCsvFornecedores, prepararImportacaoFornecedores } from "../fornecedores.intercambio";
import { criarModeloCsvPlaquetasCarga, prepararImportacaoPlaquetasCarga } from "../estoque.intercambio";
import { alocarPecasPermitindoNegativo, agruparEstoquePecas, calcularItemRomaneio, calcularVolumeToraCilindrica, converterDimensoesVendaParaEstoque, normalizarCodigoPlaqueta, validarConfirmacaoRomaneio, validarExclusaoRomaneioProducao, validarRetiradaSerragemTerceiros, validarSerragemTerceiros, type ItemProducaoEntrada } from "../producao.logic";
import { calcularRelatorioInventarioSerrado } from "../inventario.logic";
import { calcularIndicadoresMargemVenda } from "../margemVendas.logic";
import { montarPerfilCliente } from "../clientePerfil.logic";
import { criarModeloCsvPecasProducao, criarModeloCsvTorasProducao, criarModeloCsvTorasSerragemTerceiros, prepararImportacaoTorasProducao, validarCsvPecasProducao, validarCsvTorasSerragemTerceiros } from "../producao.intercambio";
import { calcularCustoAbastecimentoDiesel, calcularResumoTanqueDiesel, validarExclusaoNotaDiesel } from "../diesel.logic";
import { criarModeloCsvExtratoBancario, prepararImportacaoExtrato } from "../conciliacao.intercambio";
import { sugerirConciliacoes, sugerirTransferenciasInternas } from "../conciliacao.logic";
import { montarFluxoCaixaGerencial } from "../fluxo-caixa.logic";
import { calcularContaOperacional, ordenarContasOperacionais, resumirContasOperacionais } from "../contas-operacionais.logic";
import { numerarDuplicidadesPlaquetas } from "../../shared/plaquetas";

import { getDb } from "./core";
import { getInsertedId } from "./catalogo";
import { listarCentrosCusto, obterCentroCustoAtivo } from "./centrosCusto";
import { getEmpresaUnica } from "./identidade";

type MysqlInsertResult = readonly [{ insertId?: number | bigint }, unknown];
type DatabaseConnection = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type TituloFinanceiro = InferSelectModel<typeof titulosFinanceiros>;
type CategoriaFinanceira = InferSelectModel<typeof categoriasFinanceiras>;
type Fornecedor = InferSelectModel<typeof fornecedores>;
type AtualizacaoCabecalhoCarga = Partial<typeof romaneiosCargaToras.$inferInsert>;
type AtualizacaoCabecalhoSerragem = Partial<typeof serragensTerceiros.$inferInsert>;
type EstadoOrcamento = InferSelectModel<typeof orcamentos>["estado"];
type AtualizacaoCabecalhoProducao = Partial<typeof romaneiosProducao.$inferInsert>;

type ResultadoCicloTituloFinanceiro = ReturnType<typeof calcularCicloTituloFinanceiro> & {
  valorBaixadoFormatado: string;
};

async function criarOuReativarVinculoConciliacao(
  database: any,
  input: {
    empresaId: number;
    movimentoExtratoBancarioId: number;
    baixaFinanceiraId?: number;
    movimentoTransferenciaFinanceiraId?: number;
    tipo: "baixa_existente" | "baixa_gerada" | "transferencia";
    valorVinculado: string | number;
    criadoPor: number;
  },
): Promise<number> {
  const campo = input.baixaFinanceiraId ? vinculosConciliacaoBancaria.baixaFinanceiraId : vinculosConciliacaoBancaria.movimentoTransferenciaFinanceiraId;
  const valor = input.baixaFinanceiraId ?? input.movimentoTransferenciaFinanceiraId;
  if (!valor) throw new Error("Informe uma baixa ou movimento de transferência para a conciliação");
  const existente = (await database.select().from(vinculosConciliacaoBancaria)
    .where(and(eq(vinculosConciliacaoBancaria.empresaId, input.empresaId), eq(campo, valor))).for("update").limit(1))[0];
  if (existente) {
    if (!existente.desfeitoEm) throw new Error("Este registro financeiro já está conciliado em outro movimento bancário");
    await database.update(vinculosConciliacaoBancaria).set({
      movimentoExtratoBancarioId: input.movimentoExtratoBancarioId,
      baixaFinanceiraId: input.baixaFinanceiraId ?? null,
      movimentoTransferenciaFinanceiraId: input.movimentoTransferenciaFinanceiraId ?? null,
      tipo: input.tipo,
      valorVinculado: String(input.valorVinculado),
      criadoPor: input.criadoPor,
      desfeitoEm: null,
      desfeitoPor: null,
      motivoDesfeito: null,
    }).where(eq(vinculosConciliacaoBancaria.id, existente.id));
    return existente.id;
  }
  const inserido = await database.insert(vinculosConciliacaoBancaria).values({
    empresaId: input.empresaId,
    movimentoExtratoBancarioId: input.movimentoExtratoBancarioId,
    baixaFinanceiraId: input.baixaFinanceiraId,
    movimentoTransferenciaFinanceiraId: input.movimentoTransferenciaFinanceiraId,
    tipo: input.tipo,
    valorVinculado: String(input.valorVinculado),
    criadoPor: input.criadoPor,
  });
  return getInsertedId(inserido as MysqlInsertResult);
}

/**
 * Materializa o ciclo de um título a partir das baixas válidas persistidas.
 * Esta é a única rotina do repositório autorizada a atualizar conjuntamente
 * `valorBaixado` e `estado` depois que um título já foi criado.
 */
async function reconciliarCicloTituloFinanceiro(
  database: any,
  titulo: TituloFinanceiro,
  empresaId: number,
  agora?: Date,
  cancelado = titulo.estado === "cancelado",
): Promise<ResultadoCicloTituloFinanceiro> {
  const baixas = await database.select({
    valor: baixasFinanceiras.valor,
    estornada: baixasFinanceiras.estornada,
  }).from(baixasFinanceiras).where(and(
    eq(baixasFinanceiras.tituloId, titulo.id),
    eq(baixasFinanceiras.empresaId, empresaId),
  ));
  const ciclo = calcularCicloTituloFinanceiro({
    valorOriginal: titulo.valorOriginal,
    desconto: titulo.desconto,
    juros: titulo.juros,
    dataVencimento: titulo.dataVencimento,
    baixas,
    cancelado,
    agora,
  });
  const valorBaixadoFormatado = ciclo.valorBaixado.toFixed(2);
  await database.update(titulosFinanceiros).set({
    valorBaixado: valorBaixadoFormatado,
    estado: ciclo.estado,
  }).where(and(
    eq(titulosFinanceiros.id, titulo.id),
    eq(titulosFinanceiros.empresaId, empresaId),
  ));
  return { ...ciclo, valorBaixadoFormatado };
}

// ─── Financeiro ───
export type TipoTituloFinanceiro = "receber" | "pagar";
export type OrigemTituloFinanceiro = "orcamento" | "romaneio_carga" | "nota_diesel" | "serragem_terceiros" | "folha_pagamento" | "manual" | "recorrencia";

export type CriarTituloFinanceiroInput = {
  tipo: TipoTituloFinanceiro;
  origem?: OrigemTituloFinanceiro;
  chaveImportacao?: string | null;
  descricao: string;
  categoriaId: number;
  centroCustoId?: number | null;
  valorOriginal: string;
  dataEmissao: Date;
  dataVencimento: Date;
  competencia?: Date | null;
  criadoPor: number;
  /** @deprecated O escopo é obtido da configuração empresarial única. */
  empresaId?: number;
  clienteId?: number | null;
  fornecedorId?: number | null;
  contraparteNome?: string | null;
  orcamentoId?: number | null;
  recorrenciaId?: number | null;
  grupoParcelamento?: string | null;
  numeroParcela?: number | null;
  totalParcelas?: number | null;
  desconto?: string;
  juros?: string;
  observacoes?: string | null;
};

export type GarantirTituloComChaveInput = Omit<CriarTituloFinanceiroInput, "empresaId" | "chaveImportacao"> & {
  origem: OrigemTituloFinanceiro;
  chaveIdempotencia: string;
  romaneioCargaId?: number | null;
  notaDieselId?: number | null;
  serragemTerceirosId?: number | null;
  database?: DatabaseConnection | any;
};

/** Contrato semântico dos eventos automáticos de domínio. */
export type GarantirTituloAutomaticoInput = GarantirTituloComChaveInput & {
  origem: Exclude<OrigemTituloFinanceiro, "manual">;
};

export async function listFornecedores() {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fornecedores).where(and(eq(fornecedores.ativo, true), eq(fornecedores.empresaId, empresaId))).orderBy(desc(fornecedores.createdAt));
}

export async function createFornecedor(data: InsertFornecedor) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(fornecedores).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

export function getModeloImportacaoFornecedoresCsv() {
  return criarModeloCsvFornecedores();
}

export async function prepararImportacaoFornecedoresCsv(
  conteudo: string,
  dependencias: { database?: any; empresaId: number; fornecedoresExistentes?: Array<{ id: number; nome: string; email?: string | null; documento?: string | null }> },
) {
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const fornecedoresExistentes = dependencias?.fornecedoresExistentes ?? await db.select({
    id: fornecedores.id,
    nome: fornecedores.nome,
    email: fornecedores.email,
    documento: fornecedores.documento,
  }).from(fornecedores).where(eq(fornecedores.empresaId, dependencias.empresaId));
  return prepararImportacaoFornecedores({ conteudo, fornecedoresExistentes });
}

export async function importarFornecedoresCsv(
  conteudo: string,
  userId: number,
  dependencias?: { database?: any; fornecedoresExistentes?: Array<{ id: number; nome: string; email?: string | null; documento?: string | null }> },
) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const preparo = await prepararImportacaoFornecedoresCsv(conteudo, { database: db, empresaId, fornecedoresExistentes: dependencias?.fornecedoresExistentes });
  if (preparo.erros.length) return { importados: 0, erros: preparo.erros };
  await db.transaction(async (tx: any) => {
    await tx.insert(fornecedores).values(preparo.linhas.map((linha) => ({
      nome: linha.nome,
      contacto: linha.contacto,
      email: linha.email,
      documento: linha.documento,
      endereco: linha.endereco,
      observacoes: linha.observacoes,
      ativo: true,
      criadoPor: userId,
      empresaId,
    })));
  });
  return { importados: preparo.linhas.length, erros: [] as string[] };
}

export async function updateFornecedor(id: number, data: Partial<InsertFornecedor>) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(fornecedores).set(data).where(and(eq(fornecedores.id, id), eq(fornecedores.empresaId, empresaId)));
  return { success: true };
}

export async function archiveFornecedor(id: number) {
  const empresaId = (await getEmpresaUnica()).id;
  return updateFornecedor(id, { ativo: false });
}

export async function listCategoriasFinanceiras() {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categoriasFinanceiras).where(and(eq(categoriasFinanceiras.ativo, true), eq(categoriasFinanceiras.empresaId, empresaId))).orderBy(desc(categoriasFinanceiras.createdAt));
}

export async function createCategoriaFinanceira(data: InsertCategoriaFinanceira) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(categoriasFinanceiras).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

export async function updateCategoriaFinanceira(id: number, data: Partial<InsertCategoriaFinanceira>) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(categoriasFinanceiras).set(data).where(and(eq(categoriasFinanceiras.id, id), eq(categoriasFinanceiras.empresaId, empresaId)));
  return { success: true };
}

export async function listContasFinanceiras() {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contasFinanceiras).where(and(eq(contasFinanceiras.ativa, true), eq(contasFinanceiras.empresaId, empresaId))).orderBy(desc(contasFinanceiras.createdAt));
}

export async function createContaFinanceira(data: InsertContaFinanceira) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(contasFinanceiras).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

export async function updateContaFinanceira(id: number, data: Partial<InsertContaFinanceira>) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(contasFinanceiras).set(data).where(and(eq(contasFinanceiras.id, id), eq(contasFinanceiras.empresaId, empresaId)));
  return { success: true };
}

/** Exclui uma conta apenas quando não existir dependência financeira, bancária ou programada. */
export async function excluirContaFinanceira(id: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conta = (await db.select({ id: contasFinanceiras.id }).from(contasFinanceiras)
    .where(and(eq(contasFinanceiras.id, id), eq(contasFinanceiras.empresaId, empresaId))).limit(1))[0];
  if (!conta) throw new Error("Conta financeira não encontrada");
  const [baixa, cheque, chequeDestino, extrato, movimentoExtrato, recorrencia, transferenciaOrigem, transferenciaDestino, movimentoTransferencia] = await Promise.all([
    db.select({ id: baixasFinanceiras.id }).from(baixasFinanceiras).where(and(eq(baixasFinanceiras.empresaId, empresaId), eq(baixasFinanceiras.contaFinanceiraId, id))).limit(1),
    db.select({ id: chequesFinanceiros.id }).from(chequesFinanceiros).where(and(eq(chequesFinanceiros.empresaId, empresaId), eq(chequesFinanceiros.contaFinanceiraId, id))).limit(1),
    db.select({ id: chequesFinanceiros.id }).from(chequesFinanceiros).where(and(eq(chequesFinanceiros.empresaId, empresaId), eq(chequesFinanceiros.contaDestinoId, id))).limit(1),
    db.select({ id: extratosBancarios.id }).from(extratosBancarios).where(and(eq(extratosBancarios.empresaId, empresaId), eq(extratosBancarios.contaFinanceiraId, id))).limit(1),
    db.select({ id: movimentosExtratoBancario.id }).from(movimentosExtratoBancario).where(and(eq(movimentosExtratoBancario.empresaId, empresaId), eq(movimentosExtratoBancario.contaFinanceiraId, id))).limit(1),
    db.select({ id: recorrenciasFinanceiras.id }).from(recorrenciasFinanceiras).where(and(eq(recorrenciasFinanceiras.empresaId, empresaId), eq(recorrenciasFinanceiras.contaFinanceiraId, id))).limit(1),
    db.select({ id: transferenciasFinanceiras.id }).from(transferenciasFinanceiras).where(and(eq(transferenciasFinanceiras.empresaId, empresaId), eq(transferenciasFinanceiras.contaOrigemId, id))).limit(1),
    db.select({ id: transferenciasFinanceiras.id }).from(transferenciasFinanceiras).where(and(eq(transferenciasFinanceiras.empresaId, empresaId), eq(transferenciasFinanceiras.contaDestinoId, id))).limit(1),
    db.select({ id: movimentosTransferenciasFinanceiras.id }).from(movimentosTransferenciasFinanceiras).where(and(eq(movimentosTransferenciasFinanceiras.empresaId, empresaId), eq(movimentosTransferenciasFinanceiras.contaFinanceiraId, id))).limit(1),
  ]);
  if (baixa.length || cheque.length || chequeDestino.length || extrato.length || movimentoExtrato.length || recorrencia.length || transferenciaOrigem.length || transferenciaDestino.length || movimentoTransferencia.length) {
    throw new Error("Esta conta não pode ser excluída porque possui movimentações, transferências, cheques, extratos ou recorrências vinculados");
  }
  await db.delete(contasFinanceiras).where(and(eq(contasFinanceiras.id, id), eq(contasFinanceiras.empresaId, empresaId)));
  return { success: true };
}

type CriarTransferenciaFinanceiraInput = {
  contaOrigemId: number;
  contaDestinoId: number;
  valor: string | number;
  dataTransferencia: Date;
  descricao?: string | null;
  observacoes?: string | null;
  criadoPor: number;
};

function descricaoTransferencia(input: {
  descricao?: string | null;
  origemNome: string;
  destinoNome: string;
}) {
  return input.descricao?.trim() || `Transferência de ${input.origemNome} para ${input.destinoNome}`;
}

async function contasDaTransferencia(
  database: any,
  empresaId: number,
  contaOrigemId: number,
  contaDestinoId: number,
) {
  const contas: Array<{ id: number; nome: string; ativa: boolean | number | null }> = await database.select().from(contasFinanceiras).where(and(
    eq(contasFinanceiras.empresaId, empresaId),
    inArray(contasFinanceiras.id, [contaOrigemId, contaDestinoId]),
  )).for("update");
  const origem = contas.find((conta) => conta.id === contaOrigemId);
  const destino = contas.find((conta) => conta.id === contaDestinoId);
  if (!origem) throw new Error("Conta de origem não encontrada");
  if (!destino) throw new Error("Conta de destino não encontrada");
  return { origem, destino };
}

async function registrarMovimentosTransferencia(
  database: any,
  input: {
    transferenciaId: number;
    empresaId: number;
    contaOrigemId: number;
    contaDestinoId: number;
    valor: string;
    dataTransferencia: Date;
    origemNome: string;
    destinoNome: string;
    prefixoDescricao?: string;
  },
) {
  const prefixo = input.prefixoDescricao ? `${input.prefixoDescricao}: ` : "";
  await database.insert(movimentosTransferenciasFinanceiras).values([
    {
      empresaId: input.empresaId,
      transferenciaId: input.transferenciaId,
      contaFinanceiraId: input.contaOrigemId,
      tipo: "saida",
      valor: input.valor,
      dataMovimento: input.dataTransferencia,
      descricao: `${prefixo}Transferência para ${input.destinoNome}`,
    },
    {
      empresaId: input.empresaId,
      transferenciaId: input.transferenciaId,
      contaFinanceiraId: input.contaDestinoId,
      tipo: "entrada",
      valor: input.valor,
      dataMovimento: input.dataTransferencia,
      descricao: `${prefixo}Transferência de ${input.origemNome}`,
    },
  ]);
}

/**
 * Registra a movimentação patrimonial entre duas contas da empresa.
 * Não cria título financeiro, baixa, categoria, receita ou despesa.
 */
export async function criarTransferenciaFinanceira(input: CriarTransferenciaFinanceiraInput) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const { origem, destino } = await contasDaTransferencia(tx, empresaId, input.contaOrigemId, input.contaDestinoId);
    const valor = validarTransferenciaFinanceira({
      contaOrigemId: origem.id,
      contaDestinoId: destino.id,
      valor: input.valor,
      contaOrigemAtiva: Boolean(origem.ativa),
      contaDestinoAtiva: Boolean(destino.ativa),
    });
    const valorFormatado = valor.toFixed(2);
    const descricao = descricaoTransferencia({ ...input, origemNome: origem.nome, destinoNome: destino.nome });
    const resultado = await tx.insert(transferenciasFinanceiras).values({
      empresaId,
      contaOrigemId: origem.id,
      contaDestinoId: destino.id,
      valor: valorFormatado,
      dataTransferencia: input.dataTransferencia,
      descricao,
      observacoes: input.observacoes?.trim() || null,
      estado: "efetivada",
      criadoPor: input.criadoPor,
    });
    const transferenciaId = getInsertedId(resultado as MysqlInsertResult);
    await registrarMovimentosTransferencia(tx, {
      transferenciaId,
      empresaId,
      contaOrigemId: origem.id,
      contaDestinoId: destino.id,
      valor: valorFormatado,
      dataTransferencia: input.dataTransferencia,
      origemNome: origem.nome,
      destinoNome: destino.nome,
    });
    return { success: true, transferenciaId };
  });
}

export async function listTransferenciasFinanceiras(filtros: { contaFinanceiraId?: number; incluirEstornadas?: boolean } = {}) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [eq(transferenciasFinanceiras.empresaId, empresaId)];
  if (filtros.contaFinanceiraId) {
    conditions.push(or(
      eq(transferenciasFinanceiras.contaOrigemId, filtros.contaFinanceiraId),
      eq(transferenciasFinanceiras.contaDestinoId, filtros.contaFinanceiraId),
    ) as SQL);
  }
  if (!filtros.incluirEstornadas) conditions.push(eq(transferenciasFinanceiras.estado, "efetivada"));
  const transferencias = await db.select().from(transferenciasFinanceiras)
    .where(and(...conditions)).orderBy(desc(transferenciasFinanceiras.dataTransferencia), desc(transferenciasFinanceiras.id));
  const contaIds = Array.from(new Set(transferencias.flatMap((transferencia) => [transferencia.contaOrigemId, transferencia.contaDestinoId])));
  const contas = contaIds.length ? await db.select({ id: contasFinanceiras.id, nome: contasFinanceiras.nome })
    .from(contasFinanceiras).where(and(eq(contasFinanceiras.empresaId, empresaId), inArray(contasFinanceiras.id, contaIds))) : [];
  const nomes = new Map(contas.map((conta) => [conta.id, conta.nome]));
  return transferencias.map((transferencia) => ({
    ...transferencia,
    contaOrigemNome: nomes.get(transferencia.contaOrigemId) ?? "Conta de origem removida",
    contaDestinoNome: nomes.get(transferencia.contaDestinoId) ?? "Conta de destino removida",
  }));
}

export async function listMovimentosTransferenciasPorConta(contaFinanceiraId: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  return db.select().from(movimentosTransferenciasFinanceiras).where(and(
    eq(movimentosTransferenciasFinanceiras.empresaId, empresaId),
    eq(movimentosTransferenciasFinanceiras.contaFinanceiraId, contaFinanceiraId),
  )).orderBy(desc(movimentosTransferenciasFinanceiras.dataMovimento), desc(movimentosTransferenciasFinanceiras.id));
}

/** Estorna por uma nova transferência inversa, mantendo a trilha de auditoria íntegra. */
export async function estornarTransferenciaFinanceira(input: { id: number; motivo: string; estornadoPor: number }) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const motivo = input.motivo.trim();
  if (motivo.length < 3) throw new Error("Informe o motivo do estorno da transferência");
  return db.transaction(async (tx) => {
    const transferencia = (await tx.select().from(transferenciasFinanceiras).where(and(
      eq(transferenciasFinanceiras.id, input.id),
      eq(transferenciasFinanceiras.empresaId, empresaId),
    )).for("update").limit(1))[0] as TransferenciaFinanceira | undefined;
    if (!transferencia) throw new Error("Transferência não encontrada");
    if (transferencia.estado !== "efetivada") throw new Error("Esta transferência já foi estornada");
    const { origem, destino } = await contasDaTransferencia(tx, empresaId, transferencia.contaOrigemId, transferencia.contaDestinoId);
    validarTransferenciaFinanceira({
      contaOrigemId: destino.id,
      contaDestinoId: origem.id,
      valor: transferencia.valor,
      contaOrigemAtiva: Boolean(destino.ativa),
      contaDestinoAtiva: Boolean(origem.ativa),
    });
    const [atualizacao] = await tx.update(transferenciasFinanceiras).set({
      estado: "estornada",
      estornadaEm: new Date(),
      estornadaPor: input.estornadoPor,
      motivoEstorno: motivo,
    }).where(and(
      eq(transferenciasFinanceiras.id, transferencia.id),
      eq(transferenciasFinanceiras.empresaId, empresaId),
      eq(transferenciasFinanceiras.estado, "efetivada"),
    ));
    if (atualizacao.affectedRows !== 1) throw new Error("Esta transferência já foi estornada");
    const descricao = `Estorno da transferência #${transferencia.id}: ${motivo}`;
    const resultado = await tx.insert(transferenciasFinanceiras).values({
      empresaId,
      contaOrigemId: destino.id,
      contaDestinoId: origem.id,
      valor: transferencia.valor,
      dataTransferencia: new Date(),
      descricao,
      observacoes: `Operação inversa da transferência #${transferencia.id}`,
      estado: "efetivada",
      transferenciaOrigemId: transferencia.id,
      criadoPor: input.estornadoPor,
    });
    const estornoId = getInsertedId(resultado as MysqlInsertResult);
    await registrarMovimentosTransferencia(tx, {
      transferenciaId: estornoId,
      empresaId,
      contaOrigemId: destino.id,
      contaDestinoId: origem.id,
      valor: String(transferencia.valor),
      dataTransferencia: new Date(),
      origemNome: destino.nome,
      destinoNome: origem.nome,
      prefixoDescricao: "Estorno",
    });
    return { success: true, transferenciaId: transferencia.id, estornoId };
  });
}

export async function listCaixasCheque() {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contasFinanceiras)
    .where(and(eq(contasFinanceiras.empresaId, empresaId), eq(contasFinanceiras.ativa, true), eq(contasFinanceiras.tipo, "caixa_cheque")))
    .orderBy(desc(contasFinanceiras.createdAt));
}

export async function listChequesFinanceiros(
  filters: { contaFinanceiraId?: number; estado?: "disponivel" | "utilizado" | "estornado" | "depositado" },
) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(chequesFinanceiros.empresaId, empresaId)];
  if (filters.contaFinanceiraId) conditions.push(eq(chequesFinanceiros.contaFinanceiraId, filters.contaFinanceiraId));
  if (filters.estado) conditions.push(eq(chequesFinanceiros.estado, filters.estado));
  const cheques = await db.select({
    id: chequesFinanceiros.id,
    contaFinanceiraId: chequesFinanceiros.contaFinanceiraId,
    baixaEntradaId: chequesFinanceiros.baixaEntradaId,
    baixaSaidaId: chequesFinanceiros.baixaSaidaId,
    clienteId: chequesFinanceiros.clienteId,
    referencia: chequesFinanceiros.referencia,
    valor: chequesFinanceiros.valor,
    dataRecebimento: chequesFinanceiros.dataRecebimento,
    dataCompensacao: chequesFinanceiros.dataCompensacao,
    utilizadoEm: chequesFinanceiros.utilizadoEm,
    depositadoEm: chequesFinanceiros.depositadoEm,
    contaDestinoId: chequesFinanceiros.contaDestinoId,
    estado: chequesFinanceiros.estado,
    estornadoEm: chequesFinanceiros.estornadoEm,
    contaNome: contasFinanceiras.nome,
    clienteNome: clientes.nome,
  }).from(chequesFinanceiros)
    .innerJoin(contasFinanceiras, eq(chequesFinanceiros.contaFinanceiraId, contasFinanceiras.id))
    .innerJoin(clientes, eq(chequesFinanceiros.clienteId, clientes.id))
    .where(and(...conditions))
    .orderBy(desc(chequesFinanceiros.dataRecebimento), desc(chequesFinanceiros.createdAt));
  const destinoIds = Array.from(new Set(cheques.map((cheque) => cheque.contaDestinoId).filter((id): id is number => id !== null)));
  const destinos = destinoIds.length
    ? await db.select({ id: contasFinanceiras.id, nome: contasFinanceiras.nome }).from(contasFinanceiras)
      .where(and(eq(contasFinanceiras.empresaId, empresaId), inArray(contasFinanceiras.id, destinoIds)))
    : [];
  const destinoPorId = new Map(destinos.map((conta) => [conta.id, conta.nome]));
  return cheques.map((cheque) => ({
    ...cheque,
    contaDestinoNome: cheque.contaDestinoId ? destinoPorId.get(cheque.contaDestinoId) ?? "Conta bancária removida" : null,
    alertaCompensacao: cheque.estado === "disponivel" ? classificarAlertaCompensacaoCheque(cheque.dataCompensacao) : null,
  }));
}

/** Histórico auditável de cheques transferidos do Caixa Cheque para contas bancárias. */
export async function listHistoricoDepositosPorConta(contaFinanceiraId: number | undefined) {
  const empresaId = (await getEmpresaUnica()).id;
  const cheques = await listChequesFinanceiros({ estado: "depositado" });
  return cheques
    .filter((cheque) => !contaFinanceiraId || cheque.contaDestinoId === contaFinanceiraId)
    .sort((a, b) => new Date(b.depositadoEm ?? 0).getTime() - new Date(a.depositadoEm ?? 0).getTime() || b.id - a.id);
}

/**
 * Registra a transferência interna de um cheque em carteira para uma conta bancária.
 * Não cria baixa financeira: a entrada já ocorreu no recebimento e o fluxo de caixa permanece neutro.
 */
export async function depositarChequeFinanceiro(input: {
  id: number;
  contaDestinoId: number;
  dataDeposito: Date;
}) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [cheque, contaDestino] = await Promise.all([
    db.select().from(chequesFinanceiros)
      .where(and(eq(chequesFinanceiros.id, input.id), eq(chequesFinanceiros.empresaId, empresaId))).limit(1),
    db.select().from(contasFinanceiras)
      .where(and(eq(contasFinanceiras.id, input.contaDestinoId), eq(contasFinanceiras.empresaId, empresaId))).limit(1),
  ]);
  if (!cheque[0]) throw new Error("Cheque não encontrado");
  if (!contaDestino[0]) throw new Error("Conta bancária de destino não encontrada");
  validarDepositoCheque({
    estado: cheque[0].estado,
    contaDestinoTipo: contaDestino[0].tipo,
    contaDestinoAtiva: Boolean(contaDestino[0].ativa),
  });

  const [resultado] = await db.update(chequesFinanceiros).set({
    estado: "depositado",
    depositadoEm: input.dataDeposito,
    contaDestinoId: contaDestino[0].id,
  }).where(and(
    eq(chequesFinanceiros.id, cheque[0].id),
    eq(chequesFinanceiros.empresaId, empresaId),
    eq(chequesFinanceiros.estado, "disponivel"),
  ));
  if (resultado.affectedRows !== 1) {
    throw new Error("Este cheque não está mais disponível para depósito");
  }
  return { success: true, chequeId: cheque[0].id, contaDestinoId: contaDestino[0].id };
}

export async function getResumoCaixaCheque() {
  const empresaId = (await getEmpresaUnica()).id;
  const [contas, cheques] = await Promise.all([
    listCaixasCheque(),
    listChequesFinanceiros({}),
  ]);
  const totalDisponivel = cheques.filter((cheque) => cheque.estado === "disponivel")
    .reduce((total, cheque) => total + decimalParaNumero(cheque.valor), 0);
  const totalUtilizado = cheques.filter((cheque) => cheque.estado === "utilizado")
    .reduce((total, cheque) => total + decimalParaNumero(cheque.valor), 0);
  const totalDepositado = cheques.filter((cheque) => cheque.estado === "depositado")
    .reduce((total, cheque) => total + decimalParaNumero(cheque.valor), 0);
  const alertasCompensacao = cheques.filter((cheque) => cheque.estado === "disponivel")
    .reduce((acumulado, cheque) => {
      const alerta = classificarAlertaCompensacaoCheque(cheque.dataCompensacao);
      if (alerta === "atrasada") acumulado.atrasados += 1;
      if (alerta === "hoje") acumulado.hoje += 1;
      if (alerta === "proxima") acumulado.proximos += 1;
      return acumulado;
    }, { atrasados: 0, hoje: 0, proximos: 0 });
  return {
    contas,
    totalDisponivel,
    totalUtilizado,
    totalDepositado,
    quantidadeDisponivel: cheques.filter((cheque) => cheque.estado === "disponivel").length,
    quantidadeUtilizada: cheques.filter((cheque) => cheque.estado === "utilizado").length,
    quantidadeDepositada: cheques.filter((cheque) => cheque.estado === "depositado").length,
    alertasCompensacao,
  };
}

export async function getOrCreateCategoriaReceitaVendas(userId: number): Promise<number> {
  const empresaId = (await getEmpresaUnica()).id;
const db = await getDb();
if (!db) throw new Error("Database not available");
const existente = await db.select().from(categoriasFinanceiras)
    .where(and(eq(categoriasFinanceiras.nome, "Receitas de vendas"), eq(categoriasFinanceiras.ativo, true), eq(categoriasFinanceiras.empresaId, empresaId))).limit(1);
  if (existente[0]) return existente[0].id;
const result = await db.insert(categoriasFinanceiras).values({
nome: "Receitas de vendas",
tipo: "receita",
ativo: true,
criadoPor: userId,
    empresaId,
});
  return getInsertedId(result as MysqlInsertResult);
}

export async function getOrCreateCategoriaCustoMateriaPrima(tx: any, userId: number): Promise<number> {
  const empresaId = (await getEmpresaUnica()).id;
const existente = await tx.select().from(categoriasFinanceiras)
    .where(and(eq(categoriasFinanceiras.nome, "Custo de matéria-prima"), eq(categoriasFinanceiras.ativo, true), eq(categoriasFinanceiras.empresaId, empresaId))).limit(1);
  if (existente[0]) return existente[0].id;
const result = await tx.insert(categoriasFinanceiras).values({
nome: "Custo de matéria-prima",
tipo: "despesa",
ativo: true,
criadoPor: userId,
    empresaId,
});
  return getInsertedId(result as MysqlInsertResult);
}

export async function getOrCreateContaFinanceiraPadrao(userId: number): Promise<number> {
  const empresaId = (await getEmpresaUnica()).id;
const db = await getDb();
if (!db) throw new Error("Database not available");
const existente = await db.select().from(contasFinanceiras)
    .where(and(eq(contasFinanceiras.nome, "Caixa geral"), eq(contasFinanceiras.ativa, true), eq(contasFinanceiras.empresaId, empresaId))).limit(1);
  if (existente[0]) return existente[0].id;
const result = await db.insert(contasFinanceiras).values({
nome: "Caixa geral",
tipo: "caixa",
saldoInicial: "0",
ativa: true,
criadoPor: userId,
    empresaId,
});
  return getInsertedId(result as MysqlInsertResult);
}

export async function createTituloFinanceiro(input: CriarTituloFinanceiroInput) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!input.descricao.trim()) throw new Error("Informe uma descrição para o lançamento");
  if (decimalParaNumero(input.valorOriginal) <= 0) throw new Error("O valor do título deve ser maior que zero");
  const centroCustoId = input.centroCustoId == null ? null : (await obterCentroCustoAtivo(input.centroCustoId, db, empresaId)).id;
  const data: InsertTituloFinanceiro = {
    tipo: input.tipo,
    origem: input.origem ?? "manual",
    chaveImportacao: input.chaveImportacao ?? null,
    descricao: input.descricao.trim(),
    clienteId: input.clienteId ?? null,
    fornecedorId: input.fornecedorId ?? null,
    contraparteNome: input.contraparteNome ?? null,
    orcamentoId: input.orcamentoId ?? null,
    categoriaId: input.categoriaId,
    centroCustoId,
    recorrenciaId: input.recorrenciaId ?? null,
    grupoParcelamento: input.grupoParcelamento ?? null,
    numeroParcela: input.numeroParcela ?? null,
    totalParcelas: input.totalParcelas ?? null,
    valorOriginal: input.valorOriginal,
    desconto: input.desconto ?? "0",
    juros: input.juros ?? "0",
    valorBaixado: "0",
    dataEmissao: input.dataEmissao,
    dataVencimento: input.dataVencimento,
    competencia: input.competencia ?? null,
    estado: calcularEstadoTitulo({ valorOriginal: input.valorOriginal, dataVencimento: input.dataVencimento }),
    observacoes: input.observacoes ?? null,
    criadoPor: input.criadoPor,
    empresaId,
  };
  const result = await db.insert(titulosFinanceiros).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

/**
 * Garante um título originado por um evento de negócio. A chave é única no banco,
 * portanto tentativas repetidas — inclusive concorrentes — devolvem o mesmo título.
 * O helper não altera títulos existentes, preservando baixas, conciliações e edições
 * financeiras já realizadas.
 */
export async function garantirTituloFinanceiroComChave(input: GarantirTituloComChaveInput) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = input.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const chaveImportacao = input.chaveIdempotencia.trim();
  if (!chaveImportacao) throw new Error("Informe a chave de idempotência do título automático");
  if (!input.descricao.trim()) throw new Error("Informe uma descrição para o lançamento");
  if (decimalParaNumero(input.valorOriginal) <= 0) throw new Error("O valor do título deve ser maior que zero");
  const centroCustoId = input.centroCustoId == null ? null : (await obterCentroCustoAtivo(input.centroCustoId, db, empresaId)).id;

  const existente = (await db.select().from(titulosFinanceiros)
    .where(eq(titulosFinanceiros.chaveImportacao, chaveImportacao)).limit(1))[0];
  if (existente) {
    if (existente.origem !== input.origem) {
      throw new Error("A chave de idempotência já está associada a outra origem financeira");
    }
    return { id: existente.id, criado: false, titulo: existente };
  }

  const data: InsertTituloFinanceiro = {
    empresaId,
    tipo: input.tipo,
    origem: input.origem,
    chaveImportacao,
    descricao: input.descricao.trim(),
    clienteId: input.clienteId ?? null,
    fornecedorId: input.fornecedorId ?? null,
    contraparteNome: input.contraparteNome ?? null,
    orcamentoId: input.orcamentoId ?? null,
    romaneioCargaId: input.romaneioCargaId ?? null,
    notaDieselId: input.notaDieselId ?? null,
    serragemTerceirosId: input.serragemTerceirosId ?? null,
    categoriaId: input.categoriaId,
    centroCustoId,
    recorrenciaId: input.recorrenciaId ?? null,
    grupoParcelamento: input.grupoParcelamento ?? null,
    numeroParcela: input.numeroParcela ?? null,
    totalParcelas: input.totalParcelas ?? null,
    valorOriginal: input.valorOriginal,
    desconto: input.desconto ?? "0",
    juros: input.juros ?? "0",
    valorBaixado: "0",
    dataEmissao: input.dataEmissao,
    dataVencimento: input.dataVencimento,
    competencia: input.competencia ?? null,
    estado: calcularEstadoTitulo({ valorOriginal: input.valorOriginal, dataVencimento: input.dataVencimento }),
    observacoes: input.observacoes ?? null,
    criadoPor: input.criadoPor,
  };

  try {
    const result = await db.insert(titulosFinanceiros).values(data);
    const id = getInsertedId(result as MysqlInsertResult);
    const titulo = (await db.select().from(titulosFinanceiros)
      .where(and(eq(titulosFinanceiros.id, id), eq(titulosFinanceiros.empresaId, empresaId))).limit(1))[0];
    return { id, criado: true, titulo };
  } catch (error) {
    const concorrente = (await db.select().from(titulosFinanceiros)
      .where(eq(titulosFinanceiros.chaveImportacao, chaveImportacao)).limit(1))[0];
    if (concorrente?.origem === input.origem) return { id: concorrente.id, criado: false, titulo: concorrente };
    throw error;
  }
}

/** Encaminha eventos automáticos ao único mecanismo central idempotente. */
export async function garantirTituloFinanceiroAutomatico(input: GarantirTituloAutomaticoInput) {
  return garantirTituloFinanceiroComChave(input);
}

export async function getTituloFinanceiroById(id: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(titulosFinanceiros).where(and(eq(titulosFinanceiros.id, id), eq(titulosFinanceiros.empresaId, empresaId))).limit(1);
  return result[0];
}

export async function listAnexosFinanceiros(tituloId: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  const titulo = await getTituloFinanceiroById(tituloId);
  if (!titulo) return [];
  return db.select().from(anexosFinanceiros)
    .where(eq(anexosFinanceiros.tituloId, tituloId))
    .orderBy(desc(anexosFinanceiros.createdAt));
}

export async function createAnexoFinanceiro(input: {
  tituloId: number;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  tipo: "nota_fiscal" | "boleto" | "comprovante" | "outro";
  storageKey: string;
  url: string;
  criadoPor: number;
}) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const titulo = await getTituloFinanceiroById(input.tituloId);
  if (!titulo) throw new Error("Lançamento financeiro não encontrado");
  const result = await db.insert(anexosFinanceiros).values({ ...input, empresaId });
  return { id: getInsertedId(result as MysqlInsertResult), ...input, empresaId };
}

export async function removerAnexoFinanceiro(input: { id: number; tituloId: number }) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const titulo = await getTituloFinanceiroById(input.tituloId);
  if (!titulo) throw new Error("Lançamento financeiro não encontrado");
  const anexo = (await db.select().from(anexosFinanceiros)
    .where(and(eq(anexosFinanceiros.id, input.id), eq(anexosFinanceiros.tituloId, input.tituloId), eq(anexosFinanceiros.empresaId, empresaId))).limit(1))[0];
  if (!anexo) throw new Error("Anexo financeiro não encontrado");
  await db.delete(anexosFinanceiros).where(and(eq(anexosFinanceiros.id, anexo.id), eq(anexosFinanceiros.empresaId, empresaId)));
  return { success: true, id: anexo.id };
}

export async function atualizarDadosBoleto(input: {
  tituloId: number;
  codigoBarrasBoleto: string | null;
  linhaDigitavelBoleto: string | null;
}) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const titulo = await getTituloFinanceiroById(input.tituloId);
  if (!titulo) throw new Error("Lançamento financeiro não encontrado");
  const boletoConfirmadoEm = input.codigoBarrasBoleto || input.linhaDigitavelBoleto ? new Date() : null;
  await db.update(titulosFinanceiros).set({
    codigoBarrasBoleto: input.codigoBarrasBoleto,
    linhaDigitavelBoleto: input.linhaDigitavelBoleto,
    boletoConfirmadoEm,
  }).where(and(eq(titulosFinanceiros.id, input.tituloId), eq(titulosFinanceiros.empresaId, empresaId)));
  return { ...input, boletoConfirmadoEm };
}

export async function atualizarAgendamentoFinanceiro(input: { id: number; dataVencimento: Date }) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async (tx: any) => {
    const titulo = (await tx.select().from(titulosFinanceiros).where(and(eq(titulosFinanceiros.id, input.id), eq(titulosFinanceiros.empresaId, empresaId))).limit(1))[0];
    if (!titulo) throw new Error("Agendamento financeiro não encontrado");
    if (["quitado", "cancelado"].includes(titulo.estado)) {
      throw new Error("Não é possível alterar o vencimento de um título quitado ou cancelado");
    }

    await tx.update(titulosFinanceiros).set({
      dataVencimento: input.dataVencimento,
    }).where(eq(titulosFinanceiros.id, titulo.id));
    const ciclo = await reconciliarCicloTituloFinanceiro(tx, { ...titulo, dataVencimento: input.dataVencimento }, empresaId);

    if (titulo.origem === "romaneio_carga" && titulo.romaneioCargaId) {
      await tx.update(romaneiosCargaToras).set({ dataVencimento: input.dataVencimento })
        .where(eq(romaneiosCargaToras.id, titulo.romaneioCargaId));
    }
    return { id: titulo.id, dataVencimento: input.dataVencimento, estado: ciclo.estado, romaneioCargaId: titulo.romaneioCargaId };
  });
}

export async function atualizarEstadoTituloFinanceiro(titulo: TituloFinanceiro): Promise<TituloFinanceiro> {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return titulo;
  const ciclo = await reconciliarCicloTituloFinanceiro(db, titulo, empresaId);
  return { ...titulo, valorBaixado: ciclo.valorBaixadoFormatado, estado: ciclo.estado };
}

export async function listTitulosFinanceiros(
  filters: {
    tipo?: TipoTituloFinanceiro;
    estado?: TituloFinanceiro["estado"];
    origem?: TituloFinanceiro["origem"];
    clienteId?: number;
    fornecedorId?: number;
    categoriaId?: number;
    centroCustoId?: number;
    descricao?: string;
    valorMinimo?: number;
    valorMaximo?: number;
    dataInicio?: Date;
    dataFim?: Date;
    criterioData?: "vencimento" | "baixa";
  } | undefined,
  dependencias: {
    database?: DatabaseConnection;
    atualizarEstado?: (titulo: TituloFinanceiro) => Promise<TituloFinanceiro>;
    titulos?: TituloFinanceiro[];
    baixas?: Pick<InferSelectModel<typeof baixasFinanceiras>, "tituloId" | "dataBaixa" | "estornada">[];
    empresaId: number;
  },
) {
  const db = dependencias?.database ?? await getDb();
  if (!db && !dependencias?.titulos) return [];
  const conditions = [];
  conditions.push(eq(titulosFinanceiros.empresaId, dependencias.empresaId));
  if (filters?.tipo) conditions.push(eq(titulosFinanceiros.tipo, filters.tipo));
  if (filters?.estado) conditions.push(eq(titulosFinanceiros.estado, filters.estado));
  else conditions.push(ne(titulosFinanceiros.estado, "cancelado"));
  if (filters?.origem) conditions.push(eq(titulosFinanceiros.origem, filters.origem));
  if (filters?.clienteId) conditions.push(eq(titulosFinanceiros.clienteId, filters.clienteId));
  if (filters?.fornecedorId) conditions.push(eq(titulosFinanceiros.fornecedorId, filters.fornecedorId));
  if (filters?.categoriaId) conditions.push(eq(titulosFinanceiros.categoriaId, filters.categoriaId));
  if (filters?.centroCustoId) conditions.push(eq(titulosFinanceiros.centroCustoId, filters.centroCustoId));
  const titulos = dependencias?.titulos ?? await db!.select().from(titulosFinanceiros)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(titulosFinanceiros.dataVencimento));
  const idsTitulos = titulos.map((titulo) => titulo.id);
  const baixas = filters?.criterioData === "baixa" && idsTitulos.length > 0
    ? (dependencias?.baixas ?? await db!.select({
      tituloId: baixasFinanceiras.tituloId,
      dataBaixa: baixasFinanceiras.dataBaixa,
      estornada: baixasFinanceiras.estornada,
    }).from(baixasFinanceiras).where(inArray(baixasFinanceiras.tituloId, idsTitulos)))
    : [];
  const baixasValidasPorTitulo = new Map<number, Date[]>();
  baixas.filter((baixa) => !baixa.estornada).forEach((baixa) => {
    const datas = baixasValidasPorTitulo.get(baixa.tituloId) ?? [];
    datas.push(new Date(baixa.dataBaixa));
    baixasValidasPorTitulo.set(baixa.tituloId, datas);
  });
  const titulosVisiveis = titulos.filter((titulo) => {
    if (!filters?.estado && titulo.estado === "cancelado") return false;
    if (filters?.estado && titulo.estado !== filters.estado) return false;
    if (filters?.tipo && titulo.tipo !== filters.tipo) return false;
    if (filters?.origem && titulo.origem !== filters.origem) return false;
    if (filters?.clienteId && titulo.clienteId !== filters.clienteId) return false;
    if (filters?.fornecedorId && titulo.fornecedorId !== filters.fornecedorId) return false;
    if (filters?.categoriaId && titulo.categoriaId !== filters.categoriaId) return false;
    if (filters?.centroCustoId && titulo.centroCustoId !== filters.centroCustoId) return false;
    const descricao = filters?.descricao?.trim().toLocaleLowerCase("pt-BR");
    if (descricao && !`${titulo.descricao} ${titulo.contraparteNome ?? ""}`.toLocaleLowerCase("pt-BR").includes(descricao)) return false;
    const valor = decimalParaNumero(titulo.valorOriginal) - decimalParaNumero(titulo.desconto ?? "0") + decimalParaNumero(titulo.juros ?? "0");
    if (filters?.valorMinimo !== undefined && valor < filters.valorMinimo) return false;
    if (filters?.valorMaximo !== undefined && valor > filters.valorMaximo) return false;
    const datasReferencia = filters?.criterioData === "baixa"
      ? baixasValidasPorTitulo.get(titulo.id) ?? []
      : [new Date(titulo.dataVencimento)];
    if (filters?.criterioData === "baixa" && datasReferencia.length === 0) return false;
    const existeDataNoPeriodo = datasReferencia.some((data) => (
      (!filters?.dataInicio || data.getTime() >= filters.dataInicio.getTime())
      && (!filters?.dataFim || data.getTime() <= filters.dataFim.getTime())
    ));
    if (!existeDataNoPeriodo) return false;
    return true;
  });
  return Promise.all(titulosVisiveis.map(async (titulo) => {
    const atualizado = dependencias?.atualizarEstado ? await dependencias.atualizarEstado(titulo) : await atualizarEstadoTituloFinanceiro(titulo);
    const datasBaixa = baixasValidasPorTitulo.get(titulo.id) ?? [];
    const dataUltimaBaixa = datasBaixa.length ? new Date(Math.max(...datasBaixa.map((data) => data.getTime()))) : undefined;
    return { ...atualizado, dataUltimaBaixa };
  }));
}

export type FiltrosContasOperacionais = {
  tipo: "receber" | "pagar";
  estado?: "aberto" | "parcial";
  situacao?: "vencido" | "vence_hoje" | "proximos_7_dias" | "proximos_30_dias" | "a_vencer";
  aging?: "a_vencer" | "vence_hoje" | "1_7" | "8_30" | "31_60" | "61_90" | "mais_90";
  clienteId?: number;
  fornecedorId?: number;
  categoriaId?: number;
  origem?: TituloFinanceiro["origem"];
  descricao?: string;
  valorMinimo?: number;
  valorMaximo?: number;
  dataInicio?: Date;
  dataFim?: Date;
  /**
   * Filtra títulos que já possuam baixa válida naquela conta. Títulos em aberto
   * não carregam uma conta prevista e nunca recebem essa informação por inferência.
   */
  contaFinanceiraId?: number;
  ordenar?: "prioridade" | "vencimento_asc" | "vencimento_desc" | "saldo_desc" | "contraparte";
};

type DependenciasContasOperacionais = {
  database?: DatabaseConnection;
  empresaId: number;
  agora?: Date;
  titulos?: TituloFinanceiro[];
  baixas?: Array<Pick<InferSelectModel<typeof baixasFinanceiras>, "id" | "tituloId" | "contaFinanceiraId" | "valor" | "dataBaixa" | "formaPagamento" | "conciliada" | "estornada">>;
  categorias?: Array<Pick<CategoriaFinanceira, "id" | "nome">>;
  clientes?: Array<Pick<InferSelectModel<typeof clientes>, "id" | "nome">>;
  fornecedores?: Array<Pick<Fornecedor, "id" | "nome">>;
  contas?: Array<Pick<InferSelectModel<typeof contasFinanceiras>, "id" | "nome">>;
};

function situacaoOperacionalCorresponde(
  conta: ReturnType<typeof calcularContaOperacional>,
  situacao: FiltrosContasOperacionais["situacao"],
) {
  if (!situacao) return true;
  if (situacao === "vencido") return conta.diasParaVencimento < 0;
  if (situacao === "vence_hoje") return conta.prioridade === "vence_hoje";
  if (situacao === "proximos_7_dias") return conta.prioridade === "vence_em_breve";
  if (situacao === "proximos_30_dias") return conta.diasParaVencimento >= 1 && conta.diasParaVencimento <= 30;
  return conta.diasParaVencimento > 0;
}

/**
 * Projeta uma única fila operacional de pagar ou receber. Esta consulta é
 * deliberadamente de leitura: reconstrói o saldo com as baixas válidas em lote
 * e não altera títulos, baixas, conciliações ou contas financeiras.
 */
export async function getContasOperacionais(
  filtros: FiltrosContasOperacionais,
  dependencias: DependenciasContasOperacionais,
) {
  const db = dependencias.database ?? await getDb();
  if (!db && !dependencias.titulos) throw new Error("Database not available");
  const agora = dependencias.agora ?? new Date();
  const condicoes = [
    eq(titulosFinanceiros.empresaId, dependencias.empresaId),
    eq(titulosFinanceiros.tipo, filtros.tipo),
  ];
  if (filtros.clienteId) condicoes.push(eq(titulosFinanceiros.clienteId, filtros.clienteId));
  if (filtros.fornecedorId) condicoes.push(eq(titulosFinanceiros.fornecedorId, filtros.fornecedorId));
  if (filtros.categoriaId) condicoes.push(eq(titulosFinanceiros.categoriaId, filtros.categoriaId));
  if (filtros.origem) condicoes.push(eq(titulosFinanceiros.origem, filtros.origem));

  const titulos = dependencias.titulos ?? await db!.select().from(titulosFinanceiros)
    .where(and(...condicoes));
  const tituloIds = titulos.map((titulo) => titulo.id);
  const [baixas, categorias, listaClientes, listaFornecedores, contas] = await Promise.all([
    dependencias.baixas ?? (tituloIds.length ? db!.select({
      id: baixasFinanceiras.id,
      tituloId: baixasFinanceiras.tituloId,
      contaFinanceiraId: baixasFinanceiras.contaFinanceiraId,
      valor: baixasFinanceiras.valor,
      dataBaixa: baixasFinanceiras.dataBaixa,
      formaPagamento: baixasFinanceiras.formaPagamento,
      conciliada: baixasFinanceiras.conciliada,
      estornada: baixasFinanceiras.estornada,
    }).from(baixasFinanceiras).where(and(
      eq(baixasFinanceiras.empresaId, dependencias.empresaId),
      inArray(baixasFinanceiras.tituloId, tituloIds),
    )) : []),
    dependencias.categorias ?? db!.select({ id: categoriasFinanceiras.id, nome: categoriasFinanceiras.nome })
      .from(categoriasFinanceiras).where(eq(categoriasFinanceiras.empresaId, dependencias.empresaId)),
    dependencias.clientes ?? db!.select({ id: clientes.id, nome: clientes.nome })
      .from(clientes).where(eq(clientes.empresaId, dependencias.empresaId)),
    dependencias.fornecedores ?? db!.select({ id: fornecedores.id, nome: fornecedores.nome })
      .from(fornecedores).where(eq(fornecedores.empresaId, dependencias.empresaId)),
    dependencias.contas ?? db!.select({ id: contasFinanceiras.id, nome: contasFinanceiras.nome })
      .from(contasFinanceiras).where(eq(contasFinanceiras.empresaId, dependencias.empresaId)),
  ]);

  const baixasPorTitulo = new Map<number, typeof baixas>();
  baixas.forEach((baixa) => {
    const existentes = baixasPorTitulo.get(baixa.tituloId) ?? [];
    existentes.push(baixa);
    baixasPorTitulo.set(baixa.tituloId, existentes);
  });
  const categoriaPorId = new Map(categorias.map((categoria) => [categoria.id, categoria.nome]));
  const clientePorId = new Map(listaClientes.map((cliente) => [cliente.id, cliente.nome]));
  const fornecedorPorId = new Map(listaFornecedores.map((fornecedor) => [fornecedor.id, fornecedor.nome]));
  const contaPorId = new Map(contas.map((conta) => [conta.id, conta.nome]));
  const textoBuscado = filtros.descricao?.trim().toLocaleLowerCase("pt-BR");

  const itens = titulos.map((titulo) => {
    const baixasDoTitulo = baixasPorTitulo.get(titulo.id) ?? [];
    const ciclo = calcularCicloTituloFinanceiro({
      valorOriginal: titulo.valorOriginal,
      desconto: titulo.desconto,
      juros: titulo.juros,
      dataVencimento: titulo.dataVencimento,
      baixas: baixasDoTitulo.map((baixa) => ({ valor: baixa.valor, estornada: baixa.estornada })),
      cancelado: titulo.estado === "cancelado",
      agora,
    });
    const conta = calcularContaOperacional({
      id: titulo.id,
      tipo: titulo.tipo,
      estado: ciclo.estado,
      dataVencimento: titulo.dataVencimento,
      valorOriginal: titulo.valorOriginal,
      desconto: titulo.desconto,
      juros: titulo.juros,
      valorBaixado: ciclo.valorBaixado,
    }, agora);
    const contraparte = titulo.tipo === "receber"
      ? (titulo.clienteId ? clientePorId.get(titulo.clienteId) : null) ?? titulo.contraparteNome ?? "Cliente não informado"
      : (titulo.fornecedorId ? fornecedorPorId.get(titulo.fornecedorId) : null) ?? titulo.contraparteNome ?? "Fornecedor não informado";
    const baixasValidas = baixasDoTitulo.filter((baixa) => !baixa.estornada);
    return {
      ...conta,
      descricao: titulo.descricao,
      origem: titulo.origem,
      competencia: titulo.competencia,
      categoriaId: titulo.categoriaId,
      categoriaNome: categoriaPorId.get(titulo.categoriaId) ?? "Categoria não informada",
      clienteId: titulo.clienteId,
      fornecedorId: titulo.fornecedorId,
      contraparte,
      numeroParcela: titulo.numeroParcela,
      totalParcelas: titulo.totalParcelas,
      valorDevido: ciclo.valorDevido,
      valorBaixado: ciclo.valorBaixado,
      temBaixaConciliada: baixasValidas.some((baixa) => Boolean(baixa.conciliada)),
      baixas: baixasDoTitulo.map((baixa) => ({
        ...baixa,
        contaNome: contaPorId.get(baixa.contaFinanceiraId) ?? "Conta não informada",
      })),
    };
  }).filter((item) => {
    if (item.estado === "quitado" || item.estado === "cancelado" || item.saldoAberto <= 0.005) return false;
    if (filtros.estado && item.estado !== filtros.estado) return false;
    if (!situacaoOperacionalCorresponde(item, filtros.situacao)) return false;
    if (filtros.aging && item.faixaAging !== filtros.aging) return false;
    if (textoBuscado && !`${item.descricao} ${item.contraparte}`.toLocaleLowerCase("pt-BR").includes(textoBuscado)) return false;
    if (filtros.valorMinimo !== undefined && item.saldoAberto < filtros.valorMinimo) return false;
    if (filtros.valorMaximo !== undefined && item.saldoAberto > filtros.valorMaximo) return false;
    const vencimento = item.dataVencimento.getTime();
    if (filtros.dataInicio && vencimento < filtros.dataInicio.getTime()) return false;
    if (filtros.dataFim && vencimento > filtros.dataFim.getTime()) return false;
    if (filtros.contaFinanceiraId && !item.baixas.some((baixa) => !baixa.estornada && baixa.contaFinanceiraId === filtros.contaFinanceiraId)) return false;
    return true;
  });

  const itensOrdenados = filtros.ordenar === "vencimento_asc" ? [...itens].sort((a, b) => a.dataVencimento.getTime() - b.dataVencimento.getTime() || a.id - b.id)
    : filtros.ordenar === "vencimento_desc" ? [...itens].sort((a, b) => b.dataVencimento.getTime() - a.dataVencimento.getTime() || a.id - b.id)
      : filtros.ordenar === "saldo_desc" ? [...itens].sort((a, b) => b.saldoAberto - a.saldoAberto || a.id - b.id)
        : filtros.ordenar === "contraparte" ? [...itens].sort((a, b) => a.contraparte.localeCompare(b.contraparte, "pt-BR") || a.id - b.id)
          : ordenarContasOperacionais(itens);
  const agrupamentos = Array.from(itens.reduce((mapa, item) => {
    const chave = item.tipo === "receber" ? `cliente:${item.clienteId ?? item.contraparte}` : `fornecedor:${item.fornecedorId ?? item.contraparte}`;
    const existente = mapa.get(chave) ?? { contraparte: item.contraparte, clienteId: item.clienteId, fornecedorId: item.fornecedorId, quantidade: 0, saldoAberto: 0, vencido: 0 };
    existente.quantidade += 1;
    existente.saldoAberto += item.saldoAberto;
    if (item.diasParaVencimento < 0) existente.vencido += item.saldoAberto;
    mapa.set(chave, existente);
    return mapa;
  }, new Map<string, { contraparte: string; clienteId: number | null; fornecedorId: number | null; quantidade: number; saldoAberto: number; vencido: number }>()).values())
    .sort((a, b) => b.saldoAberto - a.saldoAberto || a.contraparte.localeCompare(b.contraparte, "pt-BR"));

  return {
    itens: itensOrdenados,
    resumo: resumirContasOperacionais(itens),
    agrupamentos,
    top5Contrapartes: agrupamentos.slice(0, 5),
    convencaoContaFinanceira: "O filtro por conta retorna somente títulos que já possuem baixa válida nessa conta; títulos em aberto não recebem conta prevista.",
  };
}

function dataImportada(valor: string): Date {
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

export function getModeloImportacaoLancamentosCsv() {
  return criarModeloCsvLancamentos();
}

export async function exportarLancamentosFinanceirosCsv(filters: { tipo?: TipoTituloFinanceiro } | undefined) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [titulos, categorias, centrosCusto] = await Promise.all([
    listTitulosFinanceiros(filters, { empresaId }),
    listCategoriasFinanceiras(),
    listarCentrosCusto(true),
  ]);
  const categoriasPorId = new Map(categorias.map((categoria) => [categoria.id, categoria.nome]));
  const centrosPorId = new Map(centrosCusto.map((centro) => [centro.id, centro.nome]));
  return exportarLancamentosCsv(titulos
    .filter((titulo) => titulo.origem === "manual")
    .map((titulo) => ({
      id: titulo.id,
      chaveImportacao: titulo.chaveImportacao,
      tipo: titulo.tipo,
      descricao: titulo.descricao,
      categoria: categoriasPorId.get(titulo.categoriaId) ?? `Categoria ${titulo.categoriaId}`,
      centroCusto: titulo.centroCustoId ? (centrosPorId.get(titulo.centroCustoId) ?? `Centro ${titulo.centroCustoId}`) : "",
      valor: titulo.valorOriginal,
      dataEmissao: titulo.dataEmissao,
      dataVencimento: titulo.dataVencimento,
      competencia: titulo.competencia,
      contraparte: titulo.contraparteNome,
      observacoes: titulo.observacoes,
    })));
}

export async function importarLancamentosFinanceirosCsv(
  conteudo: string,
  userId: number,
  dependencias?: { database?: DatabaseConnection; categorias?: CategoriaFinanceira[]; centrosCusto?: Array<{ id: number; nome: string; codigo: string; ativo?: boolean | number | null }>; titulosExistentes?: Array<{ id: number; chaveImportacao?: string | null }> },
) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const [categorias, centrosCusto, titulosExistentes] = await Promise.all([
    dependencias?.categorias ?? listCategoriasFinanceiras(),
    dependencias?.centrosCusto ?? listarCentrosCusto(),
    dependencias?.titulosExistentes ?? db.select({ id: titulosFinanceiros.id, chaveImportacao: titulosFinanceiros.chaveImportacao }).from(titulosFinanceiros).where(eq(titulosFinanceiros.empresaId, empresaId)),
  ]);
  const preparo = prepararImportacaoLancamentos({ conteudo, categorias, centrosCusto, titulosExistentes });
  if (preparo.erros.length) return { importados: 0, erros: preparo.erros };
  await db.transaction(async (tx) => {
    await tx.insert(titulosFinanceiros).values(preparo.linhas.map((linha) => ({
      empresaId,
      tipo: linha.tipo,
      origem: "manual" as const,
      chaveImportacao: linha.referencia,
      descricao: linha.descricao,
      categoriaId: linha.categoriaId,
      centroCustoId: linha.centroCustoId,
      valorOriginal: linha.valor,
      desconto: "0",
      juros: "0",
      valorBaixado: "0",
      dataEmissao: dataImportada(linha.dataEmissao),
      dataVencimento: dataImportada(linha.dataVencimento),
      competencia: linha.competencia ? dataImportada(linha.competencia) : null,
      contraparteNome: linha.contraparte,
      estado: calcularEstadoTitulo({ valorOriginal: linha.valor, dataVencimento: dataImportada(linha.dataVencimento) }),
      observacoes: linha.observacoes,
      criadoPor: userId,
    })));
  });
  return { importados: preparo.linhas.length, erros: [] as string[] };
}

type ChequeRecebidoInput = {
  referencia: string;
  valor: string | number;
  clienteId?: number | null;
  dataCompensacao?: Date | null;
};

export type BaixaComChequesInput = Pick<InsertBaixaFinanceira, "tituloId" | "contaFinanceiraId" | "valor" | "dataBaixa" | "formaPagamento" | "observacoes" | "origemBaixa" | "criadoPor"> & {
  chequesRecebidos?: ChequeRecebidoInput[];
  chequeIdsUtilizados?: number[];
};

export async function registrarBaixaFinanceira(data: BaixaComChequesInput, database?: DatabaseConnection | any) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const registrar = async (tx: any) => {
    const titulo = (await tx.select().from(titulosFinanceiros)
      .where(and(eq(titulosFinanceiros.id, data.tituloId), eq(titulosFinanceiros.empresaId, empresaId))).for("update").limit(1))[0];
    if (!titulo) throw new Error("Título financeiro não encontrado");
    const cicloAntesDaBaixa = await reconciliarCicloTituloFinanceiro(tx, titulo, empresaId, data.dataBaixa);
    if (cicloAntesDaBaixa.estado === "cancelado" || cicloAntesDaBaixa.estado === "quitado") {
      throw new Error("Este título não aceita novas baixas");
    }
    const conta = (await tx.select().from(contasFinanceiras)
      .where(and(eq(contasFinanceiras.id, data.contaFinanceiraId), eq(contasFinanceiras.ativa, true), eq(contasFinanceiras.empresaId, empresaId))).limit(1))[0];
    if (!conta) throw new Error("Informe uma conta financeira ativa para a baixa");

    const saldoAberto = cicloAntesDaBaixa.saldoAberto;
    const valorBaixa = validarValorBaixaContraSaldo(data.valor, saldoAberto);

    const ehCaixaCheque = conta.tipo === "caixa_cheque";
    const chequesRecebidos = data.chequesRecebidos ?? [];
    const chequeIdsUtilizados = Array.from(new Set(data.chequeIdsUtilizados ?? []));
    if (!ehCaixaCheque && (data.formaPagamento === "cheque" || chequesRecebidos.length || chequeIdsUtilizados.length)) {
      throw new Error("Cheque deve ser registrado exclusivamente em uma conta do tipo Caixa Cheque");
    }
    if (ehCaixaCheque && data.formaPagamento !== "cheque") {
      throw new Error("Movimentações no Caixa Cheque devem usar a forma de pagamento Cheque");
    }

    if (ehCaixaCheque && titulo.tipo === "receber") {
      if (!chequesRecebidos.length) throw new Error("Informe pelo menos um cheque para registrar este recebimento");
      if (chequeIdsUtilizados.length) throw new Error("Cheques disponíveis só podem ser utilizados em contas a pagar");
      const referencias = chequesRecebidos.map((cheque) => cheque.referencia.trim()).filter(Boolean);
      if (referencias.length !== chequesRecebidos.length) throw new Error("Informe a referência de cada cheque recebido");
      if (new Set(referencias.map((referencia) => referencia.toLocaleUpperCase("pt-BR"))).size !== referencias.length) {
        throw new Error("Não informe a mesma referência de cheque mais de uma vez");
      }
      validarValorDosCheques(valorBaixa, chequesRecebidos.map((cheque) => cheque.valor));
      const existentes = await tx.select({ referencia: chequesFinanceiros.referencia }).from(chequesFinanceiros)
        .where(and(
          eq(chequesFinanceiros.empresaId, empresaId),
          eq(chequesFinanceiros.contaFinanceiraId, conta.id),
          inArray(chequesFinanceiros.referencia, referencias),
        ));
      if (existentes.length) throw new Error(`A referência do cheque ${existentes[0].referencia} já está registrada neste Caixa Cheque`);
      for (const cheque of chequesRecebidos) {
        const clienteId = cheque.clienteId ?? titulo.clienteId;
        if (!clienteId) throw new Error("Informe o cliente vinculado a cada cheque recebido");
        if (titulo.clienteId && clienteId !== titulo.clienteId) throw new Error("O cliente do cheque deve ser o mesmo cliente do título a receber");
      }
    }

    let chequesSelecionados: Array<{ id: number; valor: string; estado: string }> = [];
    if (ehCaixaCheque && titulo.tipo === "pagar") {
      if (!chequeIdsUtilizados.length) throw new Error("Selecione os cheques disponíveis que serão usados neste pagamento");
      if (chequesRecebidos.length) throw new Error("Novos cheques só podem ser registrados em contas a receber");
      chequesSelecionados = await tx.select({ id: chequesFinanceiros.id, valor: chequesFinanceiros.valor, estado: chequesFinanceiros.estado })
        .from(chequesFinanceiros)
        .where(and(
          eq(chequesFinanceiros.empresaId, empresaId),
          eq(chequesFinanceiros.contaFinanceiraId, conta.id),
          inArray(chequesFinanceiros.id, chequeIdsUtilizados),
        ));
      if (chequesSelecionados.length !== chequeIdsUtilizados.length || chequesSelecionados.some((cheque) => cheque.estado !== "disponivel")) {
        throw new Error("Um ou mais cheques selecionados não estão disponíveis para pagamento");
      }
      validarValorDosCheques(valorBaixa, chequesSelecionados.map((cheque) => cheque.valor));
    }

    const { chequesRecebidos: _chequesRecebidos, chequeIdsUtilizados: _chequeIdsUtilizados, ...dadosBaixa } = data;
    const result = await tx.insert(baixasFinanceiras).values({ ...dadosBaixa, valor: valorBaixa.toFixed(2), empresaId });
    const baixaId = getInsertedId(result as MysqlInsertResult);

    if (ehCaixaCheque && titulo.tipo === "receber") {
      const itens: InsertChequeFinanceiro[] = chequesRecebidos.map((cheque) => ({
        empresaId,
        contaFinanceiraId: conta.id,
        baixaEntradaId: baixaId,
        clienteId: cheque.clienteId ?? titulo.clienteId!,
        referencia: cheque.referencia.trim(),
        valor: decimalParaNumero(cheque.valor).toFixed(2),
        dataRecebimento: data.dataBaixa,
        dataCompensacao: cheque.dataCompensacao ?? null,
        estado: "disponivel",
        criadoPor: data.criadoPor,
      }));
      await tx.insert(chequesFinanceiros).values(itens);
    }
    if (ehCaixaCheque && titulo.tipo === "pagar") {
      await tx.update(chequesFinanceiros).set({ estado: "utilizado", utilizadoEm: data.dataBaixa, baixaSaidaId: baixaId })
        .where(and(eq(chequesFinanceiros.empresaId, empresaId), inArray(chequesFinanceiros.id, chequesSelecionados.map((cheque) => cheque.id)), eq(chequesFinanceiros.estado, "disponivel")));
    }

    const ciclo = await reconciliarCicloTituloFinanceiro(tx, titulo, empresaId, data.dataBaixa);
    const novoEstado = ciclo.estado;
    if (titulo.orcamentoId && titulo.origem === "orcamento") {
      const parcelasDaVenda = await tx.select({ id: titulosFinanceiros.id, estado: titulosFinanceiros.estado }).from(titulosFinanceiros).where(and(
        eq(titulosFinanceiros.orcamentoId, titulo.orcamentoId),
        eq(titulosFinanceiros.origem, "orcamento"),
        eq(titulosFinanceiros.empresaId, empresaId),
        ne(titulosFinanceiros.estado, "cancelado"),
      ));
      const vendaQuitada = parcelasDaVenda.length && parcelasDaVenda.every((parcela: { id: number; estado: string }) => (
        parcela.id === titulo.id ? novoEstado === "quitado" : parcela.estado === "quitado"
      ));
      if (vendaQuitada) {
        await tx.update(orcamentos).set({ pago: true, pagoEm: data.dataBaixa, formaPagamento: data.formaPagamento, pagoPor: data.criadoPor })
          .where(and(eq(orcamentos.id, titulo.orcamentoId), eq(orcamentos.empresaId, empresaId)));
      }
    }
    return { id: baixaId, estado: novoEstado, valorBaixado: ciclo.valorBaixadoFormatado };
  };
  return database ? registrar(database) : db.transaction(registrar);
}

export async function listBaixasFinanceiras(tituloId: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  const titulo = await getTituloFinanceiroById(tituloId);
  if (!titulo) return [];
  return db.select({
    id: baixasFinanceiras.id,
    tituloId: baixasFinanceiras.tituloId,
    contaFinanceiraId: baixasFinanceiras.contaFinanceiraId,
    valor: baixasFinanceiras.valor,
    dataBaixa: baixasFinanceiras.dataBaixa,
    formaPagamento: baixasFinanceiras.formaPagamento,
    observacoes: baixasFinanceiras.observacoes,
    conciliada: baixasFinanceiras.conciliada,
    conciliadaEm: baixasFinanceiras.conciliadaEm,
    estornada: baixasFinanceiras.estornada,
    estornadaEm: baixasFinanceiras.estornadaEm,
    estornadaPor: baixasFinanceiras.estornadaPor,
    motivoEstorno: baixasFinanceiras.motivoEstorno,
    criadoPor: baixasFinanceiras.criadoPor,
    createdAt: baixasFinanceiras.createdAt,
    contaNome: contasFinanceiras.nome,
    contaTipo: contasFinanceiras.tipo,
  }).from(baixasFinanceiras)
    .leftJoin(contasFinanceiras, eq(baixasFinanceiras.contaFinanceiraId, contasFinanceiras.id))
    .where(eq(baixasFinanceiras.tituloId, tituloId))
    .orderBy(desc(baixasFinanceiras.dataBaixa));
}

export async function conciliarBaixaFinanceira(id: number, conciliada: boolean) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const baixa = (await db.select({ tituloId: baixasFinanceiras.tituloId }).from(baixasFinanceiras).where(eq(baixasFinanceiras.id, id)).limit(1))[0];
  if (!baixa || !(await getTituloFinanceiroById(baixa.tituloId))) throw new Error("Baixa financeira não encontrada");
  await db.update(baixasFinanceiras).set({ conciliada, conciliadaEm: conciliada ? new Date() : null }).where(eq(baixasFinanceiras.id, id));
  return { success: true };
}

function chaveMovimentoExtrato(contaFinanceiraId: number, chaveBase: string): string {
  let hash = 5381;
  const texto = `${contaFinanceiraId}|${chaveBase}`;
  for (let indice = 0; indice < texto.length; indice += 1) hash = ((hash * 33) ^ texto.charCodeAt(indice)) >>> 0;
  return `EXT-${contaFinanceiraId}-${hash.toString(36)}-${texto.length}`;
}

function dataExtrato(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

export async function getModeloImportacaoExtratoBancarioCsv() {
  return criarModeloCsvExtratoBancario();
}

export async function prepararImportacaoExtratoBancario(conteudo: string, formato: "csv" | "ofx") {
  return prepararImportacaoExtrato(conteudo, formato);
}

export async function importarExtratoBancario(input: { contaFinanceiraId: number; nomeArquivo: string; formato: "csv" | "ofx"; conteudo: string }, userId: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const conta = await db.select().from(contasFinanceiras).where(and(eq(contasFinanceiras.id, input.contaFinanceiraId), eq(contasFinanceiras.ativa, true), eq(contasFinanceiras.empresaId, empresaId))).limit(1);
  if (!conta[0]) throw new Error("A conta financeira selecionada não está ativa");
  if (conta[0].tipo !== "banco") throw new Error("Selecione uma conta do tipo banco para importar um extrato");
  const preparo = prepararImportacaoExtrato(input.conteudo, input.formato);
  if (preparo.erros.length) return { importados: 0, duplicados: 0, erros: preparo.erros };
  const chaves = preparo.linhas.map((linha) => chaveMovimentoExtrato(input.contaFinanceiraId, linha.chaveBase));
  const resultado = await db.transaction(async (tx) => {
    const contaBloqueada = (await tx.select({ id: contasFinanceiras.id }).from(contasFinanceiras)
      .where(and(eq(contasFinanceiras.id, input.contaFinanceiraId), eq(contasFinanceiras.empresaId, empresaId), eq(contasFinanceiras.ativa, true)))
      .for("update").limit(1))[0];
    if (!contaBloqueada) throw new Error("A conta financeira selecionada não está ativa");
    const existentes = chaves.length
      ? await tx.select({ chaveUnica: movimentosExtratoBancario.chaveUnica }).from(movimentosExtratoBancario)
        .where(and(eq(movimentosExtratoBancario.empresaId, empresaId), inArray(movimentosExtratoBancario.chaveUnica, chaves)))
      : [];
    const chavesExistentes = new Set(existentes.map((item) => item.chaveUnica));
    const linhasNovas = preparo.linhas.filter((linha) => !chavesExistentes.has(chaveMovimentoExtrato(input.contaFinanceiraId, linha.chaveBase)));
    if (!linhasNovas.length) return { importados: 0, duplicados: preparo.linhas.length, erros: [] as string[] };
    const datas = linhasNovas.map((linha) => dataExtrato(linha.dataMovimento));
    const criado = await tx.insert(extratosBancarios).values({
      empresaId,
      contaFinanceiraId: input.contaFinanceiraId,
      nomeArquivo: input.nomeArquivo.slice(0, 300),
      formato: input.formato,
      periodoInicial: new Date(Math.min(...datas.map((data) => data.getTime()))),
      periodoFinal: new Date(Math.max(...datas.map((data) => data.getTime()))),
      saldoFinalBanco: preparo.saldoFinalBanco,
      dataSaldoFinalBanco: preparo.dataSaldoFinalBanco ? dataExtrato(preparo.dataSaldoFinalBanco) : null,
      totalLinhas: linhasNovas.length,
      criadoPor: userId,
    });
    const extratoId = getInsertedId(criado as MysqlInsertResult);
    await tx.insert(movimentosExtratoBancario).values(linhasNovas.map((linha) => ({
      empresaId,
      extratoId,
      contaFinanceiraId: input.contaFinanceiraId,
      dataMovimento: dataExtrato(linha.dataMovimento),
      descricao: linha.descricao,
      tipo: linha.tipo,
      valor: linha.valor,
      identificadorExterno: linha.identificadorExterno,
      memoOriginal: linha.memoOriginal,
      numeroDocumento: linha.numeroDocumento,
      saldoAposMovimento: linha.saldoAposMovimento,
      chaveUnica: chaveMovimentoExtrato(input.contaFinanceiraId, linha.chaveBase),
      estado: "pendente" as const,
    })));
    const movimentosCriados = await tx.select({ id: movimentosExtratoBancario.id }).from(movimentosExtratoBancario)
      .where(and(eq(movimentosExtratoBancario.empresaId, empresaId), eq(movimentosExtratoBancario.extratoId, extratoId)));
    await tx.insert(auditoriasConciliacaoBancaria).values(movimentosCriados.map((movimento) => ({
      empresaId,
      movimentoExtratoBancarioId: movimento.id,
      acao: "importado" as const,
      detalhes: `Importado do arquivo ${input.nomeArquivo.slice(0, 300)}`,
      usuarioId: userId,
    })));
    return { importados: linhasNovas.length, duplicados: preparo.linhas.length - linhasNovas.length, erros: [] as string[] };
  });
  return resultado;
}

export async function listConciliacaoBancaria(filtros: { contaFinanceiraId?: number; estado?: "pendente" | "conciliado" | "ignorado" | "divergente" } | undefined) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  const condicoes: SQL[] = [eq(movimentosExtratoBancario.empresaId, empresaId)];
  if (filtros?.contaFinanceiraId) condicoes.push(eq(movimentosExtratoBancario.contaFinanceiraId, filtros.contaFinanceiraId));
  if (filtros?.estado) condicoes.push(eq(movimentosExtratoBancario.estado, filtros.estado));
  const consultaMovimentos = db.select({
    id: movimentosExtratoBancario.id,
    extratoId: movimentosExtratoBancario.extratoId,
    contaFinanceiraId: movimentosExtratoBancario.contaFinanceiraId,
    contaNome: contasFinanceiras.nome,
    nomeArquivo: extratosBancarios.nomeArquivo,
    dataMovimento: movimentosExtratoBancario.dataMovimento,
    descricao: movimentosExtratoBancario.descricao,
    tipo: movimentosExtratoBancario.tipo,
    valor: movimentosExtratoBancario.valor,
    identificadorExterno: movimentosExtratoBancario.identificadorExterno,
    memoOriginal: movimentosExtratoBancario.memoOriginal,
    numeroDocumento: movimentosExtratoBancario.numeroDocumento,
    saldoAposMovimento: movimentosExtratoBancario.saldoAposMovimento,
    estado: movimentosExtratoBancario.estado,
    baixaFinanceiraId: movimentosExtratoBancario.baixaFinanceiraId,
    movimentoTransferenciaFinanceiraId: movimentosExtratoBancario.movimentoTransferenciaFinanceiraId,
    conciliadoEm: movimentosExtratoBancario.conciliadoEm,
    observacoes: movimentosExtratoBancario.observacoes,
    baixaValor: baixasFinanceiras.valor,
    baixaData: baixasFinanceiras.dataBaixa,
    baixaTituloId: baixasFinanceiras.tituloId,
    baixaDescricao: titulosFinanceiros.descricao,
    baixaContraparte: titulosFinanceiros.contraparteNome,
    baixaTipoTitulo: titulosFinanceiros.tipo,
  }).from(movimentosExtratoBancario)
    .innerJoin(contasFinanceiras, eq(movimentosExtratoBancario.contaFinanceiraId, contasFinanceiras.id))
    .innerJoin(extratosBancarios, eq(movimentosExtratoBancario.extratoId, extratosBancarios.id))
    .leftJoin(baixasFinanceiras, eq(movimentosExtratoBancario.baixaFinanceiraId, baixasFinanceiras.id))
    .leftJoin(titulosFinanceiros, eq(baixasFinanceiras.tituloId, titulosFinanceiros.id));
  const movimentos = condicoes.length ? await consultaMovimentos.where(and(...condicoes)).orderBy(desc(movimentosExtratoBancario.dataMovimento), desc(movimentosExtratoBancario.id)) : await consultaMovimentos.orderBy(desc(movimentosExtratoBancario.dataMovimento), desc(movimentosExtratoBancario.id));
  const contasIds = Array.from(new Set(movimentos.map((movimento) => movimento.contaFinanceiraId)));
  const baixas = contasIds.length ? await db.select({
    id: baixasFinanceiras.id,
    tituloId: baixasFinanceiras.tituloId,
    tipoTitulo: titulosFinanceiros.tipo,
    valor: baixasFinanceiras.valor,
    dataBaixa: baixasFinanceiras.dataBaixa,
    descricaoTitulo: titulosFinanceiros.descricao,
    contraparteNome: titulosFinanceiros.contraparteNome,
    contaFinanceiraId: baixasFinanceiras.contaFinanceiraId,
  }).from(baixasFinanceiras)
    .innerJoin(titulosFinanceiros, eq(baixasFinanceiras.tituloId, titulosFinanceiros.id))
    .where(and(eq(baixasFinanceiras.empresaId, empresaId), inArray(baixasFinanceiras.contaFinanceiraId, contasIds), eq(baixasFinanceiras.estornada, false), eq(baixasFinanceiras.conciliada, false))) : [];
  const transferencias = contasIds.length ? await db.select({
    id: movimentosTransferenciasFinanceiras.id,
    transferenciaId: movimentosTransferenciasFinanceiras.transferenciaId,
    contaFinanceiraId: movimentosTransferenciasFinanceiras.contaFinanceiraId,
    tipo: movimentosTransferenciasFinanceiras.tipo,
    valor: movimentosTransferenciasFinanceiras.valor,
    dataMovimento: transferenciasFinanceiras.dataTransferencia,
    descricao: transferenciasFinanceiras.descricao,
  }).from(movimentosTransferenciasFinanceiras)
    .innerJoin(transferenciasFinanceiras, eq(movimentosTransferenciasFinanceiras.transferenciaId, transferenciasFinanceiras.id))
    .where(and(
      eq(movimentosTransferenciasFinanceiras.empresaId, empresaId),
      inArray(movimentosTransferenciasFinanceiras.contaFinanceiraId, contasIds),
      eq(transferenciasFinanceiras.estado, "efetivada"),
    )) : [];
  return movimentos.map((movimento) => ({
    ...movimento,
    sugestoes: movimento.estado === "pendente" ? sugerirConciliacoes(movimento, baixas.filter((baixa) => baixa.contaFinanceiraId === movimento.contaFinanceiraId)) : [],
    sugestoesTransferencia: movimento.estado === "pendente"
      ? sugerirTransferenciasInternas(movimento, transferencias.map((transferencia) => ({ ...transferencia, descricao: transferencia.descricao ?? "Transferência interna" })))
      : [],
  }));
}

export async function confirmarConciliacaoBancaria(input: { movimentoId: number; baixaFinanceiraId: number }, userId: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    const movimento = (await tx.select().from(movimentosExtratoBancario)
      .where(and(eq(movimentosExtratoBancario.id, input.movimentoId), eq(movimentosExtratoBancario.empresaId, empresaId))).for("update").limit(1))[0];
    if (!movimento) throw new Error("Movimento bancário não encontrado");
    if (movimento.estado !== "pendente") throw new Error("Apenas movimentos pendentes podem ser conciliados");
    const baixa = (await tx.select({
      id: baixasFinanceiras.id,
      contaFinanceiraId: baixasFinanceiras.contaFinanceiraId,
      valor: baixasFinanceiras.valor,
      estornada: baixasFinanceiras.estornada,
      conciliada: baixasFinanceiras.conciliada,
      tipoTitulo: titulosFinanceiros.tipo,
    }).from(baixasFinanceiras)
      .innerJoin(titulosFinanceiros, eq(baixasFinanceiras.tituloId, titulosFinanceiros.id))
      .where(and(eq(baixasFinanceiras.id, input.baixaFinanceiraId), eq(baixasFinanceiras.empresaId, empresaId), eq(titulosFinanceiros.empresaId, empresaId)))
      .for("update").limit(1))[0];
    if (!baixa || baixa.estornada) throw new Error("A baixa selecionada não está disponível para conciliação");
    if (baixa.conciliada) throw new Error("A baixa selecionada já foi conciliada em outro movimento");
    if (baixa.contaFinanceiraId !== movimento.contaFinanceiraId) throw new Error("O movimento e a baixa devem pertencer à mesma conta financeira");
    if ((movimento.tipo === "entrada" ? "receber" : "pagar") !== baixa.tipoTitulo) throw new Error("O tipo do movimento não corresponde ao tipo da baixa");
    if (Math.abs(decimalParaNumero(movimento.valor) - decimalParaNumero(baixa.valor)) > 0.01) throw new Error("O valor do movimento é diferente do valor da baixa");
    const agora = new Date();
    const vinculoId = await criarOuReativarVinculoConciliacao(tx, {
      empresaId,
      movimentoExtratoBancarioId: movimento.id,
      baixaFinanceiraId: baixa.id,
      tipo: "baixa_existente",
      valorVinculado: baixa.valor,
      criadoPor: userId,
    });
    await tx.update(baixasFinanceiras).set({ conciliada: true, conciliadaEm: agora }).where(and(eq(baixasFinanceiras.id, baixa.id), eq(baixasFinanceiras.empresaId, empresaId), eq(baixasFinanceiras.conciliada, false)));
    await tx.update(movimentosExtratoBancario).set({ estado: "conciliado", baixaFinanceiraId: baixa.id, conciliadoEm: agora, conciliadoPor: userId, observacoes: null }).where(and(eq(movimentosExtratoBancario.id, movimento.id), eq(movimentosExtratoBancario.empresaId, empresaId), eq(movimentosExtratoBancario.estado, "pendente")));
    await tx.insert(auditoriasConciliacaoBancaria).values({
      empresaId,
      movimentoExtratoBancarioId: movimento.id,
      vinculoConciliacaoId: vinculoId,
      acao: "conciliado_baixa",
      detalhes: `Baixa financeira #${baixa.id} conciliada por correspondência de conta, tipo e valor`,
      usuarioId: userId,
    });
  });
  return { success: true };
}

export async function confirmarConciliacaoTransferenciaBancaria(input: { movimentoId: number; movimentoTransferenciaFinanceiraId: number }, userId: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    const movimento = (await tx.select().from(movimentosExtratoBancario)
      .where(and(eq(movimentosExtratoBancario.id, input.movimentoId), eq(movimentosExtratoBancario.empresaId, empresaId))).for("update").limit(1))[0];
    if (!movimento) throw new Error("Movimento bancário não encontrado");
    if (movimento.estado !== "pendente") throw new Error("Apenas movimentos pendentes podem ser conciliados");
    const transferencia = (await tx.select({
      id: movimentosTransferenciasFinanceiras.id,
      transferenciaId: movimentosTransferenciasFinanceiras.transferenciaId,
      contaFinanceiraId: movimentosTransferenciasFinanceiras.contaFinanceiraId,
      tipo: movimentosTransferenciasFinanceiras.tipo,
      valor: movimentosTransferenciasFinanceiras.valor,
      estado: transferenciasFinanceiras.estado,
    }).from(movimentosTransferenciasFinanceiras)
      .innerJoin(transferenciasFinanceiras, eq(movimentosTransferenciasFinanceiras.transferenciaId, transferenciasFinanceiras.id))
      .where(and(
        eq(movimentosTransferenciasFinanceiras.id, input.movimentoTransferenciaFinanceiraId),
        eq(movimentosTransferenciasFinanceiras.empresaId, empresaId),
        eq(transferenciasFinanceiras.empresaId, empresaId),
      )).for("update").limit(1))[0];
    if (!transferencia || transferencia.estado !== "efetivada") throw new Error("A transferência selecionada não está disponível para conciliação");
    if (transferencia.contaFinanceiraId !== movimento.contaFinanceiraId) throw new Error("O movimento e a transferência devem pertencer à mesma conta financeira");
    if (transferencia.tipo !== movimento.tipo) throw new Error("O sentido da transferência não corresponde ao movimento bancário");
    if (Math.abs(decimalParaNumero(transferencia.valor) - decimalParaNumero(movimento.valor)) > 0.01) throw new Error("O valor do movimento é diferente do valor da transferência");
    const existente = (await tx.select({ id: vinculosConciliacaoBancaria.id }).from(vinculosConciliacaoBancaria)
      .where(and(eq(vinculosConciliacaoBancaria.empresaId, empresaId), eq(vinculosConciliacaoBancaria.movimentoTransferenciaFinanceiraId, transferencia.id), sql`${vinculosConciliacaoBancaria.desfeitoEm} IS NULL`)).limit(1))[0];
    if (existente) throw new Error("Este lado da transferência já está conciliado em outro movimento bancário");
    const agora = new Date();
    const vinculoId = await criarOuReativarVinculoConciliacao(tx, {
      empresaId,
      movimentoExtratoBancarioId: movimento.id,
      movimentoTransferenciaFinanceiraId: transferencia.id,
      tipo: "transferencia",
      valorVinculado: transferencia.valor,
      criadoPor: userId,
    });
    await tx.update(movimentosExtratoBancario).set({
      estado: "conciliado",
      movimentoTransferenciaFinanceiraId: transferencia.id,
      conciliadoEm: agora,
      conciliadoPor: userId,
      observacoes: null,
    }).where(and(eq(movimentosExtratoBancario.id, movimento.id), eq(movimentosExtratoBancario.empresaId, empresaId), eq(movimentosExtratoBancario.estado, "pendente")));
    await tx.insert(auditoriasConciliacaoBancaria).values({
      empresaId,
      movimentoExtratoBancarioId: movimento.id,
      vinculoConciliacaoId: vinculoId,
      acao: "conciliado_transferencia",
      detalhes: `Transferência interna #${transferencia.transferenciaId} conciliada sem título, baixa, receita ou despesa`,
      usuarioId: userId,
    });
  });
  return { success: true };
}

export async function desfazerConciliacaoBancaria(movimentoId: number, userId: number, motivo = "Desfeito pelo usuário") {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    const movimento = (await tx.select().from(movimentosExtratoBancario)
      .where(and(eq(movimentosExtratoBancario.id, movimentoId), eq(movimentosExtratoBancario.empresaId, empresaId))).for("update").limit(1))[0];
    if (!movimento || movimento.estado !== "conciliado") throw new Error("Este movimento não possui uma conciliação para desfazer");
    const vinculo = (await tx.select().from(vinculosConciliacaoBancaria)
      .where(and(eq(vinculosConciliacaoBancaria.empresaId, empresaId), eq(vinculosConciliacaoBancaria.movimentoExtratoBancarioId, movimento.id), sql`${vinculosConciliacaoBancaria.desfeitoEm} IS NULL`))
      .for("update").limit(1))[0];
    if (!vinculo) throw new Error("O vínculo de auditoria da conciliação não foi encontrado");
    const agora = new Date();
    if (vinculo.baixaFinanceiraId) {
      await tx.update(baixasFinanceiras).set({ conciliada: false, conciliadaEm: null })
        .where(and(eq(baixasFinanceiras.id, vinculo.baixaFinanceiraId), eq(baixasFinanceiras.empresaId, empresaId)));
    }
    await tx.update(movimentosExtratoBancario).set({
      estado: "pendente",
      baixaFinanceiraId: null,
      movimentoTransferenciaFinanceiraId: null,
      conciliadoEm: null,
      conciliadoPor: null,
    }).where(and(eq(movimentosExtratoBancario.id, movimento.id), eq(movimentosExtratoBancario.empresaId, empresaId)));
    await tx.update(vinculosConciliacaoBancaria).set({ desfeitoEm: agora, desfeitoPor: userId, motivoDesfeito: motivo.trim() || "Desfeito pelo usuário" })
      .where(and(eq(vinculosConciliacaoBancaria.id, vinculo.id), eq(vinculosConciliacaoBancaria.empresaId, empresaId)));
    if (vinculo.tipo === "baixa_gerada" && vinculo.baixaFinanceiraId) {
      await estornarBaixaFinanceira(vinculo.baixaFinanceiraId, userId, "Conciliação bancária desfeita", { database: tx, agora });
    }
    await tx.insert(auditoriasConciliacaoBancaria).values({
      empresaId,
      movimentoExtratoBancarioId: movimento.id,
      vinculoConciliacaoId: vinculo.id,
      acao: "desfeito",
      detalhes: motivo.trim() || "Conciliação desfeita pelo usuário",
      usuarioId: userId,
    });
  });
  return { success: true };
}

export async function criarLancamentoDaConciliacao(input: { movimentoId: number; categoriaId: number; centroCustoId?: number | null; descricao: string; observacoes?: string | null }, userId: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    const movimento = (await tx.select().from(movimentosExtratoBancario)
      .where(and(eq(movimentosExtratoBancario.id, input.movimentoId), eq(movimentosExtratoBancario.empresaId, empresaId))).for("update").limit(1))[0];
    if (!movimento || movimento.estado !== "pendente") throw new Error("O movimento deve estar pendente para criar um lançamento");
    const categoria = (await tx.select().from(categoriasFinanceiras)
      .where(and(eq(categoriasFinanceiras.id, input.categoriaId), eq(categoriasFinanceiras.ativo, true), eq(categoriasFinanceiras.empresaId, empresaId))).limit(1))[0];
    if (!categoria) throw new Error("Selecione uma categoria financeira ativa");
    const tipo = movimento.tipo === "entrada" ? "receber" as const : "pagar" as const;
    if (categoria.tipo !== "ambos" && categoria.tipo !== (tipo === "receber" ? "receita" : "despesa")) throw new Error("A categoria selecionada não corresponde ao tipo do movimento");
    const titulo = await garantirTituloFinanceiroComChave({
      database: tx,
      tipo,
      origem: "manual",
      chaveIdempotencia: `CONCILIACAO-MOV-${empresaId}-${movimento.id}`,
      descricao: input.descricao.trim(),
      categoriaId: categoria.id,
      centroCustoId: input.centroCustoId,
      valorOriginal: movimento.valor,
      dataEmissao: movimento.dataMovimento,
      dataVencimento: movimento.dataMovimento,
      competencia: movimento.dataMovimento,
      observacoes: input.observacoes ?? `Criado pela conciliação do movimento bancário #${movimento.id}`,
      criadoPor: userId,
    });
    const baixa = await registrarBaixaFinanceira({
      tituloId: titulo.id,
      contaFinanceiraId: movimento.contaFinanceiraId,
      valor: movimento.valor,
      dataBaixa: movimento.dataMovimento,
      formaPagamento: "extrato_bancario",
      observacoes: "Baixa criada explicitamente pela conciliação bancária",
      origemBaixa: "conciliacao",
      criadoPor: userId,
    }, tx);
    const agora = new Date();
    const vinculoId = await criarOuReativarVinculoConciliacao(tx, {
      empresaId,
      movimentoExtratoBancarioId: movimento.id,
      baixaFinanceiraId: baixa.id,
      tipo: "baixa_gerada",
      valorVinculado: movimento.valor,
      criadoPor: userId,
    });
    await tx.update(baixasFinanceiras).set({ conciliada: true, conciliadaEm: agora })
      .where(and(eq(baixasFinanceiras.id, baixa.id), eq(baixasFinanceiras.empresaId, empresaId)));
    await tx.update(movimentosExtratoBancario).set({ estado: "conciliado", baixaFinanceiraId: baixa.id, conciliadoEm: agora, conciliadoPor: userId, observacoes: input.observacoes ?? null })
      .where(and(eq(movimentosExtratoBancario.id, movimento.id), eq(movimentosExtratoBancario.empresaId, empresaId), eq(movimentosExtratoBancario.estado, "pendente")));
    await tx.insert(auditoriasConciliacaoBancaria).values([
      {
        empresaId,
        movimentoExtratoBancarioId: movimento.id,
        vinculoConciliacaoId: vinculoId,
        acao: "baixa_criada",
        detalhes: `Título #${titulo.id} e baixa #${baixa.id} criados mediante ação explícita do usuário`,
        usuarioId: userId,
      },
      {
        empresaId,
        movimentoExtratoBancarioId: movimento.id,
        vinculoConciliacaoId: vinculoId,
        acao: "conciliado_baixa",
        detalhes: `Baixa #${baixa.id} conciliada com o movimento bancário`,
        usuarioId: userId,
      },
    ]);
  });
  return { success: true };
}

export async function definirEstadoMovimentoBancario(input: { movimentoId: number; estado: "ignorado" | "divergente"; observacoes?: string | null }, userId: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    const movimento = (await tx.select().from(movimentosExtratoBancario)
      .where(and(eq(movimentosExtratoBancario.id, input.movimentoId), eq(movimentosExtratoBancario.empresaId, empresaId))).for("update").limit(1))[0];
    if (!movimento) throw new Error("Movimento bancário não encontrado");
    if (movimento.estado === "conciliado") throw new Error("Desfaça a conciliação antes de alterar o estado do movimento");
    await tx.update(movimentosExtratoBancario).set({ estado: input.estado, observacoes: input.observacoes ?? null })
      .where(and(eq(movimentosExtratoBancario.id, movimento.id), eq(movimentosExtratoBancario.empresaId, empresaId)));
    await tx.insert(auditoriasConciliacaoBancaria).values({
      empresaId,
      movimentoExtratoBancarioId: movimento.id,
      acao: input.estado,
      detalhes: input.observacoes ?? (input.estado === "ignorado" ? "Movimento ignorado pelo usuário" : "Movimento sinalizado como divergente"),
      usuarioId: userId,
    });
  });
  return { success: true };
}

export async function getRelatorioFluxoCaixa(periodo: { dataInicio: Date; dataFim: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const empresaId = (await getEmpresaUnica()).id;
  const fim = new Date(periodo.dataFim);
  fim.setHours(23, 59, 59, 999);
  const [contas, movimentos] = await Promise.all([
    db.select({ saldoInicial: contasFinanceiras.saldoInicial }).from(contasFinanceiras)
      .where(eq(contasFinanceiras.empresaId, empresaId)),
    db.select({
      id: baixasFinanceiras.id,
      tituloId: baixasFinanceiras.tituloId,
      tipo: titulosFinanceiros.tipo,
      origem: titulosFinanceiros.origem,
      descricao: titulosFinanceiros.descricao,
      valor: baixasFinanceiras.valor,
      dataBaixa: baixasFinanceiras.dataBaixa,
      formaPagamento: baixasFinanceiras.formaPagamento,
      estornada: baixasFinanceiras.estornada,
      contaNome: contasFinanceiras.nome,
    }).from(baixasFinanceiras)
      .innerJoin(titulosFinanceiros, eq(baixasFinanceiras.tituloId, titulosFinanceiros.id))
      .leftJoin(contasFinanceiras, eq(baixasFinanceiras.contaFinanceiraId, contasFinanceiras.id))
      .where(and(
        eq(baixasFinanceiras.empresaId, empresaId),
        eq(titulosFinanceiros.empresaId, empresaId),
        eq(baixasFinanceiras.estornada, false),
        lte(baixasFinanceiras.dataBaixa, fim),
      ))
      .orderBy(asc(baixasFinanceiras.dataBaixa), asc(baixasFinanceiras.id)),
  ]);
  const saldoInicialContas = contas.reduce((total, conta) => total + decimalParaNumero(conta.saldoInicial), 0);
  return calcularRelatorioFluxoCaixa({ ...periodo, saldoInicialContas, movimentos });
}

/**
 * Leitura gerencial derivada das fontes financeiras já existentes. Não insere nem altera
 * títulos, baixas, transferências, extratos ou conciliações.
 */
export async function getFluxoCaixaGerencial(input: {
  dataInicio: Date;
  dataFim: Date;
  contaFinanceiraId?: number;
  dataReferencia?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const empresaId = (await getEmpresaUnica()).id;
  const dataReferencia = new Date(input.dataReferencia ?? new Date());
  dataReferencia.setHours(23, 59, 59, 999);
  const limiteMovimentos = input.dataFim > dataReferencia ? input.dataFim : dataReferencia;
  const filtroContaBaixa = input.contaFinanceiraId ? eq(baixasFinanceiras.contaFinanceiraId, input.contaFinanceiraId) : undefined;
  const filtroContaTransferencia = input.contaFinanceiraId ? eq(movimentosTransferenciasFinanceiras.contaFinanceiraId, input.contaFinanceiraId) : undefined;
  const filtroContaExtrato = input.contaFinanceiraId ? eq(movimentosExtratoBancario.contaFinanceiraId, input.contaFinanceiraId) : undefined;

  const [contas, titulos, baixas, transferencias, pendenciasExtrato] = await Promise.all([
    db.select({ id: contasFinanceiras.id, nome: contasFinanceiras.nome, saldoInicial: contasFinanceiras.saldoInicial })
      .from(contasFinanceiras)
      .where(and(eq(contasFinanceiras.empresaId, empresaId), ...(input.contaFinanceiraId ? [eq(contasFinanceiras.id, input.contaFinanceiraId)] : []))),
    db.select({
      id: titulosFinanceiros.id,
      tipo: titulosFinanceiros.tipo,
      descricao: titulosFinanceiros.descricao,
      origem: titulosFinanceiros.origem,
      valorOriginal: titulosFinanceiros.valorOriginal,
      desconto: titulosFinanceiros.desconto,
      juros: titulosFinanceiros.juros,
      dataVencimento: titulosFinanceiros.dataVencimento,
      estado: titulosFinanceiros.estado,
      categoria: categoriasFinanceiras.nome,
      contraparteNome: titulosFinanceiros.contraparteNome,
      clienteNome: clientes.nome,
      fornecedorNome: fornecedores.nome,
    }).from(titulosFinanceiros)
      .leftJoin(categoriasFinanceiras, eq(titulosFinanceiros.categoriaId, categoriasFinanceiras.id))
      .leftJoin(clientes, eq(titulosFinanceiros.clienteId, clientes.id))
      .leftJoin(fornecedores, eq(titulosFinanceiros.fornecedorId, fornecedores.id))
      .where(eq(titulosFinanceiros.empresaId, empresaId)),
    db.select({
      id: baixasFinanceiras.id,
      tituloId: baixasFinanceiras.tituloId,
      contaFinanceiraId: baixasFinanceiras.contaFinanceiraId,
      tipo: titulosFinanceiros.tipo,
      valor: baixasFinanceiras.valor,
      dataBaixa: baixasFinanceiras.dataBaixa,
      estornada: baixasFinanceiras.estornada,
      descricao: titulosFinanceiros.descricao,
      origem: titulosFinanceiros.origem,
      categoria: categoriasFinanceiras.nome,
      contraparteNome: titulosFinanceiros.contraparteNome,
      clienteNome: clientes.nome,
      fornecedorNome: fornecedores.nome,
    }).from(baixasFinanceiras)
      .innerJoin(titulosFinanceiros, eq(baixasFinanceiras.tituloId, titulosFinanceiros.id))
      .leftJoin(categoriasFinanceiras, eq(titulosFinanceiros.categoriaId, categoriasFinanceiras.id))
      .leftJoin(clientes, eq(titulosFinanceiros.clienteId, clientes.id))
      .leftJoin(fornecedores, eq(titulosFinanceiros.fornecedorId, fornecedores.id))
      .where(and(
        eq(baixasFinanceiras.empresaId, empresaId),
        eq(titulosFinanceiros.empresaId, empresaId),
        lte(baixasFinanceiras.dataBaixa, limiteMovimentos),
        ...(filtroContaBaixa ? [filtroContaBaixa] : []),
      )),
    db.select({
      id: movimentosTransferenciasFinanceiras.id,
      contaFinanceiraId: movimentosTransferenciasFinanceiras.contaFinanceiraId,
      tipo: movimentosTransferenciasFinanceiras.tipo,
      valor: movimentosTransferenciasFinanceiras.valor,
      dataMovimento: movimentosTransferenciasFinanceiras.dataMovimento,
      descricao: movimentosTransferenciasFinanceiras.descricao,
    }).from(movimentosTransferenciasFinanceiras)
      .innerJoin(transferenciasFinanceiras, eq(movimentosTransferenciasFinanceiras.transferenciaId, transferenciasFinanceiras.id))
      .where(and(
        eq(movimentosTransferenciasFinanceiras.empresaId, empresaId),
        eq(transferenciasFinanceiras.empresaId, empresaId),
        eq(transferenciasFinanceiras.estado, "efetivada"),
        lte(movimentosTransferenciasFinanceiras.dataMovimento, limiteMovimentos),
        ...(filtroContaTransferencia ? [filtroContaTransferencia] : []),
      )),
    db.select({ total: sql<number>`count(*)` }).from(movimentosExtratoBancario).where(and(
      eq(movimentosExtratoBancario.empresaId, empresaId),
      inArray(movimentosExtratoBancario.estado, ["pendente", "divergente"]),
      ...(filtroContaExtrato ? [filtroContaExtrato] : []),
    )),
  ]);
  const contraparte = (registro: { contraparteNome: string | null; clienteNome: string | null; fornecedorNome: string | null }) => (
    registro.contraparteNome || registro.clienteNome || registro.fornecedorNome || null
  );
  return montarFluxoCaixaGerencial({
    contas,
    titulos: titulos.map((titulo) => ({ ...titulo, contraparte: contraparte(titulo) })),
    baixas: baixas.map((baixa) => ({ ...baixa, contraparte: contraparte(baixa) })),
    transferencias,
    dataInicio: input.dataInicio,
    dataFim: input.dataFim,
    dataReferencia,
    contaFinanceiraId: input.contaFinanceiraId,
    movimentosBancariosNaoConciliados: Number(pendenciasExtrato[0]?.total ?? 0),
  });
}

export async function getPrevisaoSemanalCaixa(semanas = 8) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const empresaId = (await getEmpresaUnica()).id;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const fimHoje = new Date(hoje);
  fimHoje.setHours(23, 59, 59, 999);
  const [contas, baixasRealizadas, titulos] = await Promise.all([
    db.select({ saldoInicial: contasFinanceiras.saldoInicial }).from(contasFinanceiras)
      .where(eq(contasFinanceiras.empresaId, empresaId)),
    db.select({
      tipo: titulosFinanceiros.tipo,
      valor: baixasFinanceiras.valor,
      dataBaixa: baixasFinanceiras.dataBaixa,
    }).from(baixasFinanceiras)
      .innerJoin(titulosFinanceiros, eq(baixasFinanceiras.tituloId, titulosFinanceiros.id))
      .where(and(
        eq(baixasFinanceiras.empresaId, empresaId),
        eq(titulosFinanceiros.empresaId, empresaId),
        eq(baixasFinanceiras.estornada, false),
        lte(baixasFinanceiras.dataBaixa, fimHoje),
      )),
    db.select({
      tipo: titulosFinanceiros.tipo,
      valorOriginal: titulosFinanceiros.valorOriginal,
      valorBaixado: titulosFinanceiros.valorBaixado,
      desconto: titulosFinanceiros.desconto,
      juros: titulosFinanceiros.juros,
      dataVencimento: titulosFinanceiros.dataVencimento,
      estado: titulosFinanceiros.estado,
    }).from(titulosFinanceiros)
      .where(and(
        eq(titulosFinanceiros.empresaId, empresaId),
        inArray(titulosFinanceiros.estado, ["aberto", "parcial", "vencido"]),
      )),
  ]);
  const saldoDasContas = contas.reduce((total, conta) => total + decimalParaNumero(conta.saldoInicial), 0);
  const saldoRealizado = baixasRealizadas.reduce((total, baixa) => (
    total + (baixa.tipo === "receber" ? decimalParaNumero(baixa.valor) : -decimalParaNumero(baixa.valor))
  ), 0);
  return calcularPrevisaoSemanal({
    saldoAtual: saldoDasContas + saldoRealizado,
    titulos,
    semanas,
    agora: hoje,
  });
}

export async function estornarBaixaFinanceira(
  id: number,
  userId: number,
  motivo: string,
  dependencias: { database?: any; buscarBaixa?: (id: number) => Promise<any>; buscarTitulo?: (id: number) => Promise<any>; agora?: Date } | undefined,
) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const executar = async (tx: any) => {
    const baixa = dependencias?.buscarBaixa
      ? await dependencias.buscarBaixa(id)
      : (await tx.select().from(baixasFinanceiras).where(and(eq(baixasFinanceiras.id, id), eq(baixasFinanceiras.empresaId, empresaId))).for("update").limit(1))[0];
    if (!baixa) throw new Error("Baixa financeira não encontrada");
    if (!podeEstornarBaixa(baixa.estornada)) throw new Error("Esta baixa já foi estornada e não pode ser revertida novamente");
    if (baixa.conciliada) throw new Error("Desconcilie este lançamento bancário antes de estornar a baixa");

    const titulo = dependencias?.buscarTitulo
      ? await dependencias.buscarTitulo(baixa.tituloId)
      : (await tx.select().from(titulosFinanceiros).where(and(
        eq(titulosFinanceiros.id, baixa.tituloId),
        eq(titulosFinanceiros.empresaId, empresaId),
      )).for("update").limit(1))[0];
    if (!titulo) throw new Error("Título financeiro não encontrado para a baixa selecionada");
    if (titulo.estado === "cancelado") throw new Error("Não é possível estornar uma baixa de título cancelado");

    const estornadaEm = dependencias?.agora ?? new Date();
    if (!dependencias) {
      const chequesDaEntrada = await tx.select().from(chequesFinanceiros)
        .where(and(eq(chequesFinanceiros.empresaId, empresaId), eq(chequesFinanceiros.baixaEntradaId, baixa.id)));
      if (chequesDaEntrada.some((cheque: { estado: string }) => cheque.estado === "utilizado")) {
        throw new Error("Não é possível estornar este recebimento enquanto houver cheque já utilizado; estorne primeiro o pagamento correspondente");
      }
      const chequesDaSaida = await tx.select().from(chequesFinanceiros)
        .where(and(eq(chequesFinanceiros.empresaId, empresaId), eq(chequesFinanceiros.baixaSaidaId, baixa.id)));
      if (chequesDaSaida.length) {
        await tx.update(chequesFinanceiros).set({ estado: "disponivel", utilizadoEm: null, baixaSaidaId: null })
          .where(and(eq(chequesFinanceiros.empresaId, empresaId), eq(chequesFinanceiros.baixaSaidaId, baixa.id), eq(chequesFinanceiros.estado, "utilizado")));
      }
      if (chequesDaEntrada.length) {
        await tx.delete(chequesFinanceiros)
          .where(and(eq(chequesFinanceiros.empresaId, empresaId), eq(chequesFinanceiros.baixaEntradaId, baixa.id)));
      }
    }

    await tx.update(baixasFinanceiras).set({
      estornada: true,
      estornadaEm,
      estornadaPor: userId,
      motivoEstorno: motivo.trim(),
      conciliada: false,
      conciliadaEm: null,
    }).where(and(eq(baixasFinanceiras.id, id), eq(baixasFinanceiras.empresaId, empresaId)));
    const ciclo = await reconciliarCicloTituloFinanceiro(tx, titulo, empresaId, estornadaEm);
    if (titulo.orcamentoId && titulo.origem === "orcamento") {
      const parcelasDaVenda = await tx.select({ estado: titulosFinanceiros.estado }).from(titulosFinanceiros).where(and(
        eq(titulosFinanceiros.orcamentoId, titulo.orcamentoId),
        eq(titulosFinanceiros.origem, "orcamento"),
        eq(titulosFinanceiros.empresaId, empresaId),
        ne(titulosFinanceiros.estado, "cancelado"),
      ));
      if (parcelasDaVenda.some((parcela: { estado: string }) => parcela.estado !== "quitado")) {
        await tx.update(orcamentos).set({ pago: false, pagoEm: null, formaPagamento: null, pagoPor: null })
          .where(and(eq(orcamentos.id, titulo.orcamentoId), eq(orcamentos.empresaId, empresaId)));
      }
    }
    return { success: true, tituloId: titulo.id, estado: ciclo.estado, valorBaixado: ciclo.valorBaixadoFormatado };
  };
  return typeof db.transaction === "function" ? db.transaction(executar) : executar(db);
}

export async function devolverChequeFinanceiro(input: {
  id: number;
  motivo: string;
  dataDevolucao: Date;
  userId: number;
}) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const cheque = (await tx.select().from(chequesFinanceiros)
      .where(and(eq(chequesFinanceiros.id, input.id), eq(chequesFinanceiros.empresaId, empresaId))).for("update").limit(1))[0];
    if (!cheque) throw new Error("Cheque não encontrado");
    const baixa = (await tx.select().from(baixasFinanceiras)
      .where(and(eq(baixasFinanceiras.id, cheque.baixaEntradaId), eq(baixasFinanceiras.empresaId, empresaId))).for("update").limit(1))[0];
    if (!baixa) throw new Error("Recebimento de origem do cheque não encontrado");
    validarDevolucaoCheque({ estado: cheque.estado, baixaConciliada: Boolean(baixa.conciliada), motivo: input.motivo });
    const titulo = (await tx.select().from(titulosFinanceiros)
      .where(and(eq(titulosFinanceiros.id, baixa.tituloId), eq(titulosFinanceiros.empresaId, empresaId))).for("update").limit(1))[0];
    if (!titulo) throw new Error("Título financeiro de origem do cheque não encontrado");

    const valorCheque = decimalParaNumero(cheque.valor);
    const valorBaixa = decimalParaNumero(baixa.valor);
    const cicloAntesDaDevolucao = await reconciliarCicloTituloFinanceiro(tx, titulo, empresaId, input.dataDevolucao);
    if (valorCheque > valorBaixa + 0.005 || valorCheque > cicloAntesDaDevolucao.valorBaixado + 0.005) {
      throw new Error("O valor do cheque não é compatível com o recebimento de origem");
    }
    const valorRestanteBaixa = Math.max(0, valorBaixa - valorCheque);
    const motivo = input.motivo.trim();

    await tx.update(chequesFinanceiros).set({
      estado: "estornado",
      estornadoEm: input.dataDevolucao,
      motivoEstorno: motivo,
    }).where(and(eq(chequesFinanceiros.id, cheque.id), eq(chequesFinanceiros.empresaId, empresaId)));

    if (valorRestanteBaixa <= 0.005) {
      await tx.update(baixasFinanceiras).set({
        estornada: true,
        estornadaEm: input.dataDevolucao,
        estornadaPor: input.userId,
        motivoEstorno: `Cheque devolvido: ${motivo}`,
        conciliada: false,
        conciliadaEm: null,
      }).where(and(eq(baixasFinanceiras.id, baixa.id), eq(baixasFinanceiras.empresaId, empresaId)));
    } else {
      await tx.update(baixasFinanceiras).set({ valor: valorRestanteBaixa.toFixed(2) })
        .where(and(eq(baixasFinanceiras.id, baixa.id), eq(baixasFinanceiras.empresaId, empresaId)));
    }
    const ciclo = await reconciliarCicloTituloFinanceiro(tx, titulo, empresaId, input.dataDevolucao);
    return { success: true, tituloId: titulo.id, estadoTitulo: ciclo.estado, valorDevolvido: valorCheque };
  });
}

export async function atualizarTituloFinanceiro(
  id: number,
  dados: {
    tipo: "receber" | "pagar";
    descricao: string;
    categoriaId: number;
    centroCustoId?: number | null;
    valorOriginal: string;
    dataEmissao: Date;
    dataVencimento: Date;
    clienteId?: number | null;
    fornecedorId?: number | null;
    contraparteNome?: string | null;
    desconto?: string;
    juros?: string;
    observacoes?: string | null;
  },
) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const titulo = await getTituloFinanceiroById(id);
  if (!titulo) throw new Error("Lançamento financeiro não encontrado");
  const baixasConciliadas = await db.select({ id: baixasFinanceiras.id }).from(baixasFinanceiras)
    .where(and(eq(baixasFinanceiras.empresaId, empresaId), eq(baixasFinanceiras.tituloId, id), eq(baixasFinanceiras.conciliada, true), eq(baixasFinanceiras.estornada, false))).limit(1);

  const valorOriginal = decimalParaNumero(dados.valorOriginal);
  const desconto = decimalParaNumero(dados.desconto ?? "0");
  const juros = decimalParaNumero(dados.juros ?? "0");
  const valorBaixado = decimalParaNumero(titulo.valorBaixado);
  validarEdicaoTituloFinanceiro({
    estado: titulo.estado,
    possuiBaixaConciliada: baixasConciliadas.length > 0,
    tipoAtual: titulo.tipo,
    novoTipo: dados.tipo,
    descricao: dados.descricao,
    valorOriginal,
    desconto,
    juros,
    valorBaixado,
  });
  const centroCustoId = dados.centroCustoId == null ? null : (await obterCentroCustoAtivo(dados.centroCustoId, db, empresaId)).id;
  await db.update(titulosFinanceiros).set({
    tipo: dados.tipo,
    descricao: dados.descricao.trim(),
    categoriaId: dados.categoriaId,
    centroCustoId,
    valorOriginal: dados.valorOriginal,
    desconto: dados.desconto ?? "0",
    juros: dados.juros ?? "0",
    dataEmissao: dados.dataEmissao,
    dataVencimento: dados.dataVencimento,
    clienteId: dados.clienteId ?? null,
    fornecedorId: dados.fornecedorId ?? null,
    contraparteNome: dados.contraparteNome ?? null,
    observacoes: dados.observacoes ?? null,
  }).where(and(eq(titulosFinanceiros.id, id), eq(titulosFinanceiros.empresaId, empresaId)));
  const ciclo = await reconciliarCicloTituloFinanceiro(db, {
    ...titulo,
    valorOriginal: dados.valorOriginal,
    desconto: dados.desconto ?? "0",
    juros: dados.juros ?? "0",
    dataVencimento: dados.dataVencimento,
  }, empresaId);
  return { success: true, estado: ciclo.estado };
}

export async function atualizarTitulosFinanceirosEmLote(
  ids: number[],
  dados: {
    descricao?: string;
    categoriaId?: number;
    centroCustoId?: number | null;
    dataEmissao?: Date;
    dataVencimento?: Date;
    contraparteNome?: string | null;
    observacoes?: string | null;
  },
) {
  const empresaId = (await getEmpresaUnica()).id;
  const unicos = Array.from(new Set(ids));
  if (!unicos.length) throw new Error("Selecione pelo menos um lançamento");
  const titulos = await Promise.all(unicos.map((id) => getTituloFinanceiroById(id)));
  if (titulos.some((titulo) => !titulo)) throw new Error("Um dos lançamentos selecionados não foi encontrado");

  // A atualização individual é reutilizada intencionalmente: ela impede edição de
  // título conciliado, mantém valores/baixas e recalcula o estado de cada título.
  await Promise.all(titulos.map((titulo: any) => atualizarTituloFinanceiro(titulo.id, {
    tipo: titulo.tipo,
    descricao: dados.descricao ?? titulo.descricao,
    categoriaId: dados.categoriaId ?? titulo.categoriaId,
    centroCustoId: dados.centroCustoId === undefined ? titulo.centroCustoId : dados.centroCustoId,
    valorOriginal: titulo.valorOriginal,
    dataEmissao: dados.dataEmissao ?? titulo.dataEmissao,
    dataVencimento: dados.dataVencimento ?? titulo.dataVencimento,
    clienteId: titulo.clienteId,
    fornecedorId: titulo.fornecedorId,
    contraparteNome: dados.contraparteNome === undefined ? titulo.contraparteNome : dados.contraparteNome,
    desconto: titulo.desconto ?? "0",
    juros: titulo.juros ?? "0",
    observacoes: dados.observacoes === undefined ? titulo.observacoes : dados.observacoes,
  })));
  return { success: true, atualizados: unicos.length };
}

export async function excluirTituloFinanceiro(id: number, userId: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const titulo = await getTituloFinanceiroById(id);
  if (!titulo) throw new Error("Lançamento financeiro não encontrado");
  const baixas = await db.select().from(baixasFinanceiras)
    .where(and(eq(baixasFinanceiras.empresaId, empresaId), eq(baixasFinanceiras.tituloId, id), eq(baixasFinanceiras.estornada, false)));
  validarExclusaoTituloFinanceiro({ estado: titulo.estado, possuiBaixaConciliada: baixas.some((baixa) => baixa.conciliada) });
  for (const baixa of baixas) {
    await estornarBaixaFinanceira(baixa.id, userId, "Baixa revertida pela exclusão do lançamento financeiro", undefined);
  }
  await cancelarTituloFinanceiro(id, userId, { database: db });
  return { success: true, baixasEstornadas: baixas.length };
}

export async function cancelarTituloFinanceiro(id: number, userId: number, dependencias: { database?: any; buscarTitulo?: (id: number) => Promise<any> } | undefined) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const executar = async (tx: any) => {
    const titulo = dependencias?.buscarTitulo
      ? await dependencias.buscarTitulo(id)
      : (await tx.select().from(titulosFinanceiros).where(and(
        eq(titulosFinanceiros.id, id),
        eq(titulosFinanceiros.empresaId, empresaId),
      )).limit(1))[0];
    if (!titulo) throw new Error("Título financeiro não encontrado");
    const cicloAtual = await reconciliarCicloTituloFinanceiro(tx, titulo, empresaId);
    if (!podeCancelarTituloFinanceiro(cicloAtual.valorBaixado)) {
      throw new Error("Títulos com baixas devem ser regularizados por estorno antes do cancelamento");
    }
    const canceladoEm = new Date();
    await reconciliarCicloTituloFinanceiro(tx, titulo, empresaId, canceladoEm, true);
    await tx.update(titulosFinanceiros).set({ canceladoEm, canceladoPor: userId })
      .where(and(eq(titulosFinanceiros.id, id), eq(titulosFinanceiros.empresaId, empresaId)));
    return { success: true };
  };
  return typeof db.transaction === "function" ? db.transaction(executar) : executar(db);
}

export async function criarTituloReceberDeOrcamento(orcamentoId: number, userId: number, dataVencimento: Date | undefined) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const orcamento = (await db.select().from(orcamentos).where(and(eq(orcamentos.id, orcamentoId), eq(orcamentos.empresaId, empresaId))).limit(1))[0];
  if (!orcamento || orcamento.estado !== "aprovado" || orcamento.pago) return undefined;
  const existente = await db.select().from(titulosFinanceiros)
    .where(and(
      eq(titulosFinanceiros.origem, "orcamento"),
      eq(titulosFinanceiros.orcamentoId, orcamentoId),
      eq(titulosFinanceiros.empresaId, orcamento.empresaId),
      ne(titulosFinanceiros.estado, "cancelado"),
    )).limit(1);
  if (existente[0]) return existente[0];
  const categoriaId = await getOrCreateCategoriaReceitaVendas(userId);
  const criacao = await garantirTituloFinanceiroAutomatico({
    tipo: "receber",
    origem: "orcamento",
    chaveIdempotencia: `FIN-ORCAMENTO-${orcamentoId}-PARCELA-1`,
    descricao: `Venda ${orcamento.numero}`,
    clienteId: orcamento.clienteId,
    orcamentoId,
    categoriaId,
    centroCustoId: orcamento.centroCustoId ?? null,
    valorOriginal: orcamento.total,
    dataEmissao: new Date(),
    dataVencimento: orcamento.dataVencimento ?? dataVencimento ?? new Date(),
    competencia: orcamento.competencia,
    criadoPor: userId,
  });
  return getTituloFinanceiroById(criacao.id);
}

export type ParcelaCondicaoPagamentoVenda = {
  dataVencimento: Date;
};

export async function configurarCondicaoPagamentoVenda(
  orcamentoId: number,
  parcelasInformadas: ParcelaCondicaoPagamentoVenda[],
  userId: number,
  dependencias?: { database?: any; obterCategoriaReceita?: (usuarioId: number, empresa: number) => Promise<number> },
) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  if (!parcelasInformadas.length) throw new Error("Informe ao menos uma parcela para a condição de pagamento");

  const parcelas = [...parcelasInformadas].sort((primeira, segunda) => (
    primeira.dataVencimento.getTime() - segunda.dataVencimento.getTime()
  ));
  if (parcelas.some((parcela) => Number.isNaN(parcela.dataVencimento.getTime()))) {
    throw new Error("Informe datas de vencimento válidas para todas as parcelas");
  }
  const categoriaId = await (dependencias?.obterCategoriaReceita ?? getOrCreateCategoriaReceitaVendas)(userId, empresaId);

  return db.transaction(async (tx: any) => {
    const orcamento = (await tx.select().from(orcamentos)
      .where(and(eq(orcamentos.id, orcamentoId), eq(orcamentos.empresaId, empresaId))).limit(1))[0];
    if (!orcamento) throw new Error("Venda não encontrada para a empresa ativa");
    if (orcamento.estado !== "aprovado") throw new Error("A condição de pagamento só pode ser configurada em vendas aprovadas");
    if (orcamento.pago) throw new Error("A venda já está quitada e não pode ter a condição de pagamento alterada");

    const titulosExistentes = await tx.select().from(titulosFinanceiros).where(and(
      eq(titulosFinanceiros.origem, "orcamento"),
      eq(titulosFinanceiros.orcamentoId, orcamentoId),
      eq(titulosFinanceiros.empresaId, empresaId),
    ));
    if (titulosExistentes.some((titulo: { valorBaixado: string }) => decimalParaNumero(titulo.valorBaixado) > 0)) {
      throw new Error("Não é possível alterar a condição de uma venda que possui parcelas baixadas. Estorne as baixas primeiro.");
    }

    const titulosAtivos = titulosExistentes.filter((titulo: { estado: string }) => titulo.estado !== "cancelado");
    const tituloIdsAtivos = titulosAtivos.map((titulo: { id: number }) => titulo.id);
    const agora = new Date();
    if (tituloIdsAtivos.length) {
      for (const titulo of titulosAtivos) {
        await reconciliarCicloTituloFinanceiro(tx, titulo, empresaId, agora, true);
        await tx.update(titulosFinanceiros).set({ canceladoEm: agora, canceladoPor: userId })
          .where(and(eq(titulosFinanceiros.id, titulo.id), eq(titulosFinanceiros.empresaId, empresaId)));
      }
      await tx.update(alertasFinanceiros).set({ resolvidoEm: agora })
        .where(inArray(alertasFinanceiros.tituloId, tituloIdsAtivos));
    }

    const valoresParcelas = calcularParcelas(orcamento.total, parcelas.length);
    const grupoParcelamento = `VND-${orcamentoId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const novasParcelas = parcelas.map((parcela, indice) => ({
      tipo: "receber" as const,
      origem: "orcamento" as const,
      descricao: `Venda ${orcamento.numero ?? orcamentoId} · Parcela ${indice + 1}/${parcelas.length}`,
      clienteId: orcamento.clienteId,
      fornecedorId: null,
      contraparteNome: null,
      orcamentoId,
      categoriaId,
      centroCustoId: orcamento.centroCustoId ?? null,
      recorrenciaId: null,
      grupoParcelamento,
      numeroParcela: indice + 1,
      totalParcelas: parcelas.length,
      valorOriginal: valoresParcelas[indice],
      desconto: "0",
      juros: "0",
      valorBaixado: "0",
      dataEmissao: agora,
      dataVencimento: parcela.dataVencimento,
      competencia: orcamento.competencia,
      estado: calcularEstadoTitulo({ valorOriginal: valoresParcelas[indice], dataVencimento: parcela.dataVencimento }),
      observacoes: `Condição de pagamento da venda ${orcamento.numero ?? orcamentoId}`,
      criadoPor: userId,
    }));
    for (let indice = 0; indice < novasParcelas.length; indice += 1) {
      const parcela = novasParcelas[indice];
      await garantirTituloFinanceiroAutomatico({
        ...parcela,
        chaveIdempotencia: `FIN-ORCAMENTO-${orcamentoId}-${grupoParcelamento}-PARCELA-${indice + 1}`,
        database: tx,
      });
    }
    const parcelasCriadas = await tx.select({
      id: titulosFinanceiros.id,
      numeroParcela: titulosFinanceiros.numeroParcela,
      totalParcelas: titulosFinanceiros.totalParcelas,
      dataVencimento: titulosFinanceiros.dataVencimento,
      valorOriginal: titulosFinanceiros.valorOriginal,
    }).from(titulosFinanceiros).where(and(
      eq(titulosFinanceiros.empresaId, empresaId),
      eq(titulosFinanceiros.grupoParcelamento, grupoParcelamento),
    )).orderBy(asc(titulosFinanceiros.numeroParcela));

    await tx.update(orcamentos).set({ dataVencimento: parcelas[0].dataVencimento })
      .where(and(eq(orcamentos.id, orcamentoId), eq(orcamentos.empresaId, empresaId)));
    await tx.insert(historicoAlteracoes).values({
      empresaId,
      orcamentoId,
      usuarioId: userId,
      tipo: "alteracao" as any,
      detalhes: JSON.stringify({
        acao: "condicao_pagamento_configurada",
        grupoParcelamento,
        totalParcelas: parcelas.length,
        vencimentos: parcelas.map((parcela) => parcela.dataVencimento.toISOString()),
      }),
    });

    return {
      success: true,
      grupoParcelamento,
      parcelas: parcelasCriadas.map((parcela: {
        id: number;
        numeroParcela: number | null;
        totalParcelas: number | null;
        dataVencimento: Date;
        valorOriginal: string;
      }) => ({
        id: parcela.id,
        numeroParcela: parcela.numeroParcela,
        totalParcelas: parcela.totalParcelas,
        dataVencimento: parcela.dataVencimento,
        valor: parcela.valorOriginal,
      })),
      titulosCancelados: tituloIdsAtivos,
    };
  });
}

export async function listRecorrenciasFinanceiras() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(recorrenciasFinanceiras).orderBy(desc(recorrenciasFinanceiras.proximoVencimento));
}

export async function createRecorrenciaFinanceira(data: InsertRecorrenciaFinanceira) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (decimalParaNumero(data.valor) <= 0) throw new Error("O valor da recorrência deve ser maior que zero");
  if (data.centroCustoId != null) await obterCentroCustoAtivo(data.centroCustoId, db, data.empresaId);
  const result = await db.insert(recorrenciasFinanceiras).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

export async function updateRecorrenciaFinanceira(id: number, data: Partial<InsertRecorrenciaFinanceira>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (data.centroCustoId != null) await obterCentroCustoAtivo(data.centroCustoId, db);
  await db.update(recorrenciasFinanceiras).set(data).where(eq(recorrenciasFinanceiras.id, id));
  return { success: true };
}

export async function getConfiguracaoFinanceiraByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(configuracoesFinanceiras)
    .where(eq(configuracoesFinanceiras.alertaCronTaskUid, taskUid)).limit(1);
  return result[0];
}

export async function configurarProcessamentoFinanceiro(taskUid: string) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existente = await db.select().from(configuracoesFinanceiras).where(eq(configuracoesFinanceiras.empresaId, empresaId)).limit(1);
  if (existente[0]) {
    await db.update(configuracoesFinanceiras).set({ alertaCronTaskUid: taskUid }).where(eq(configuracoesFinanceiras.empresaId, empresaId));
  } else {
    await db.insert(configuracoesFinanceiras).values({ id: empresaId, empresaId, alertaCronTaskUid: taskUid, alertaDiasAntecedencia: 7 });
  }
  return { success: true };
}

export async function listAlertasFinanceiros() {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  const agora = new Date();
  const configuracao = (await db.select().from(configuracoesFinanceiras).where(eq(configuracoesFinanceiras.empresaId, empresaId)).limit(1))[0];
  const diasAntecedencia = configuracao?.alertaDiasAntecedencia ?? 7;
  const alertasAtivos = await db.select({
    id: alertasFinanceiros.id,
    tituloId: alertasFinanceiros.tituloId,
    tipo: alertasFinanceiros.tipo,
    mensagem: alertasFinanceiros.mensagem,
    criadoEm: alertasFinanceiros.criadoEm,
    descricao: titulosFinanceiros.descricao,
    valorOriginal: titulosFinanceiros.valorOriginal,
    desconto: titulosFinanceiros.desconto,
    juros: titulosFinanceiros.juros,
    valorBaixado: titulosFinanceiros.valorBaixado,
    dataVencimento: titulosFinanceiros.dataVencimento,
    estadoTitulo: titulosFinanceiros.estado,
    tipoTitulo: titulosFinanceiros.tipo,
  }).from(alertasFinanceiros)
    .innerJoin(titulosFinanceiros, eq(alertasFinanceiros.tituloId, titulosFinanceiros.id))
    .where(and(eq(alertasFinanceiros.estado, "ativo"), eq(alertasFinanceiros.empresaId, empresaId)))
    .orderBy(desc(alertasFinanceiros.createdAt));

  const alertasAtuais = [] as typeof alertasAtivos;
  for (const alerta of alertasAtivos) {
    const tipoAtual = tipoAlertaAtualDoTitulo({
      valorOriginal: alerta.valorOriginal,
      desconto: alerta.desconto,
      juros: alerta.juros,
      valorBaixado: alerta.valorBaixado,
      dataVencimento: alerta.dataVencimento,
      estadoPersistido: alerta.estadoTitulo,
      diasAntecedencia,
      agora,
    });

    if (tipoAtual === alerta.tipo) {
      alertasAtuais.push(alerta);
      continue;
    }

    await db.update(alertasFinanceiros)
      .set({ estado: "resolvido", resolvidoEm: agora })
      .where(and(eq(alertasFinanceiros.id, alerta.id), eq(alertasFinanceiros.estado, "ativo")));
  }
  return alertasAtuais;
}

export async function processarAlertasFinanceiros(agora = new Date(), database?: any) {
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const configuracoes = await db.select().from(configuracoesFinanceiras);
  const diasPorEmpresa = new Map<number, number>(configuracoes.map((configuracao: { empresaId: number; alertaDiasAntecedencia: number }) => [Number(configuracao.empresaId), Number(configuracao.alertaDiasAntecedencia)]));
  const titulos = await db.select().from(titulosFinanceiros);
  let alertasCriados = 0;
  let alertasResolvidos = 0;

  for (const titulo of titulos) {
    const diasAntecedencia = diasPorEmpresa.get(titulo.empresaId) ?? 7;
    const ciclo = await reconciliarCicloTituloFinanceiro(db, titulo, titulo.empresaId, agora);
    const tipoAtual = tipoAlertaAtualDoTitulo({
      valorOriginal: titulo.valorOriginal,
      desconto: titulo.desconto,
      juros: titulo.juros,
      valorBaixado: ciclo.valorBaixado,
      dataVencimento: titulo.dataVencimento,
      estadoPersistido: ciclo.estado,
      diasAntecedencia,
      agora,
    });
    const ativos = await db.select().from(alertasFinanceiros).where(and(eq(alertasFinanceiros.tituloId, titulo.id), eq(alertasFinanceiros.empresaId, titulo.empresaId), eq(alertasFinanceiros.estado, "ativo")));
    const plano = planejarAtualizacaoAlertas(tipoAtual, ativos.map((alerta: { tipo: "vence_em_breve" | "vencido" }) => alerta.tipo));

    if (plano.resolver.length) {
      await db.update(alertasFinanceiros).set({ estado: "resolvido", resolvidoEm: agora })
        .where(and(eq(alertasFinanceiros.tituloId, titulo.id), eq(alertasFinanceiros.empresaId, titulo.empresaId), eq(alertasFinanceiros.estado, "ativo")));
      alertasResolvidos += plano.resolver.length;
    }
    if (plano.criar) {
      const vencimentoFormatado = titulo.dataVencimento.toLocaleDateString("pt-BR");
      const mensagem = plano.criar === "vencido"
        ? `${titulo.descricao} está vencido desde ${vencimentoFormatado}.`
        : `${titulo.descricao} vence em ${vencimentoFormatado}.`;
      await db.insert(alertasFinanceiros).values({ empresaId: titulo.empresaId, tituloId: titulo.id, tipo: plano.criar, mensagem, estado: "ativo" });
      alertasCriados += 1;
    }
  }
  return { alertasCriados, alertasResolvidos };
}

export async function processarRecorrenciasFinanceiras(agora = new Date(), database?: any) {
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const recorrencias = await db.select().from(recorrenciasFinanceiras).where(eq(recorrenciasFinanceiras.ativa, true));
  let titulosGerados = 0;

  for (const recorrencia of recorrencias) {
    let vencimento = new Date(recorrencia.proximoVencimento);
    const fim = recorrencia.dataFim ? new Date(recorrencia.dataFim) : null;
    while (vencimento <= agora && (!fim || vencimento <= fim)) {
      const chaveIdempotencia = `FIN-RECORRENCIA-${recorrencia.id}-${vencimento.toISOString().slice(0, 10)}`;
      const resultado = await garantirTituloFinanceiroAutomatico({
        tipo: recorrencia.tipo,
        origem: "recorrencia",
        chaveIdempotencia,
        descricao: recorrencia.descricao,
        clienteId: recorrencia.clienteId,
        fornecedorId: recorrencia.fornecedorId,
        contraparteNome: recorrencia.contraparteNome,
        categoriaId: recorrencia.categoriaId,
        centroCustoId: recorrencia.centroCustoId,
        recorrenciaId: recorrencia.id,
        valorOriginal: recorrencia.valor,
        dataEmissao: vencimento,
        dataVencimento: vencimento,
        observacoes: recorrencia.observacoes,
        criadoPor: recorrencia.criadoPor,
        database: db,
      });
      if (resultado.criado) titulosGerados += 1;
      vencimento = proximoVencimento(vencimento, recorrencia.frequencia);
    }
    if (vencimento.getTime() !== new Date(recorrencia.proximoVencimento).getTime()) {
      const ativa = !fim || vencimento <= fim;
      await db.update(recorrenciasFinanceiras).set({ proximoVencimento: vencimento, ativa }).where(eq(recorrenciasFinanceiras.id, recorrencia.id));
    }
  }

  const alertas = await processarAlertasFinanceiros(agora, db);
  await db.update(configuracoesFinanceiras).set({ ultimoProcessamentoEm: agora });
  return { titulosGerados, recorrenciasAnalisadas: recorrencias.length, ...alertas };
}
