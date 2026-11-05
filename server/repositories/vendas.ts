import { eq, and, asc, desc, gte, lte, ne, inArray, or, sql, type InferSelectModel, type SQL } from "drizzle-orm";
import {
  InsertUser, users, madeiras, bitolas, clientes,
  orcamentos, itensOrcamento, componentesPacoteOrcamento, taxasAdicionaisOrcamento, produtosComerciais, componentesProdutoComercial, modelosMedidaVenda, historicoAlteracoes, empresaConfiguracoes,
  empresas, credenciaisUsuarios, convitesEmpresa, recuperacoesSenha,
  fornecedores, categoriasFinanceiras, contasFinanceiras, titulosFinanceiros, sequenciasVendas, sequenciasDocumentos,
  baixasFinanceiras, chequesFinanceiros, recorrenciasFinanceiras, configuracoesFinanceiras, alertasFinanceiros, extratosBancarios, movimentosExtratoBancario, anexosFinanceiros,
  revisoesVendas, ciclosEntrega, reservasEstoqueVenda, ajustesFinanceirosVenda,
  plaquetas, conferenciasVariacaoPlaquetas, romaneiosCargaToras, romaneiosProducao, itensRomaneioToras, itensRomaneioProducao, aproveitamentosRomaneioProducao, aproveitamentosOrcamento, serragensTerceiros, itensSerragemToras, itensSerragemPecas, retiradasSerragemTerceiros, itensRetiradaSerragemTerceiros, lotesPecasSerradas, movimentacoesPlaquetas, movimentacoesEstoqueSerrado, notasDiesel, abastecimentosDiesel,
  type InsertMadeira, type InsertBitola, type InsertCliente,
  type InsertOrcamento, type InsertComponentePacoteOrcamento, type InsertProdutoComercial, type InsertComponenteProdutoComercial, type InsertModeloMedidaVenda, type InsertFornecedor,
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
import type { PersistenciaNovaOperacaoComercial } from "../comercial.persistence";
import { planejarAjusteFinanceiroRevisao, planejarReservasVendaInterna, valorMonetarioEmCentavos } from "../vendas-internas.logic";

import { getDb } from "./core";
import { getEmpresaUnica } from "./identidade";
import { getInsertedId } from "./catalogo";
import { criarTituloReceberDeOrcamento, getOrCreateCategoriaReceitaVendas, garantirTituloFinanceiroComChave, getOrCreateContaFinanceiraPadrao, registrarBaixaFinanceira } from "./financeiro";
import { normalizarFreteCarga } from "./estoque";
import { formatarNumeroDocumentoPadronizado, reservarProximoNumeroDocumento } from "./documentos";

type MysqlInsertResult = readonly [{ insertId?: number | bigint }, unknown];
type DatabaseConnection = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type TituloFinanceiro = InferSelectModel<typeof titulosFinanceiros>;
type CategoriaFinanceira = InferSelectModel<typeof categoriasFinanceiras>;
type Fornecedor = InferSelectModel<typeof fornecedores>;
type AtualizacaoCabecalhoCarga = Partial<typeof romaneiosCargaToras.$inferInsert>;
type AtualizacaoCabecalhoSerragem = Partial<typeof serragensTerceiros.$inferInsert>;
type EstadoOrcamento = InferSelectModel<typeof orcamentos>["estado"];
type AtualizacaoCabecalhoProducao = Partial<typeof romaneiosProducao.$inferInsert>;

// ─── Orçamentos ───
export async function listModelosMedidaVenda() {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  return db.select().from(modelosMedidaVenda).where(eq(modelosMedidaVenda.empresaId, empresaId)).orderBy(asc(modelosMedidaVenda.nome));
}

export async function createModeloMedidaVenda(data: InsertModeloMedidaVenda) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const resultado = await db.insert(modelosMedidaVenda).values(data);
  return Number(resultado[0].insertId);
}

export async function deleteModeloMedidaVenda(id: number, userId: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(modelosMedidaVenda).where(and(eq(modelosMedidaVenda.id, id), eq(modelosMedidaVenda.criadoPor, userId), eq(modelosMedidaVenda.empresaId, empresaId)));
}

export type ComponenteComercialInput = {
  descricao: string;
  madeiraNome?: string | null;
  espessura?: string | null;
  largura?: string | null;
  comprimento?: string | null;
  quantidade: number;
};

export async function listProdutosComerciais(incluirInativos = false) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  const condicao = incluirInativos
    ? eq(produtosComerciais.empresaId, empresaId)
    : and(eq(produtosComerciais.empresaId, empresaId), eq(produtosComerciais.ativo, true));
  const produtos = await db.select().from(produtosComerciais).where(condicao).orderBy(asc(produtosComerciais.nome));
  if (!produtos.length) return [];
  const componentes = await db.select().from(componentesProdutoComercial)
    .where(and(eq(componentesProdutoComercial.empresaId, empresaId), inArray(componentesProdutoComercial.produtoComercialId, produtos.map((produto) => produto.id))))
    .orderBy(asc(componentesProdutoComercial.id));
  return produtos.map((produto) => ({
    ...produto,
    componentes: componentes.filter((componente) => componente.produtoComercialId === produto.id),
  }));
}

export async function createProdutoComercial(data: InsertProdutoComercial, componentes: ComponenteComercialInput[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const resultado = await db.insert(produtosComerciais).values(data);
  const produtoId = Number(resultado[0].insertId);
  if (componentes.length) {
    await db.insert(componentesProdutoComercial).values(componentes.map((componente): InsertComponenteProdutoComercial => ({
      empresaId: data.empresaId,
      produtoComercialId: produtoId,
      descricao: componente.descricao,
      madeiraNome: componente.madeiraNome ?? null,
      espessura: componente.espessura ?? null,
      largura: componente.largura ?? null,
      comprimento: componente.comprimento ?? null,
      quantidade: componente.quantidade,
    })));
  }
  return { id: produtoId };
}

export async function updateProdutoComercial(
  id: number,
  data: Partial<InsertProdutoComercial>,
  componentes: ComponenteComercialInput[] | undefined,
) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existente = await db.select({ id: produtosComerciais.id }).from(produtosComerciais)
    .where(and(eq(produtosComerciais.id, id), eq(produtosComerciais.empresaId, empresaId))).limit(1);
  if (!existente[0]) throw new Error("Produto comercial não encontrado");
  if (Object.keys(data).length) await db.update(produtosComerciais).set({ nome: data.nome, tipoComercializacao: data.tipoComercializacao, precoPadrao: data.precoPadrao, observacoes: data.observacoes, ativo: data.ativo }).where(and(eq(produtosComerciais.id, id), eq(produtosComerciais.empresaId, empresaId)));
  if (componentes !== undefined) {
    await db.delete(componentesProdutoComercial).where(and(eq(componentesProdutoComercial.produtoComercialId, id), eq(componentesProdutoComercial.empresaId, empresaId)));
    if (componentes.length) await db.insert(componentesProdutoComercial).values(componentes.map((componente): InsertComponenteProdutoComercial => ({
      empresaId,
      produtoComercialId: id,
      descricao: componente.descricao,
      madeiraNome: componente.madeiraNome ?? null,
      espessura: componente.espessura ?? null,
      largura: componente.largura ?? null,
      comprimento: componente.comprimento ?? null,
      quantidade: componente.quantidade,
    })));
  }
  return { success: true };
}

function normalizarTextoCabecalho(valor: string | null | undefined) {
  return valor === undefined ? undefined : valor?.trim() || null;
}

