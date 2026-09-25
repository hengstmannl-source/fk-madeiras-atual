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
import { getInsertedId } from "./catalogo";
import { garantirTituloFinanceiroAutomatico } from "./financeiro";
import { obterCentroCustoAtivo } from "./centrosCusto";

type MysqlInsertResult = readonly [{ insertId?: number | bigint }, unknown];
type DatabaseConnection = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type TituloFinanceiro = InferSelectModel<typeof titulosFinanceiros>;
type CategoriaFinanceira = InferSelectModel<typeof categoriasFinanceiras>;
type Fornecedor = InferSelectModel<typeof fornecedores>;
type AtualizacaoCabecalhoCarga = Partial<typeof romaneiosCargaToras.$inferInsert>;
type AtualizacaoCabecalhoSerragem = Partial<typeof serragensTerceiros.$inferInsert>;
type EstadoOrcamento = InferSelectModel<typeof orcamentos>["estado"];
type AtualizacaoCabecalhoProducao = Partial<typeof romaneiosProducao.$inferInsert>;

// ─── Tanque de diesel ───
async function getOrCreateCategoriaPagamentoDiesel(tx: any, userId: number): Promise<number> {
  const existente = await tx.select().from(categoriasFinanceiras)
    .where(and(eq(categoriasFinanceiras.nome, "Pagamento de nota de diesel"), eq(categoriasFinanceiras.ativo, true))).limit(1);
  if (existente[0]) return existente[0].id;
  const resultado = await tx.insert(categoriasFinanceiras).values({
    nome: "Pagamento de nota de diesel",
    tipo: "despesa",
    ativo: true,
    criadoPor: userId,
  });
  return getInsertedId(resultado as MysqlInsertResult);
}

export async function getResumoTanqueDiesel() {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [notasComFornecedor, abastecimentos, titulos] = await Promise.all([
    db.select({ nota: notasDiesel, fornecedorNome: fornecedores.nome }).from(notasDiesel)
      .leftJoin(fornecedores, and(eq(notasDiesel.fornecedorId, fornecedores.id), eq(fornecedores.empresaId, empresaId)))
      .where(eq(notasDiesel.empresaId, empresaId)).orderBy(desc(notasDiesel.dataNota)),
    db.select().from(abastecimentosDiesel).where(eq(abastecimentosDiesel.empresaId, empresaId)).orderBy(desc(abastecimentosDiesel.dataAbastecimento)),
    db.select().from(titulosFinanceiros).where(and(eq(titulosFinanceiros.origem, "nota_diesel"), eq(titulosFinanceiros.empresaId, empresaId))),
  ]);
  const tituloPorNota = new Map<number, any>(titulos.filter((titulo: any) => titulo.notaDieselId).map((titulo: any) => [titulo.notaDieselId, titulo]));
  const resumo = calcularResumoTanqueDiesel(notasComFornecedor.map(({ nota }: any) => nota), abastecimentos);
  return {
    ...resumo,
    notas: notasComFornecedor.map(({ nota, fornecedorNome }: any) => ({
      ...nota,
      fornecedorNome: fornecedorNome ?? "Fornecedor não informado",
      titulo: tituloPorNota.get(nota.id) ?? null,
    })),
    abastecimentos,
  };
}

export async function criarNotaDiesel(data: {
  numeroNota?: string | null;
  fornecedorId: number;
  centroCustoId?: number | null;
  litros: string;
  valorTotal: string;
  dataNota: Date;
  dataVencimento: Date;
  observacoes?: string | null;
  criadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx: any) => {
    if (data.centroCustoId) await obterCentroCustoAtivo(data.centroCustoId, tx, data.empresaId);
    const fornecedor = (await tx.select().from(fornecedores).where(and(eq(fornecedores.id, data.fornecedorId), eq(fornecedores.empresaId, data.empresaId))).limit(1))[0];
    if (!fornecedor) throw new Error("Fornecedor não encontrado para a nota de diesel");
    const litros = Number(data.litros.replace(",", "."));
    const valorTotal = Number(data.valorTotal.replace(",", "."));
    if (!(litros > 0) || !(valorTotal > 0)) throw new Error("Informe litros e valor total válidos para a nota de diesel");
    const notaResultado = await tx.insert(notasDiesel).values({
      empresaId: data.empresaId,
      numeroNota: data.numeroNota?.trim() || null,
      fornecedorId: data.fornecedorId,
      centroCustoId: data.centroCustoId ?? null,
      litros: litros.toFixed(3),
      valorTotal: valorTotal.toFixed(2),
      dataNota: data.dataNota,
      dataVencimento: data.dataVencimento,
      observacoes: data.observacoes?.trim() || null,
      criadoPor: data.criadoPor,
    });
    const notaDieselId = getInsertedId(notaResultado as MysqlInsertResult);
    const categoriaId = await getOrCreateCategoriaPagamentoDiesel(tx, data.criadoPor);
    const { id: tituloFinanceiroId } = await garantirTituloFinanceiroAutomatico({
      tipo: "pagar",
      origem: "nota_diesel",
      chaveIdempotencia: `FIN-NOTA-DIESEL-${notaDieselId}`,
      descricao: `Pagamento de diesel${data.numeroNota?.trim() ? ` — Nota ${data.numeroNota.trim()}` : ""}`,
      fornecedorId: data.fornecedorId,
      contraparteNome: fornecedor.nome,
      notaDieselId,
      categoriaId,
      centroCustoId: data.centroCustoId ?? null,
      valorOriginal: valorTotal.toFixed(2),
      dataEmissao: data.dataNota,
      dataVencimento: data.dataVencimento,
      competencia: data.dataNota,
      observacoes: ["Lembrete financeiro vinculado à nota de diesel.", data.observacoes?.trim()].filter(Boolean).join("\n") || null,
      criadoPor: data.criadoPor,
      database: tx,
    });
    return { id: notaDieselId, tituloFinanceiroId };
  });
}

