import { eq, and, asc, desc, gte, lte, ne, inArray, or, sql, type InferSelectModel, type SQL } from "drizzle-orm";
import {
  InsertUser, users, madeiras, bitolas, clientes,
  orcamentos, itensOrcamento, componentesPacoteOrcamento, taxasAdicionaisOrcamento, produtosComerciais, componentesProdutoComercial, modelosMedidaVenda, historicoAlteracoes, empresaConfiguracoes,
  empresas, credenciaisUsuarios, convitesEmpresa, recuperacoesSenha,
  fornecedores, categoriasFinanceiras, contasFinanceiras, titulosFinanceiros, sequenciasVendas, sequenciasDocumentos,
  baixasFinanceiras, chequesFinanceiros, recorrenciasFinanceiras, configuracoesFinanceiras, alertasFinanceiros, extratosBancarios, movimentosExtratoBancario, anexosFinanceiros,
  plaquetas, conferenciasVariacaoPlaquetas, romaneiosCargaToras, romaneiosProducao, itensRomaneioToras, itensRomaneioProducao, aproveitamentosRomaneioProducao, aproveitamentosOrcamento, serragensTerceiros, itensSerragemToras, itensSerragemPecas, retiradasSerragemTerceiros, itensRetiradaSerragemTerceiros, lotesPecasSerradas, movimentacoesPlaquetas, movimentacoesEstoqueSerrado, notasDiesel, abastecimentosDiesel,
  type InsertMadeira, type InsertBitola, type InsertCliente,
  type InsertOrcamento, type InsertItemOrcamento, type InsertComponentePacoteOrcamento, type InsertProdutoComercial, type InsertComponenteProdutoComercial, type InsertModeloMedidaVenda, type InsertFornecedor,
  type InsertCategoriaFinanceira, type InsertContaFinanceira,
  type InsertTituloFinanceiro, type InsertBaixaFinanceira, type InsertChequeFinanceiro, type InsertRecorrenciaFinanceira,
} from "../../drizzle/schema";
import { ENV } from '../_core/env';
import { calcularEstadoTitulo, calcularParcelas, calcularPrevisaoSemanal, calcularRelatorioFluxoCaixa, classificarAlertaCompensacaoCheque, decimalParaNumero, planejarAtualizacaoAlertas, podeCancelarTituloFinanceiro, podeEstornarBaixa, proximoVencimento, saldoAbertoTitulo, tipoAlertaAtualDoTitulo, validarDepositoCheque, validarDevolucaoCheque, validarEdicaoTituloFinanceiro, validarExclusaoTituloFinanceiro, validarValorDosCheques } from "../financeiro.logic";
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
import { sugerirConciliacoes } from "../conciliacao.logic";
import { numerarDuplicidadesPlaquetas } from "../../shared/plaquetas";

import { getDb } from "./core";
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

// ─── Madeiras ───
export async function listMadeiras() {
  const db = await getDb();
  if (!db) return [];
  const empresaId = (await getEmpresaUnica()).id;
  return db.select().from(madeiras).where(eq(madeiras.empresaId, empresaId)).orderBy(desc(madeiras.createdAt));
}