export async function atualizarCabecalhoCargasEmLote(data: {
  ids: number[]; dataCarga?: Date; dataVencimento?: Date; origem?: string | null; fornecedorId?: number | null;
  responsavel?: string | null; observacoes?: string | null; fretePorMetroCubico?: string | number; empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const cargas = await tx.select().from(romaneiosCargaToras).where(and(eq(romaneiosCargaToras.empresaId, data.empresaId), inArray(romaneiosCargaToras.id, data.ids)));
    if (cargas.length !== data.ids.length) throw new Error("Um ou mais romaneios de carga não foram encontrados");
    let fornecedorNovo: Fornecedor | null = null;
    if (data.fornecedorId) {
      fornecedorNovo = (await tx.select().from(fornecedores).where(and(eq(fornecedores.id, data.fornecedorId), eq(fornecedores.empresaId, data.empresaId))).limit(1))[0];
      if (!fornecedorNovo) throw new Error("Fornecedor não encontrado");
    }
    for (const carga of cargas) {
      const dataCarga = data.dataCarga ?? carga.dataCarga;
      const dataVencimento = data.dataVencimento ?? carga.dataVencimento;
      if (dataVencimento < dataCarga) throw new Error(`O vencimento não pode ser anterior à data da carga ${carga.numero}`);
      const titulo = carga.tituloFinanceiroId ? (await tx.select().from(titulosFinanceiros).where(and(eq(titulosFinanceiros.id, carga.tituloFinanceiroId), eq(titulosFinanceiros.empresaId, data.empresaId))).limit(1))[0] : null;
      const fretePorMetroCubico = data.fretePorMetroCubico === undefined ? decimalParaNumero(carga.fretePorMetroCubico) : normalizarFreteCarga(String(data.fretePorMetroCubico));
      const frete = Number((decimalParaNumero(carga.volumeTotal) * fretePorMetroCubico).toFixed(2));
      const valorTotal = Number((decimalParaNumero(carga.valorProdutos) + frete).toFixed(2));
      const alteraFinanceiro = data.dataCarga !== undefined || data.dataVencimento !== undefined || data.fornecedorId !== undefined || data.fretePorMetroCubico !== undefined;
      if (titulo && alteraFinanceiro && (decimalParaNumero(titulo.valorBaixado) > 0 || titulo.estado === "quitado" || titulo.estado === "cancelado")) throw new Error(`A carga ${carga.numero} possui conta financeira movimentada e não pode ser alterada em lote`);
      const cabecalho: AtualizacaoCabecalhoCarga = {};
      if (data.dataCarga) cabecalho.dataCarga = dataCarga;
      if (data.dataVencimento) cabecalho.dataVencimento = dataVencimento;
      if (data.origem !== undefined) cabecalho.origem = normalizarTextoCabecalho(data.origem);
      if (data.fornecedorId !== undefined) cabecalho.fornecedorId = data.fornecedorId;
      if (data.responsavel !== undefined) cabecalho.responsavel = normalizarTextoCabecalho(data.responsavel);
      if (data.observacoes !== undefined) cabecalho.observacoes = normalizarTextoCabecalho(data.observacoes);
      if (data.fretePorMetroCubico !== undefined) {
        cabecalho.fretePorMetroCubico = fretePorMetroCubico.toFixed(2);
        cabecalho.frete = frete.toFixed(2);
        cabecalho.valorTotal = valorTotal.toFixed(2);
      }
      await tx.update(romaneiosCargaToras).set(cabecalho).where(and(eq(romaneiosCargaToras.id, carga.id), eq(romaneiosCargaToras.empresaId, data.empresaId)));
      if (titulo && alteraFinanceiro) await tx.update(titulosFinanceiros).set({
        fornecedorId: data.fornecedorId === undefined ? titulo.fornecedorId : data.fornecedorId,
        contraparteNome: data.fornecedorId === undefined ? titulo.contraparteNome : fornecedorNovo?.nome ?? carga.origem,
        dataEmissao: dataCarga, competencia: dataCarga, dataVencimento,
        valorOriginal: data.fretePorMetroCubico === undefined ? titulo.valorOriginal : valorTotal.toFixed(2),
        estado: calcularEstadoTitulo({ valorOriginal: data.fretePorMetroCubico === undefined ? titulo.valorOriginal : valorTotal.toFixed(2), dataVencimento }),
      }).where(and(eq(titulosFinanceiros.id, titulo.id), eq(titulosFinanceiros.empresaId, data.empresaId)));
    }
    return { atualizados: cargas.length };
  });
}

export async function atualizarCabecalhoProducaoEmLote(data: {
  ids: number[]; dataProducao?: Date; fita?: string | null; responsavel?: string | null; observacoes?: string | null; empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const romaneios = await db.select({ id: romaneiosProducao.id }).from(romaneiosProducao).where(and(eq(romaneiosProducao.empresaId, data.empresaId), inArray(romaneiosProducao.id, data.ids)));
  if (romaneios.length !== data.ids.length) throw new Error("Um ou mais romaneios de produção não foram encontrados");
  const cabecalho: AtualizacaoCabecalhoProducao = {};
  if (data.dataProducao) cabecalho.dataProducao = data.dataProducao;
  if (data.fita !== undefined) cabecalho.fita = normalizarTextoCabecalho(data.fita);
  if (data.responsavel !== undefined) cabecalho.responsavel = normalizarTextoCabecalho(data.responsavel);
  if (data.observacoes !== undefined) cabecalho.observacoes = normalizarTextoCabecalho(data.observacoes);
  await db.update(romaneiosProducao).set(cabecalho).where(and(eq(romaneiosProducao.empresaId, data.empresaId), inArray(romaneiosProducao.id, data.ids)));
  return { atualizados: romaneios.length };
}

export async function atualizarCabecalhoSerragensEmLote(data: {
  ids: number[]; clienteId?: number; dataProducao?: Date; dataVencimento?: Date; responsavel?: string | null; observacoes?: string | null; empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const servicos = await tx.select().from(serragensTerceiros).where(and(eq(serragensTerceiros.empresaId, data.empresaId), inArray(serragensTerceiros.id, data.ids)));
    if (servicos.length !== data.ids.length) throw new Error("Uma ou mais serragens não foram encontradas");
    const clienteNovo = data.clienteId ? (await tx.select().from(clientes).where(and(eq(clientes.id, data.clienteId), eq(clientes.empresaId, data.empresaId))).limit(1))[0] : null;
    if (data.clienteId && !clienteNovo) throw new Error("Cliente não encontrado");
    for (const servico of servicos) {
      const dataProducao = data.dataProducao ?? servico.dataProducao;
      const dataVencimento = data.dataVencimento ?? servico.dataVencimento;
      if (dataVencimento < dataProducao) throw new Error(`O vencimento não pode ser anterior à data do serviço ${servico.numero}`);
      const titulo = (await tx.select().from(titulosFinanceiros).where(and(eq(titulosFinanceiros.serragemTerceirosId, servico.id), eq(titulosFinanceiros.empresaId, data.empresaId))).limit(1))[0];
      const alteraFinanceiro = data.clienteId !== undefined || data.dataProducao !== undefined || data.dataVencimento !== undefined;
      if (titulo && alteraFinanceiro && (decimalParaNumero(titulo.valorBaixado) > 0 || titulo.estado === "quitado" || titulo.estado === "cancelado")) throw new Error(`O serviço ${servico.numero} possui cobrança movimentada e não pode ser alterado em lote`);
      if (data.clienteId && data.clienteId !== servico.clienteId) {
        const lotes = await tx.select().from(lotesPecasSerradas).where(and(eq(lotesPecasSerradas.serragemTerceirosId, servico.id), eq(lotesPecasSerradas.empresaId, data.empresaId)));
        for (const lote of lotes) {
          const movimentoPosterior = await tx.select({ id: movimentacoesEstoqueSerrado.id }).from(movimentacoesEstoqueSerrado).where(and(and(eq(movimentacoesEstoqueSerrado.loteId, lote.id), ne(movimentacoesEstoqueSerrado.tipo, "entrada_producao")), eq(movimentacoesEstoqueSerrado.empresaId, data.empresaId))).limit(1);
          if (movimentoPosterior[0] || lote.quantidadeDisponivel !== lote.quantidadeProduzida) throw new Error(`O serviço ${servico.numero} possui peças movimentadas e não pode alterar o cliente em lote`);
        }
        await tx.update(lotesPecasSerradas).set({ clienteProprietarioId: data.clienteId }).where(and(eq(lotesPecasSerradas.serragemTerceirosId, servico.id), eq(lotesPecasSerradas.empresaId, data.empresaId)));
      }
      const cabecalho: AtualizacaoCabecalhoSerragem = {};
      if (data.clienteId) cabecalho.clienteId = data.clienteId;
      if (data.dataProducao) cabecalho.dataProducao = dataProducao;
      if (data.dataVencimento) cabecalho.dataVencimento = dataVencimento;
      if (data.responsavel !== undefined) cabecalho.responsavel = normalizarTextoCabecalho(data.responsavel);
      if (data.observacoes !== undefined) cabecalho.observacoes = normalizarTextoCabecalho(data.observacoes);
      await tx.update(serragensTerceiros).set(cabecalho).where(and(eq(serragensTerceiros.id, servico.id), eq(serragensTerceiros.empresaId, data.empresaId)));
      if (titulo && alteraFinanceiro) await tx.update(titulosFinanceiros).set({
        clienteId: data.clienteId ?? titulo.clienteId, contraparteNome: data.clienteId ? clienteNovo!.nome : titulo.contraparteNome,
        dataEmissao: dataProducao, competencia: dataProducao, dataVencimento,
        estado: calcularEstadoTitulo({ valorOriginal: titulo.valorOriginal, dataVencimento }),
      }).where(and(eq(titulosFinanceiros.id, titulo.id), eq(titulosFinanceiros.empresaId, data.empresaId)));
    }
    return { atualizados: servicos.length };
  });
}