export async function excluirNotaDiesel(id: number, userId: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx: any) => {
    const nota = (await tx.select().from(notasDiesel)
      .where(and(eq(notasDiesel.id, id), eq(notasDiesel.empresaId, empresaId))).limit(1))[0];
    if (!nota) throw new Error("Nota de diesel não encontrada");

    const [abastecimento] = await tx.select({ id: abastecimentosDiesel.id }).from(abastecimentosDiesel)
      .where(eq(abastecimentosDiesel.empresaId, empresaId)).limit(1);
    const titulo = (await tx.select().from(titulosFinanceiros)
      .where(and(eq(titulosFinanceiros.notaDieselId, id), eq(titulosFinanceiros.empresaId, empresaId))).limit(1))[0];
    const baixasAtivas = titulo ? await tx.select({ id: baixasFinanceiras.id }).from(baixasFinanceiras)
      .where(and(eq(baixasFinanceiras.tituloId, titulo.id), eq(baixasFinanceiras.empresaId, empresaId), eq(baixasFinanceiras.estornada, false))) : [];

    validarExclusaoNotaDiesel({ possuiAbastecimentos: Boolean(abastecimento), possuiBaixasAtivas: baixasAtivas.length > 0 });
    if (titulo && titulo.estado !== "cancelado") {
      await tx.update(titulosFinanceiros).set({ estado: "cancelado", canceladoEm: new Date(), canceladoPor: userId })
        .where(and(eq(titulosFinanceiros.id, titulo.id), eq(titulosFinanceiros.empresaId, empresaId)));
    }
    await tx.delete(notasDiesel).where(and(eq(notasDiesel.id, id), eq(notasDiesel.empresaId, empresaId)));
    return { success: true, id };
  });
}

export async function registrarAbastecimentoDiesel(data: {
  destino: string;
  centroCustoId?: number | null;
  responsavel?: string | null;
  litros: string;
  dataAbastecimento: Date;
  observacoes?: string | null;
  criadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (!data.destino.trim()) throw new Error("Informe o destino do abastecimento");
  return db.transaction(async (tx: any) => {
    if (data.centroCustoId) await obterCentroCustoAtivo(data.centroCustoId, tx, data.empresaId);
    const [notas, abastecimentos] = await Promise.all([
      tx.select().from(notasDiesel).where(eq(notasDiesel.empresaId, data.empresaId)),
      tx.select().from(abastecimentosDiesel).where(eq(abastecimentosDiesel.empresaId, data.empresaId)),
    ]);
    const custo = calcularCustoAbastecimentoDiesel(calcularResumoTanqueDiesel(notas, abastecimentos), data.litros);
    const resultado = await tx.insert(abastecimentosDiesel).values({
      empresaId: data.empresaId,
      destino: data.destino.trim(),
      responsavel: data.responsavel?.trim() || null,
      litros: custo.litros.toFixed(3),
      custoUnitario: custo.custoUnitario.toFixed(4),
      custoTotal: custo.custoTotal.toFixed(2),
      dataAbastecimento: data.dataAbastecimento,
      centroCustoId: data.centroCustoId ?? null,
      observacoes: data.observacoes?.trim() || null,
      criadoPor: data.criadoPor,
    });
    return { id: getInsertedId(resultado as MysqlInsertResult), ...custo };
  });
}