export async function getMadeiraById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const empresaId = (await getEmpresaUnica()).id;
  const result = await db.select().from(madeiras).where(and(eq(madeiras.id, id), eq(madeiras.empresaId, empresaId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createMadeira(data: InsertMadeira) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(madeiras).values(data);
  return result;
}

export async function updateMadeira(id: number, data: Partial<InsertMadeira>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const empresaId = (await getEmpresaUnica()).id;
  await db.update(madeiras).set(data).where(and(eq(madeiras.id, id), eq(madeiras.empresaId, empresaId)));
  return { success: true };
}

export async function deleteMadeira(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const empresaId = (await getEmpresaUnica()).id;
  await db.update(madeiras).set({ ativo: false }).where(and(eq(madeiras.id, id), eq(madeiras.empresaId, empresaId)));
  return { success: true };
}

// ─── Bitolas ───
export async function listBitolas(madeiraId: number | undefined) {
  const db = await getDb();
  if (!db) return [];
  const empresaId = (await getEmpresaUnica()).id;
  if (madeiraId) {
    return db.select().from(bitolas).where(and(eq(bitolas.madeiraId, madeiraId), eq(bitolas.empresaId, empresaId))).orderBy(desc(bitolas.createdAt));
  }
  return db.select().from(bitolas).where(eq(bitolas.empresaId, empresaId)).orderBy(desc(bitolas.createdAt));
}

export async function getBitolaById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const empresaId = (await getEmpresaUnica()).id;
  const result = await db.select().from(bitolas).where(and(eq(bitolas.id, id), eq(bitolas.empresaId, empresaId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createBitola(data: InsertBitola) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(bitolas).values(data);
  return result;
}

export async function updateBitola(id: number, data: Partial<InsertBitola>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const empresaId = (await getEmpresaUnica()).id;
  await db.update(bitolas).set(data).where(and(eq(bitolas.id, id), eq(bitolas.empresaId, empresaId)));
  return { success: true };
}

export async function deleteBitola(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const empresaId = (await getEmpresaUnica()).id;
  await db.delete(bitolas).where(and(eq(bitolas.id, id), eq(bitolas.empresaId, empresaId)));
  return { success: true };
}

// ─── Clientes ───
export async function listClientes() {
  const db = await getDb();
  if (!db) return [];
  const empresaId = (await getEmpresaUnica()).id;
  return db.select().from(clientes).where(and(eq(clientes.ativo, true), eq(clientes.empresaId, empresaId))).orderBy(desc(clientes.createdAt));
}

export async function listAllClientes() {
  const db = await getDb();
  if (!db) return [];
  const empresaId = (await getEmpresaUnica()).id;
  return db.select().from(clientes).where(eq(clientes.empresaId, empresaId)).orderBy(desc(clientes.createdAt));
}

export async function getClienteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const empresaId = (await getEmpresaUnica()).id;
  const result = await db.select().from(clientes).where(and(eq(clientes.id, id), eq(clientes.empresaId, empresaId))).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPerfilCliente(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const empresaId = (await getEmpresaUnica()).id;
  const cliente = await getClienteById(id);
  if (!cliente) return undefined;

  const [pedidos, titulos] = await Promise.all([
    db.select({
      id: orcamentos.id, numero: orcamentos.numero, estado: orcamentos.estado, total: orcamentos.total,
      pago: orcamentos.pago, entregue: orcamentos.entregue, dataVencimento: orcamentos.dataVencimento, createdAt: orcamentos.createdAt,
    }).from(orcamentos).where(and(eq(orcamentos.empresaId, empresaId), eq(orcamentos.clienteId, id))).orderBy(desc(orcamentos.createdAt)),
    db.select({
      id: titulosFinanceiros.id, descricao: titulosFinanceiros.descricao, origem: titulosFinanceiros.origem,
      orcamentoId: titulosFinanceiros.orcamentoId, valorOriginal: titulosFinanceiros.valorOriginal,
      desconto: titulosFinanceiros.desconto, juros: titulosFinanceiros.juros, valorBaixado: titulosFinanceiros.valorBaixado,
      dataVencimento: titulosFinanceiros.dataVencimento, estado: titulosFinanceiros.estado,
    }).from(titulosFinanceiros).where(and(
      eq(titulosFinanceiros.empresaId, empresaId), eq(titulosFinanceiros.clienteId, id), eq(titulosFinanceiros.tipo, "receber"),
    )).orderBy(desc(titulosFinanceiros.dataVencimento)),
  ]);
  return montarPerfilCliente(cliente, pedidos, titulos);
}


/** Extrai o ID devolvido pelo mysql2, cuja resposta é [ResultSetHeader, fields]. */
export function getInsertedId(result: MysqlInsertResult): number {
  const id = Number(result[0]?.insertId ?? 0);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error("A criação do registo não devolveu um identificador válido");
  }
  return id;
}

export async function createCliente(data: InsertCliente) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(clientes).values(data);
  return { id: getInsertedId(result as MysqlInsertResult) };
}

export async function updateCliente(id: number, data: Partial<InsertCliente>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const empresaId = (await getEmpresaUnica()).id;
  await db.update(clientes).set(data).where(and(eq(clientes.id, id), eq(clientes.empresaId, empresaId)));
  return { success: true };
}

export async function deleteCliente(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const empresaId = (await getEmpresaUnica()).id;
  await db.update(clientes).set({ ativo: false }).where(and(eq(clientes.id, id), eq(clientes.empresaId, empresaId)));
  return { success: true };
}

// ─── Configuração da Empresa ───
export async function getEmpresaConfiguracao() {
  const db = await getDb();
  if (!db) return undefined;
  const empresaId = (await getEmpresaUnica()).id;
  const result = await db.select().from(empresaConfiguracoes).where(eq(empresaConfiguracoes.empresaId, empresaId)).limit(1);
  return result[0];
}

export async function saveEmpresaLogo(logo: { key: string; url: string; mimeType: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const empresaId = (await getEmpresaUnica()).id;
  await db.insert(empresaConfiguracoes).values({
    id: empresaId,
    empresaId,
    logoKey: logo.key,
    logoUrl: logo.url,
    logoMimeType: logo.mimeType,
  }).onDuplicateKeyUpdate({
    set: {
      logoKey: logo.key,
      logoUrl: logo.url,
      logoMimeType: logo.mimeType,
    },
  });
  return getEmpresaConfiguracao();
}

export async function clearEmpresaLogo() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const empresaId = (await getEmpresaUnica()).id;
  await db.insert(empresaConfiguracoes).values({ id: empresaId, empresaId }).onDuplicateKeyUpdate({
    set: { logoKey: null, logoUrl: null, logoMimeType: null },
  });
  return getEmpresaConfiguracao();
}