export type CategoriaOperacionalVenda = "aprovadas" | "pagas" | "entregues" | "concluidas";

export function classificarCategoriaOperacionalVenda(pago: boolean, entregue: boolean): CategoriaOperacionalVenda {
  if (pago && entregue) return "concluidas";
  if (pago) return "pagas";
  if (entregue) return "entregues";
  return "aprovadas";
}

export async function listOrcamentos(filters: { estado?: EstadoOrcamento; clienteId?: number; categoria?: CategoriaOperacionalVenda } | undefined) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  conditions.push(eq(orcamentos.empresaId, empresaId));
  if (filters?.estado) conditions.push(eq(orcamentos.estado, filters.estado));
  if (filters?.clienteId) conditions.push(eq(orcamentos.clienteId, filters.clienteId));
  if (filters?.categoria === "aprovadas") conditions.push(eq(orcamentos.pago, false), eq(orcamentos.entregue, false));
  if (filters?.categoria === "pagas") conditions.push(eq(orcamentos.pago, true), eq(orcamentos.entregue, false));
  if (filters?.categoria === "entregues") conditions.push(eq(orcamentos.pago, false), eq(orcamentos.entregue, true));
  if (filters?.categoria === "concluidas") conditions.push(eq(orcamentos.pago, true), eq(orcamentos.entregue, true));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const vendas = await db.select().from(orcamentos).where(where).orderBy(desc(orcamentos.createdAt));
  if (!vendas.length) return [];
  const titulos = await db.select({
    orcamentoId: titulosFinanceiros.orcamentoId,
    estado: titulosFinanceiros.estado,
    totalParcelas: titulosFinanceiros.totalParcelas,
  }).from(titulosFinanceiros).where(and(
    eq(titulosFinanceiros.empresaId, empresaId),
    eq(titulosFinanceiros.origem, "orcamento"),
    inArray(titulosFinanceiros.orcamentoId, vendas.map((venda) => venda.id)),
    ne(titulosFinanceiros.estado, "cancelado"),
  ));
  const titulosPorVenda = new Map<number, typeof titulos>();
  for (const titulo of titulos) {
    if (!titulo.orcamentoId) continue;
    titulosPorVenda.set(titulo.orcamentoId, [...(titulosPorVenda.get(titulo.orcamentoId) ?? []), titulo]);
  }
  return vendas.map((venda) => {
    const titulosDaVenda = titulosPorVenda.get(venda.id) ?? [];
    return {
      ...venda,
      totalParcelasFinanceiras: Math.max(...titulosDaVenda.map((titulo) => titulo.totalParcelas ?? 1), 1),
      parcelasQuitadasFinanceiras: titulosDaVenda.filter((titulo) => titulo.estado === "quitado").length,
    };
  });
}

export async function getCondicaoPagamentoVenda(orcamentoId: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return undefined;
  const venda = await getOrcamentoById(orcamentoId);
  if (!venda) return undefined;
  const parcelas = await db.select({
    id: titulosFinanceiros.id,
    dataVencimento: titulosFinanceiros.dataVencimento,
    valorOriginal: titulosFinanceiros.valorOriginal,
    valorBaixado: titulosFinanceiros.valorBaixado,
    estado: titulosFinanceiros.estado,
    grupoParcelamento: titulosFinanceiros.grupoParcelamento,
    numeroParcela: titulosFinanceiros.numeroParcela,
    totalParcelas: titulosFinanceiros.totalParcelas,
  }).from(titulosFinanceiros).where(and(
    eq(titulosFinanceiros.empresaId, empresaId),
    eq(titulosFinanceiros.origem, "orcamento"),
    eq(titulosFinanceiros.orcamentoId, orcamentoId),
    ne(titulosFinanceiros.estado, "cancelado"),
  )).orderBy(asc(titulosFinanceiros.numeroParcela), asc(titulosFinanceiros.dataVencimento));
  return {
    venda: { id: venda.id, numero: venda.numero, total: venda.total, dataVencimento: venda.dataVencimento, pago: venda.pago },
    parcelas,
    possuiParcelamento: parcelas.length > 1,
  };
}

export async function getResumoFilasVendas(): Promise<Record<CategoriaOperacionalVenda, number>> {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  const resumo: Record<CategoriaOperacionalVenda, number> = { aprovadas: 0, pagas: 0, entregues: 0, concluidas: 0 };
  if (!db) return resumo;
  const vendas = await db.select({ pago: orcamentos.pago, entregue: orcamentos.entregue })
    .from(orcamentos)
    .where(and(eq(orcamentos.empresaId, empresaId), eq(orcamentos.estado, "aprovado")));
  for (const venda of vendas) resumo[classificarCategoriaOperacionalVenda(venda.pago, venda.entregue)] += 1;
  return resumo;
}

/** Retorna vendas aprovadas com todos os abatimentos comerciais já consolidados. */
export async function getRelatorioMargemVendas() {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];

  const vendas = await db.select().from(orcamentos)
    .where(and(eq(orcamentos.empresaId, empresaId), eq(orcamentos.estado, "aprovado")))
    .orderBy(desc(orcamentos.createdAt));
  if (!vendas.length) return [];

  const [clientesEmpresa, taxasPersistidas] = await Promise.all([
    db.select({ id: clientes.id, nome: clientes.nome }).from(clientes).where(eq(clientes.empresaId, empresaId)),
    db.select().from(taxasAdicionaisOrcamento)
      .where(and(eq(taxasAdicionaisOrcamento.empresaId, empresaId), inArray(taxasAdicionaisOrcamento.orcamentoId, vendas.map((venda) => venda.id))))
      .orderBy(asc(taxasAdicionaisOrcamento.ordem), asc(taxasAdicionaisOrcamento.id)),
  ]);
  const clientesPorId = new Map(clientesEmpresa.map((cliente) => [cliente.id, cliente.nome]));
  const taxasPorVenda = new Map<number, typeof taxasPersistidas>();
  for (const taxa of taxasPersistidas) taxasPorVenda.set(taxa.orcamentoId, [...(taxasPorVenda.get(taxa.orcamentoId) ?? []), taxa]);

  return vendas.map((venda) => {
    const taxasNovas = taxasPorVenda.get(venda.id) ?? [];
    const taxas = taxasNovas.length > 0 ? taxasNovas : (venda.taxaDescricao ? [{
      descricao: venda.taxaDescricao,
      tipo: venda.taxaTipo,
      valor: venda.taxaValor,
      calculado: venda.taxaCalculada,
    }] : []);
    return {
      id: venda.id,
      numero: venda.numero,
      clienteNome: clientesPorId.get(venda.clienteId) ?? null,
      vendedor: venda.vendedor,
      createdAt: venda.createdAt,
      taxas: taxas.map((taxa) => ({ descricao: taxa.descricao, tipo: taxa.tipo, valor: taxa.valor, calculado: taxa.calculado })),
      ...calcularIndicadoresMargemVenda({
        subtotal: venda.subtotal,
        desconto: venda.desconto,
        abatimentoFrete: venda.abatimentoFrete,
        comissaoCalculada: venda.comissaoCalculada,
        taxas,
        total: venda.total,
      }),
    };
  });
}

export async function getOrcamentoWithItems(id: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return undefined;
  const orc = await db.select().from(orcamentos).where(and(eq(orcamentos.id, id), eq(orcamentos.empresaId, empresaId))).limit(1);
  if (orc.length === 0) return undefined;
  const itens = await db.select().from(itensOrcamento).where(and(eq(itensOrcamento.orcamentoId, id), eq(itensOrcamento.empresaId, empresaId)));
  const componentes = itens.length
    ? await db.select().from(componentesPacoteOrcamento).where(and(eq(componentesPacoteOrcamento.empresaId, empresaId), inArray(componentesPacoteOrcamento.itemOrcamentoId, itens.map((item) => item.id))))
    : [];
  const aproveitamentos = await db.select().from(aproveitamentosOrcamento).where(and(eq(aproveitamentosOrcamento.orcamentoId, id), eq(aproveitamentosOrcamento.empresaId, empresaId)));
  const taxasAdicionais = await db.select().from(taxasAdicionaisOrcamento)
    .where(and(eq(taxasAdicionaisOrcamento.orcamentoId, id), eq(taxasAdicionaisOrcamento.empresaId, empresaId)))
    .orderBy(taxasAdicionaisOrcamento.ordem, taxasAdicionaisOrcamento.id);
  return {
    orcamento: orc[0],
    itens: itens.map((item) => ({ ...item, componentesPacote: componentes.filter((componente) => componente.itemOrcamentoId === item.id) })),
    aproveitamentos,
    taxasAdicionais,
  };
}

export function podeAlterarOrcamentoPago(pago: boolean, confirmacaoDupla: boolean) {
  return !pago || confirmacaoDupla;
}

export async function getOrcamentoById(id: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(orcamentos).where(and(eq(orcamentos.id, id), eq(orcamentos.empresaId, empresaId))).limit(1);
  return result[0];
}

async function validarAlteracaoOrcamento(id: number, confirmacaoDupla = false, database?: any) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const resultado = await db.select().from(orcamentos).where(and(eq(orcamentos.id, id), eq(orcamentos.empresaId, empresaId))).limit(1);
  const orcamento = resultado[0];
  if (!orcamento) throw new Error("Orçamento não encontrado");
  if (!podeAlterarOrcamentoPago(orcamento.pago, confirmacaoDupla)) {
    throw new Error("Orçamento pago está bloqueado. Confirme duas vezes para prosseguir.");
  }
  return orcamento;
}

/** Persiste uma nova operação preparada pelo motor comercial, sem recalcular valores. */
export async function createOrcamentoComercialCalculado(
  preparada: PersistenciaNovaOperacaoComercial,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async (tx) => {
    const cabecalho = preparada.cabecalho;
    const empresaId = cabecalho.empresaId;

    const cliente = await tx.select({ id: clientes.id }).from(clientes).where(and(
      eq(clientes.id, cabecalho.clienteId),
      eq(clientes.empresaId, empresaId),
    )).limit(1);
    if (!cliente[0]) throw new Error("Cliente inválido para a empresa ativa");

    const madeiraIds = Array.from(new Set(preparada.itens.flatMap((item) => item.madeiraId == null ? [] : [item.madeiraId])));
    const bitolaIds = Array.from(new Set(preparada.itens.flatMap((item) => item.bitolaId == null ? [] : [item.bitolaId])));
    const produtoIds = Array.from(new Set(preparada.itens.flatMap((item) => item.produtoComercialId == null ? [] : [item.produtoComercialId])));

    const [madeirasEncontradas, bitolasEncontradas, produtosEncontrados] = await Promise.all([
      madeiraIds.length ? tx.select({ id: madeiras.id }).from(madeiras).where(and(eq(madeiras.empresaId, empresaId), inArray(madeiras.id, madeiraIds))) : [],
      bitolaIds.length ? tx.select({ id: bitolas.id, madeiraId: bitolas.madeiraId }).from(bitolas).where(and(eq(bitolas.empresaId, empresaId), inArray(bitolas.id, bitolaIds))) : [],
      produtoIds.length ? tx.select({ id: produtosComerciais.id, tipoComercializacao: produtosComerciais.tipoComercializacao }).from(produtosComerciais).where(and(eq(produtosComerciais.empresaId, empresaId), inArray(produtosComerciais.id, produtoIds))) : [],
    ]);
    if (madeirasEncontradas.length !== madeiraIds.length) throw new Error("Referência de madeira inválida para a empresa ativa");
    if (bitolasEncontradas.length !== bitolaIds.length) throw new Error("Referência de bitola inválida para a empresa ativa");
    if (produtosEncontrados.length !== produtoIds.length) throw new Error("Referência de produto comercial inválida para a empresa ativa");

    const bitolasPorId = new Map(bitolasEncontradas.map((bitola) => [bitola.id, bitola]));
    for (const item of preparada.itens) {
      if (item.bitolaId != null) {
        const bitola = bitolasPorId.get(item.bitolaId)!;
        if (item.madeiraId != null && bitola.madeiraId !== item.madeiraId) {
          throw new Error("A bitola não corresponde à madeira informada");
        }
      }
      if (item.produtoComercialId != null) {
        const produto = produtosEncontrados.find(({ id }) => id === item.produtoComercialId);
        if (produto?.tipoComercializacao !== item.tipoComercializacao) {
          throw new Error("O produto comercial não corresponde ao tipo de comercialização informado");
        }
      }
    }

    const inserted = await tx.insert(orcamentos).values(cabecalho);
    const orcamentoId = Number(inserted[0].insertId);
    if (!Number.isSafeInteger(orcamentoId) || orcamentoId <= 0) throw new Error("Não foi possível identificar o novo orçamento");

    for (const item of preparada.itens) {
      const { componentesPacote, ...dadosItem } = item;
      const insertedItem = await tx.insert(itensOrcamento).values({
        ...dadosItem,
        empresaId,
        orcamentoId,
      });
      const itemOrcamentoId = Number(insertedItem[0].insertId);
      if (!Number.isSafeInteger(itemOrcamentoId) || itemOrcamentoId <= 0) throw new Error("Não foi possível identificar o item do orçamento");
      if (componentesPacote.length) {
        await tx.insert(componentesPacoteOrcamento).values(componentesPacote.map((componente) => ({
          ...componente,
          empresaId,
          itemOrcamentoId,
        } satisfies InsertComponentePacoteOrcamento)));
      }
    }

    if (preparada.aproveitamentos.length) {
      await tx.insert(aproveitamentosOrcamento).values(preparada.aproveitamentos.map((item) => ({
        ...item,
        empresaId,
        orcamentoId,
      })));
    }
    if (preparada.taxasAdicionais.length) {
      await tx.insert(taxasAdicionaisOrcamento).values(preparada.taxasAdicionais.map((taxa) => ({
        ...taxa,
        empresaId,
        orcamentoId,
      })));
    }
    if (cabecalho.criadoPor) {
      await tx.insert(historicoAlteracoes).values({
        empresaId,
        orcamentoId,
        usuarioId: cabecalho.criadoPor,
        tipo: "criacao" as any,
        detalhes: JSON.stringify({ numero: cabecalho.numero, estado: cabecalho.estado }),
      });
    }
    return { id: orcamentoId };
  });
}

function criarSnapshotVenda(comercial: any, itens: any[], componentes: any[], taxas: any[], aproveitamentos: any[]) {
  const componentesPorItem = new Map<number, any[]>();
  for (const componente of componentes) componentesPorItem.set(componente.itemOrcamentoId, [...(componentesPorItem.get(componente.itemOrcamentoId) ?? []), componente]);
  return {
    cabecalho: {
      tipoVenda: comercial.tipoVenda, clienteId: comercial.clienteId, desconto: comercial.desconto,
      frete: comercial.frete, fretePorTonelada: comercial.fretePorTonelada, pesoCargaToneladas: comercial.pesoCargaToneladas,
      abatimentoFrete: comercial.abatimentoFrete, baseAposFrete: comercial.baseAposFrete,
      comissaoTipo: comercial.comissaoTipo, comissaoValor: comercial.comissaoValor, taxaDescricao: comercial.taxaDescricao,
      taxaTipo: comercial.taxaTipo, taxaValor: comercial.taxaValor, taxaCalculada: comercial.taxaCalculada,
      subtotal: comercial.subtotal, total: comercial.total, totalPecas: comercial.totalPecas,
      totalMetroLinear: comercial.totalMetroLinear, totalVolume: comercial.totalVolume,
    },
    itens: itens.map((item) => ({ dados: item, componentesPacote: item.componentesPacote ?? componentesPorItem.get(item.id) ?? [] })),
    taxasAdicionais: taxas,
    aproveitamentos,
  };
}

/** Atualiza somente o snapshot comercial de venda interna aprovada, mantendo títulos e baixas auditáveis. */
export async function revisarVendaInterna(orcamentoId: number, userId: number, motivo: string, preparada: PersistenciaNovaOperacaoComercial, versaoComercialEsperada: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (motivo.trim().length < 3) throw new Error("Informe o motivo da revisão comercial");
  return db.transaction(async (tx: any) => {
    const venda = (await tx.select().from(orcamentos).where(and(eq(orcamentos.id, orcamentoId), eq(orcamentos.empresaId, empresaId))).for("update").limit(1))[0];
    if (!venda || venda.tipoVenda !== "interna") throw new Error("Venda interna não encontrada");
    if ((venda.versaoComercial ?? 1) !== versaoComercialEsperada) throw new Error("A venda foi alterada por outra operação. Atualize os dados antes de revisar");
    if (venda.estado !== "aprovado") throw new Error("Somente venda interna aprovada pode ser revisada");
    if (venda.entregue) throw new Error("Não é possível revisar uma venda após a retirada; estorne primeiro");
    if (venda.clienteId !== preparada.cabecalho.clienteId) throw new Error("O cliente não pode ser alterado após a aprovação da venda");
    const madeiraIds = Array.from(new Set(preparada.itens.flatMap((item) => item.madeiraId == null ? [] : [item.madeiraId])));
    const bitolaIds = Array.from(new Set(preparada.itens.flatMap((item) => item.bitolaId == null ? [] : [item.bitolaId])));
    const produtoIds = Array.from(new Set(preparada.itens.flatMap((item) => item.produtoComercialId == null ? [] : [item.produtoComercialId])));
    const [madeirasEncontradas, bitolasEncontradas, produtosEncontrados] = await Promise.all([
      madeiraIds.length ? tx.select({ id: madeiras.id }).from(madeiras).where(and(eq(madeiras.empresaId, empresaId), inArray(madeiras.id, madeiraIds))) : [],
      bitolaIds.length ? tx.select({ id: bitolas.id, madeiraId: bitolas.madeiraId }).from(bitolas).where(and(eq(bitolas.empresaId, empresaId), inArray(bitolas.id, bitolaIds))) : [],
      produtoIds.length ? tx.select({ id: produtosComerciais.id, tipoComercializacao: produtosComerciais.tipoComercializacao }).from(produtosComerciais).where(and(eq(produtosComerciais.empresaId, empresaId), inArray(produtosComerciais.id, produtoIds))) : [],
    ]);
    if (madeirasEncontradas.length !== madeiraIds.length || bitolasEncontradas.length !== bitolaIds.length || produtosEncontrados.length !== produtoIds.length) {
      throw new Error("A revisão contém referências comerciais inválidas para a empresa ativa");
    }
    const bitolasPorId = new Map(bitolasEncontradas.map((bitola: any) => [bitola.id, bitola]));
    for (const item of preparada.itens) {
      if (item.bitolaId != null) {
        const bitola = bitolasPorId.get(item.bitolaId) as { madeiraId: number } | undefined;
        if (!bitola || (item.madeiraId != null && bitola.madeiraId !== item.madeiraId)) throw new Error("A bitola não corresponde à madeira informada");
      }
      if (item.produtoComercialId != null) {
        const produto = produtosEncontrados.find((row: any) => row.id === item.produtoComercialId);
        if (produto?.tipoComercializacao !== item.tipoComercializacao) throw new Error("O produto comercial não corresponde ao tipo de comercialização informado");
      }
    }

    const ciclos = await tx.select({ id: ciclosEntrega.id }).from(ciclosEntrega).where(and(eq(ciclosEntrega.empresaId, empresaId), eq(ciclosEntrega.orcamentoId, orcamentoId))).limit(1);
    if (ciclos.length) throw new Error("Venda com histórico de retirada não pode ser revisada; preserve o ciclo operacional");

    const titulos = await tx.select().from(titulosFinanceiros).where(and(eq(titulosFinanceiros.empresaId, empresaId), eq(titulosFinanceiros.orcamentoId, orcamentoId), eq(titulosFinanceiros.origem, "orcamento"))).for("update");
    const tituloIds = titulos.map((titulo: any) => titulo.id);
    const baixas = tituloIds.length ? await tx.select().from(baixasFinanceiras).where(and(eq(baixasFinanceiras.empresaId, empresaId), inArray(baixasFinanceiras.tituloId, tituloIds))) : [];
    const valoresPagos = new Map<number, bigint>();
    for (const baixa of baixas) if (!baixa.estornada) {
      const valor = valorMonetarioEmCentavos(baixa.valor, "Valor de baixa financeira");
      valoresPagos.set(baixa.tituloId, (valoresPagos.get(baixa.tituloId) ?? BigInt(0)) + valor);
    }
    if (titulos.some((titulo: any) => Number(titulo.desconto ?? 0) !== 0 || Number(titulo.juros ?? 0) !== 0)) {
      throw new Error("A venda possui descontos ou juros financeiros individualizados; regularize esses títulos antes da revisão");
    }
    if (titulos.some((titulo: any) => titulo.estado === "cancelado" && (valoresPagos.get(titulo.id) ?? BigInt(0)) > BigInt(0))) {
      throw new Error("Existe título cancelado com recebimento não estornado; regularize o histórico financeiro antes da revisão");
    }
    const titulosAtivos = titulos.filter((titulo: any) => titulo.estado !== "cancelado");
    const totalComercialNovo = preparada.cabecalho.total;
    if (typeof totalComercialNovo !== "string") throw new Error("O cálculo preparado não contém o total comercial da revisão");
    const planoFinanceiro = planejarAjusteFinanceiroRevisao({
      totalNovo: totalComercialNovo,
      titulos: titulosAtivos.map((titulo: any, index: number) => {
        const centavosPagos = valoresPagos.get(titulo.id) ?? BigInt(0);
        const parteInteira = centavosPagos / BigInt(100);
        const parteDecimal = String(centavosPagos % BigInt(100)).padStart(2, "0");
        return { id: titulo.id, valorDevido: titulo.valorOriginal, valorPago: `${parteInteira}.${parteDecimal}`, ordem: titulo.numeroParcela ?? index + 1 };
      }),
    });

    const [itensAntigos, taxasAntigas, aproveitamentosAntigos] = await Promise.all([
      tx.select().from(itensOrcamento).where(and(eq(itensOrcamento.empresaId, empresaId), eq(itensOrcamento.orcamentoId, orcamentoId))),
      tx.select().from(taxasAdicionaisOrcamento).where(and(eq(taxasAdicionaisOrcamento.empresaId, empresaId), eq(taxasAdicionaisOrcamento.orcamentoId, orcamentoId))),
      tx.select().from(aproveitamentosOrcamento).where(and(eq(aproveitamentosOrcamento.empresaId, empresaId), eq(aproveitamentosOrcamento.orcamentoId, orcamentoId))),
    ]);
    const idsItensAntigos = itensAntigos.map((item: any) => item.id);
    const componentesAntigos = idsItensAntigos.length ? await tx.select().from(componentesPacoteOrcamento).where(and(eq(componentesPacoteOrcamento.empresaId, empresaId), inArray(componentesPacoteOrcamento.itemOrcamentoId, idsItensAntigos))) : [];
    const snapshotAnterior = criarSnapshotVenda(venda, itensAntigos, componentesAntigos, taxasAntigas, aproveitamentosAntigos);
    const versaoAnterior = venda.versaoComercial ?? 1;
    const versaoNova = versaoAnterior + 1;
    const revisaoResult = await tx.insert(revisoesVendas).values({
      empresaId, orcamentoId, versaoAnterior, versaoNova, usuarioId: userId, motivo: motivo.trim(),
      totalAnterior: venda.total, totalNovo: preparada.cabecalho.total,
      snapshotAnterior, snapshotNovo: criarSnapshotVenda(preparada.cabecalho, preparada.itens, preparada.itens.flatMap((item: any) => item.componentesPacote), preparada.taxasAdicionais, preparada.aproveitamentos),
    });
    const revisaoId = Number(revisaoResult[0].insertId);
    const agora = new Date();
    for (const ajuste of planoFinanceiro.novosValores) {
      const titulo = titulosAtivos.find((item: any) => item.id === ajuste.tituloId);
      if (!titulo) throw new Error("Título financeiro da revisão não encontrado");
      const novoEstado = calcularEstadoTitulo({ valorOriginal: ajuste.novoValorDevido, dataVencimento: titulo.dataVencimento, valorBaixado: Number(valoresPagos.get(titulo.id) ?? BigInt(0)) / 100, cancelado: false });
      await tx.update(titulosFinanceiros).set({ valorOriginal: ajuste.novoValorDevido, estado: novoEstado })
        .where(and(eq(titulosFinanceiros.id, titulo.id), eq(titulosFinanceiros.empresaId, empresaId)));
      await tx.insert(ajustesFinanceirosVenda).values({ empresaId, orcamentoId, revisaoVendaId: revisaoId, tituloFinanceiroId: titulo.id, valorAjuste: ajuste.valorAjuste, criadoPor: userId });
    }
    if (valorMonetarioEmCentavos(planoFinanceiro.delta, "Ajuste da revisão") > BigInt(0)) {
      const categoriaId = await getOrCreateCategoriaReceitaVendas(userId, tx);
      const recebido = await garantirTituloFinanceiroComChave({
        database: tx, tipo: "receber", origem: "orcamento", chaveIdempotencia: `FIN-REVISAO-${revisaoId}`,
        descricao: `Ajuste da revisão ${versaoNova} da venda ${venda.numero ?? venda.id}`, clienteId: venda.clienteId,
        orcamentoId, categoriaId, centroCustoId: venda.centroCustoId ?? null, valorOriginal: planoFinanceiro.delta,
        dataEmissao: agora, dataVencimento: venda.dataVencimento ?? agora, competencia: venda.competencia, criadoPor: userId,
      });
      await tx.insert(ajustesFinanceirosVenda).values({ empresaId, orcamentoId, revisaoVendaId: revisaoId, tituloFinanceiroId: recebido.id, valorAjuste: planoFinanceiro.delta, criadoPor: userId });
    }

    await tx.update(reservasEstoqueVenda).set({ estado: "liberada", encerradaEm: agora, encerradaPor: userId }).where(and(
      eq(reservasEstoqueVenda.empresaId, empresaId), eq(reservasEstoqueVenda.orcamentoId, orcamentoId), eq(reservasEstoqueVenda.estado, "reservada"),
    ));
    if (idsItensAntigos.length) {
      await tx.delete(componentesPacoteOrcamento).where(and(eq(componentesPacoteOrcamento.empresaId, empresaId), inArray(componentesPacoteOrcamento.itemOrcamentoId, idsItensAntigos)));
      await tx.delete(itensOrcamento).where(and(eq(itensOrcamento.empresaId, empresaId), eq(itensOrcamento.orcamentoId, orcamentoId)));
    }
    await tx.delete(taxasAdicionaisOrcamento).where(and(eq(taxasAdicionaisOrcamento.empresaId, empresaId), eq(taxasAdicionaisOrcamento.orcamentoId, orcamentoId)));
    await tx.delete(aproveitamentosOrcamento).where(and(eq(aproveitamentosOrcamento.empresaId, empresaId), eq(aproveitamentosOrcamento.orcamentoId, orcamentoId)));
    for (const item of preparada.itens) {
      const { componentesPacote, ...dadosItem } = item;
      const inserted = await tx.insert(itensOrcamento).values({ ...dadosItem, empresaId, orcamentoId });
      const itemId = Number(inserted[0].insertId);
      if (componentesPacote.length) await tx.insert(componentesPacoteOrcamento).values(componentesPacote.map((componente: any) => ({ ...componente, empresaId, itemOrcamentoId: itemId })));
    }
    if (preparada.aproveitamentos.length) await tx.insert(aproveitamentosOrcamento).values(preparada.aproveitamentos.map((item: any) => ({ ...item, empresaId, orcamentoId })));
    if (preparada.taxasAdicionais.length) await tx.insert(taxasAdicionaisOrcamento).values(preparada.taxasAdicionais.map((taxa: any) => ({ ...taxa, empresaId, orcamentoId })));
    const c = preparada.cabecalho;
    await tx.update(orcamentos).set({
      desconto: c.desconto, frete: c.frete, fretePorTonelada: c.fretePorTonelada, pesoCargaToneladas: c.pesoCargaToneladas,
      abatimentoFrete: c.abatimentoFrete, baseAposFrete: c.baseAposFrete, comissaoTipo: c.comissaoTipo, comissaoValor: c.comissaoValor,
      comissaoCalculada: c.comissaoCalculada, taxaDescricao: c.taxaDescricao, taxaTipo: c.taxaTipo, taxaValor: c.taxaValor,
      taxaCalculada: c.taxaCalculada, subtotal: c.subtotal, total: c.total, totalPecas: c.totalPecas,
      totalMetroLinear: c.totalMetroLinear, totalVolume: c.totalVolume, versaoComercial: versaoNova,
      versaoCalculoComercial: 1, pago: valorMonetarioEmCentavos(planoFinanceiro.saldoPago, "Total pago") >= valorMonetarioEmCentavos(totalComercialNovo, "Total revisado"),
    }).where(and(eq(orcamentos.id, orcamentoId), eq(orcamentos.empresaId, empresaId)));
    const vendaAtualizada = { ...venda, versaoComercial: versaoNova };
    await criarReservasVendaInterna(tx, vendaAtualizada, userId, versaoNova);
    await tx.insert(historicoAlteracoes).values({ empresaId, orcamentoId, usuarioId: userId, tipo: "alteracao" as any, detalhes: JSON.stringify({ acao: "revisao_venda_interna", revisaoId, versaoAnterior, versaoNova, motivo: motivo.trim(), totalAnterior: venda.total, totalNovo: c.total }) });
    return { success: true, revisaoId, versaoComercial: versaoNova, deltaFinanceiro: planoFinanceiro.delta };
  });
}

export async function updateOrcamento(id: number, data: Partial<InsertOrcamento>, confirmacaoDupla = false) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await validarAlteracaoOrcamento(id, confirmacaoDupla);
  await db.update(orcamentos).set(data).where(and(eq(orcamentos.id, id), eq(orcamentos.empresaId, empresaId)));
  return { success: true };
}

export async function cancelarRecebivelDeVendaExcluida(orcamentoId: number, userId: number, database?: any) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const titulos = await db.select().from(titulosFinanceiros)
    .where(and(and(eq(titulosFinanceiros.origem, "orcamento"), eq(titulosFinanceiros.orcamentoId, orcamentoId)), eq(titulosFinanceiros.empresaId, empresaId)));
  if (!titulos.length) return { cancelado: false, tituloIds: [] };
  if (titulos.some((titulo: { valorBaixado: string }) => decimalParaNumero(titulo.valorBaixado) > 0)) {
    throw new Error("A venda possui recebimentos registrados e não pode ser excluída. Regularize as baixas primeiro.");
  }
  const resolvidoEm = new Date();
  const titulosAtivos = titulos.filter((titulo: { estado: string }) => titulo.estado !== "cancelado");
  if (!titulosAtivos.length) return { cancelado: false, tituloIds: [] };
  const tituloIds = titulosAtivos.map((titulo: { id: number }) => titulo.id);
  await db.update(titulosFinanceiros).set({ estado: "cancelado", canceladoEm: resolvidoEm, canceladoPor: userId })
    .where(and(inArray(titulosFinanceiros.id, tituloIds), eq(titulosFinanceiros.empresaId, empresaId)));
  await db.update(alertasFinanceiros).set({ resolvidoEm }).where(and(inArray(alertasFinanceiros.tituloId, tituloIds), eq(alertasFinanceiros.empresaId, empresaId)));
  return { cancelado: true, tituloIds, tituloId: tituloIds[0] };
}

export async function deleteOrcamento(id: number, confirmacaoDupla = false, userId?: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await validarAlteracaoOrcamento(id, confirmacaoDupla);
  if (userId) await cancelarRecebivelDeVendaExcluida(id, userId, db);
  await db.delete(taxasAdicionaisOrcamento).where(and(eq(taxasAdicionaisOrcamento.orcamentoId, id), eq(taxasAdicionaisOrcamento.empresaId, empresaId)));
  await db.delete(itensOrcamento).where(and(eq(itensOrcamento.orcamentoId, id), eq(itensOrcamento.empresaId, empresaId)));
  await db.delete(orcamentos).where(and(eq(orcamentos.id, id), eq(orcamentos.empresaId, empresaId)));
  return { success: true };
}

export async function atribuirNumeroVendaAprovada(orcamentoId: number, database?: any) {
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const empresaId = (await getEmpresaUnica()).id;
  const venda = await db.select().from(orcamentos).where(and(eq(orcamentos.id, orcamentoId), eq(orcamentos.empresaId, empresaId))).limit(1);
  if (!venda[0]) throw new Error("Venda não encontrada");
  if (venda[0].numero) return venda[0].numero;

  const sequencia = await reservarProximoNumeroDocumento(db, "venda");
  const numero = formatarNumeroDocumentoPadronizado("venda", sequencia);
  await db.insert(sequenciasVendas).values({
    empresaId,
    orcamentoId,
    numero,
  });
  await db.update(orcamentos).set({ numero }).where(and(eq(orcamentos.id, orcamentoId), eq(orcamentos.empresaId, empresaId)));
  return numero;
}

async function criarReservasVendaInterna(tx: any, venda: any, userId: number, versao = venda.versaoComercial ?? 1) {
  const existentes = await tx.select({ id: reservasEstoqueVenda.id })
    .from(reservasEstoqueVenda)
    .where(and(
      eq(reservasEstoqueVenda.empresaId, venda.empresaId),
      eq(reservasEstoqueVenda.orcamentoId, venda.id),
      eq(reservasEstoqueVenda.versaoComercial, versao),
      eq(reservasEstoqueVenda.estado, "reservada"),
      eq(reservasEstoqueVenda.tipoComercializacao, "metro_cubico"),
    )).limit(1).for("update");
  if (existentes.length) return { criada: false };

  const itens = await tx.select().from(itensOrcamento)
    .where(and(eq(itensOrcamento.empresaId, venda.empresaId), eq(itensOrcamento.orcamentoId, venda.id)));
  const lotes = await tx.select().from(lotesPecasSerradas)
    .where(and(eq(lotesPecasSerradas.empresaId, venda.empresaId), eq(lotesPecasSerradas.propriedade, "proprio"), eq(lotesPecasSerradas.tipo, "peca")))
    .for("update");
  const reservasAtivas = await tx.select({ loteId: reservasEstoqueVenda.loteId, quantidade: reservasEstoqueVenda.quantidade })
    .from(reservasEstoqueVenda)
    .where(and(eq(reservasEstoqueVenda.empresaId, venda.empresaId), eq(reservasEstoqueVenda.estado, "reservada"), eq(reservasEstoqueVenda.tipoComercializacao, "metro_cubico")))
    .for("update");
  const alocacoes = planejarReservasVendaInterna({
    itens: itens.map((item: any) => ({ ...item, quantidade: Number(item.quantidade) })),
    lotes: lotes.map((lote: any) => ({ ...lote, quantidadeDisponivel: Number(lote.quantidadeDisponivel) })),
    reservasAtivas,
  });
  if (alocacoes.length) {
    await tx.insert(reservasEstoqueVenda).values(alocacoes.map((alocacao) => {
      const item = itens.find((linha: any) => linha.id === alocacao.itemOrcamentoId);
      return {
        empresaId: venda.empresaId,
        orcamentoId: venda.id,
        itemOrcamentoId: alocacao.itemOrcamentoId,
        versaoComercial: versao,
        chaveReserva: alocacao.chaveReserva,
        tipoComercializacao: "metro_cubico" as const,
        produtoComercialId: item?.produtoComercialId ?? null,
        madeiraId: item?.madeiraId ?? null,
        bitolaId: item?.bitolaId ?? null,
        loteId: alocacao.loteId,
        descricaoRecurso: alocacao.madeiraNome,
        espessura: alocacao.espessura,
        largura: alocacao.largura,
        comprimento: alocacao.comprimento,
        quantidade: alocacao.quantidade,
        unidadeMedida: "peca" as const,
        estado: "reservada" as const,
        criadoPor: userId,
      };
    }));
  }
  return { criada: true, quantidade: alocacoes.length };
}

export async function updateOrcamentoEstado(
  id: number,
  novoEstado: "rascunho" | "enviado" | "aprovado" | "rejeitado",
  userId?: number,
  confirmacaoDupla = false,
  dependencias?: { database?: any; criarTituloReceber?: (orcamentoId: number, usuarioId: number) => Promise<unknown>; atribuirNumero?: (orcamentoId: number) => Promise<string> },
) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const vendaAtual = (await db.select({ tipoVenda: orcamentos.tipoVenda }).from(orcamentos)
    .where(and(eq(orcamentos.id, id), eq(orcamentos.empresaId, empresaId))).limit(1))[0];
  if (vendaAtual?.tipoVenda === "interna" && novoEstado === "aprovado") {
    return db.transaction(async (tx: any) => {
      const venda = (await tx.select().from(orcamentos).where(and(eq(orcamentos.id, id), eq(orcamentos.empresaId, empresaId))).for("update").limit(1))[0];
      if (!venda) throw new Error("Orçamento não encontrado");
      if (!podeAlterarOrcamentoPago(venda.pago, confirmacaoDupla)) throw new Error("Orçamento pago está bloqueado. Confirme duas vezes para prosseguir.");
      if (venda.tipoVenda !== "interna") throw new Error("O tipo da venda foi alterado durante a aprovação");
      if (venda.estado === "aprovado") {
        if (venda.entregue) return { success: true, jaAprovado: true };
        await criarReservasVendaInterna(tx, venda, userId ?? venda.criadoPor ?? 0);
        if (userId) await criarTituloReceberDeOrcamento(id, userId, undefined, tx);
        return { success: true, jaAprovado: true };
      }
      if (venda.estado === "rejeitado") throw new Error("Uma venda rejeitada não pode ser aprovada novamente neste fluxo");
      await criarReservasVendaInterna(tx, venda, userId ?? venda.criadoPor ?? 0);
      const numeroAprovado = await (dependencias?.atribuirNumero ?? ((orcamentoId: number) => atribuirNumeroVendaAprovada(orcamentoId, tx)))(id);
      await tx.update(orcamentos).set({ estado: novoEstado }).where(and(eq(orcamentos.id, id), eq(orcamentos.empresaId, empresaId)));
      if (userId) {
        await tx.insert(historicoAlteracoes).values({ empresaId, orcamentoId: id, usuarioId: userId, tipo: "estado" as any, detalhes: JSON.stringify({ novoEstado, numero: numeroAprovado }) });
        await criarTituloReceberDeOrcamento(id, userId, undefined, tx);
      }
      return { success: true };
    });
  }
  const orcamento = await validarAlteracaoOrcamento(id, confirmacaoDupla, db);
  const numeroAprovado = novoEstado === "aprovado"
    ? await (dependencias?.atribuirNumero ?? ((orcamentoId: number) => atribuirNumeroVendaAprovada(orcamentoId, db)))(id)
    : undefined;
  await db.update(orcamentos).set({ estado: novoEstado }).where(and(eq(orcamentos.id, id), eq(orcamentos.empresaId, empresaId)));
  if (userId) {
    await db.insert(historicoAlteracoes).values({
      empresaId: orcamento.empresaId,
      orcamentoId: id,
      usuarioId: userId,
      tipo: "estado" as any,
      detalhes: JSON.stringify({ novoEstado, numero: numeroAprovado }),
    });
  }
  if (novoEstado === "aprovado" && userId) {
    if (dependencias?.criarTituloReceber) await dependencias.criarTituloReceber(id, userId);
    else await criarTituloReceberDeOrcamento(id, userId, undefined);
  }
  return { success: true };
}

export async function registrarPagamentoOrcamento(id: number, userId: number, formaPagamento: string, pagoEm: Date) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const orcamento = await getOrcamentoById(id);
  if (!orcamento) throw new Error("Orçamento não encontrado");
  if (orcamento.estado !== "aprovado") throw new Error("Apenas orçamentos aprovados podem ser marcados como pagos");
  if (orcamento.pago) throw new Error("Este orçamento já foi registrado como pago");

  const titulosAtivos = await db.select().from(titulosFinanceiros)
    .where(and(
      eq(titulosFinanceiros.origem, "orcamento"),
      eq(titulosFinanceiros.orcamentoId, id),
      eq(titulosFinanceiros.empresaId, orcamento.empresaId),
      ne(titulosFinanceiros.estado, "cancelado"),
    ));
  if (titulosAtivos.length > 1) {
    throw new Error("Esta venda possui condição parcelada. Registre o recebimento de cada parcela no módulo Financeiro.");
  }

  const titulo = await criarTituloReceberDeOrcamento(id, userId, pagoEm);
  if (titulo) {
    const contaFinanceiraId = await getOrCreateContaFinanceiraPadrao(userId);
    await registrarBaixaFinanceira({
      tituloId: titulo.id,
      contaFinanceiraId,
      valor: saldoAbertoTitulo(titulo.valorOriginal, titulo.desconto, titulo.juros, titulo.valorBaixado).toFixed(2),
      dataBaixa: pagoEm,
      formaPagamento,
      criadoPor: userId,
    });
  }
  await db.update(orcamentos).set({ pago: true, pagoEm, formaPagamento, pagoPor: userId }).where(and(eq(orcamentos.id, id), eq(orcamentos.empresaId, empresaId)));
  await db.insert(historicoAlteracoes).values({
    empresaId: orcamento.empresaId,
    orcamentoId: id,
    usuarioId: userId,
    tipo: "alteracao" as any,
    detalhes: JSON.stringify({ acao: "pagamento_registrado", formaPagamento, pagoEm: pagoEm.toISOString() }),
  });
  return { success: true, pagoEm, formaPagamento };
}

export async function atualizarDatasOrcamento(
  id: number,
  datas: { dataVencimento: Date; competencia: Date },
  confirmacaoDupla = false,
  database?: any,
) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  await validarAlteracaoOrcamento(id, confirmacaoDupla, db);
  await db.update(orcamentos).set(datas).where(and(eq(orcamentos.id, id), eq(orcamentos.empresaId, empresaId)));

  const titulosAtivos = await db.select().from(titulosFinanceiros)
    .where(and(and(
      eq(titulosFinanceiros.origem, "orcamento"),
      eq(titulosFinanceiros.orcamentoId, id),
      ne(titulosFinanceiros.estado, "cancelado"),
    ), eq(titulosFinanceiros.empresaId, empresaId)));
  const titulo = titulosAtivos.length === 1 ? titulosAtivos[0] : undefined;
  if (titulo) {
    const estado = calcularEstadoTitulo({
      valorOriginal: titulo.valorOriginal,
      desconto: titulo.desconto,
      juros: titulo.juros,
      valorBaixado: titulo.valorBaixado,
      dataVencimento: datas.dataVencimento,
      cancelado: titulo.estado === "cancelado",
    });
    await db.update(titulosFinanceiros).set({
      dataVencimento: datas.dataVencimento,
      competencia: datas.competencia,
      estado,
    }).where(and(eq(titulosFinanceiros.id, titulo.id), eq(titulosFinanceiros.empresaId, empresaId)));
  } else if (titulosAtivos.length > 1) {
    await db.update(titulosFinanceiros).set({ competencia: datas.competencia })
      .where(and(inArray(titulosFinanceiros.id, titulosAtivos.map((titulo: { id: number }) => titulo.id)), eq(titulosFinanceiros.empresaId, empresaId)));
  }
  return { success: true, tituloAtualizado: Boolean(titulo), parcelasPreservadas: titulosAtivos.length > 1 };
}
