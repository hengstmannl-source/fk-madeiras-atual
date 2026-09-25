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
import { criarTituloReceberDeOrcamento, getOrCreateContaFinanceiraPadrao, registrarBaixaFinanceira } from "./financeiro";
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
  if (Object.keys(data).length) await db.update(produtosComerciais).set(data).where(eq(produtosComerciais.id, id));
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
      await tx.update(romaneiosCargaToras).set(cabecalho).where(eq(romaneiosCargaToras.id, carga.id));
      if (titulo && alteraFinanceiro) await tx.update(titulosFinanceiros).set({
        fornecedorId: data.fornecedorId === undefined ? titulo.fornecedorId : data.fornecedorId,
        contraparteNome: data.fornecedorId === undefined ? titulo.contraparteNome : fornecedorNovo?.nome ?? carga.origem,
        dataEmissao: dataCarga, competencia: dataCarga, dataVencimento,
        valorOriginal: data.fretePorMetroCubico === undefined ? titulo.valorOriginal : valorTotal.toFixed(2),
        estado: calcularEstadoTitulo({ valorOriginal: data.fretePorMetroCubico === undefined ? titulo.valorOriginal : valorTotal.toFixed(2), dataVencimento }),
      }).where(eq(titulosFinanceiros.id, titulo.id));
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
          const movimentoPosterior = await tx.select({ id: movimentacoesEstoqueSerrado.id }).from(movimentacoesEstoqueSerrado).where(and(eq(movimentacoesEstoqueSerrado.loteId, lote.id), ne(movimentacoesEstoqueSerrado.tipo, "entrada_producao"))).limit(1);
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
      await tx.update(serragensTerceiros).set(cabecalho).where(eq(serragensTerceiros.id, servico.id));
      if (titulo && alteraFinanceiro) await tx.update(titulosFinanceiros).set({
        clienteId: data.clienteId ?? titulo.clienteId, contraparteNome: data.clienteId ? clienteNovo!.nome : titulo.contraparteNome,
        dataEmissao: dataProducao, competencia: dataProducao, dataVencimento,
        estado: calcularEstadoTitulo({ valorOriginal: titulo.valorOriginal, dataVencimento }),
      }).where(eq(titulosFinanceiros.id, titulo.id));
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
  const itens = await db.select().from(itensOrcamento).where(eq(itensOrcamento.orcamentoId, id));
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
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const resultado = await db.select().from(orcamentos).where(eq(orcamentos.id, id)).limit(1);
  const orcamento = resultado[0];
  if (!orcamento) throw new Error("Orçamento não encontrado");
  if (!podeAlterarOrcamentoPago(orcamento.pago, confirmacaoDupla)) {
    throw new Error("Orçamento pago está bloqueado. Confirme duas vezes para prosseguir.");
  }
  return orcamento;
}

export async function createOrcamento(
  data: InsertOrcamento,
  itens: Array<Partial<InsertItemOrcamento> & { componentesPacote?: ComponenteComercialInput[] }>,
  aproveitamentos: Array<{ madeiraNome: string; volume: string; precoM3: string }> = [],
  taxasAdicionais: Array<{ descricao: string; tipo: "percentual" | "fixo"; valor: string; calculado: string; ordem?: number }> = [],
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(orcamentos).values(data);
  const orcId = result[0].insertId;
  if (itens.length > 0) {
    const itensWithOrcId: InsertItemOrcamento[] = itens.map((i): InsertItemOrcamento => ({
      empresaId: data.empresaId,
      orcamentoId: orcId,
      madeiraId: i.madeiraId ?? null,
      bitolaId: i.bitolaId!,
      madeiraNome: i.madeiraNome!,
      bitolaDescricao: i.bitolaDescricao!,
      espessura: i.espessura!,
      largura: i.largura!,
      comprimento: i.comprimento!,
      quantidade: i.quantidade!,
      produtoComercialId: i.produtoComercialId ?? null,
      tipoComercializacao: i.tipoComercializacao ?? "metro_cubico",
      unidadesPorComercializacao: i.unidadesPorComercializacao ?? 1,
      precoM3: i.precoM3!,
      precoLinear: i.precoLinear!,
      valorPeca: i.valorPeca!,
      valorTotal: i.valorTotal!,
    }));
    for (let indice = 0; indice < itensWithOrcId.length; indice += 1) {
      const item = itensWithOrcId[indice];
      const resultadoItem = await db.insert(itensOrcamento).values(item);
      const componentes = itens[indice].componentesPacote ?? [];
      if (!componentes.length) continue;
      await db.insert(componentesPacoteOrcamento).values(componentes.map((componente): InsertComponentePacoteOrcamento => ({
        empresaId: data.empresaId,
        itemOrcamentoId: Number(resultadoItem[0].insertId),
        descricao: componente.descricao,
        madeiraNome: componente.madeiraNome ?? null,
        espessura: componente.espessura ?? null,
        largura: componente.largura ?? null,
        comprimento: componente.comprimento ?? null,
        quantidadePorPacote: componente.quantidade,
      })));
    }
  }
  if (aproveitamentos.length > 0) {
    await db.insert(aproveitamentosOrcamento).values(aproveitamentos.map((item) => {
      const volume = Number(item.volume);
      const precoM3 = Number(item.precoM3);
      return {
        empresaId: data.empresaId,
        orcamentoId: orcId,
        madeiraNome: item.madeiraNome,
        volume: volume.toFixed(3),
        precoM3: precoM3.toFixed(2),
        valorTotal: (volume * precoM3).toFixed(2),
      };
    }));
  }
  if (taxasAdicionais.length > 0) {
    await db.insert(taxasAdicionaisOrcamento).values(taxasAdicionais.map((taxa, indice) => ({
      empresaId: data.empresaId,
      orcamentoId: orcId,
      descricao: taxa.descricao.trim(),
      tipo: taxa.tipo,
      valor: Number(taxa.valor.replace(",", ".")).toFixed(4),
      calculado: Number(taxa.calculado.replace(",", ".")).toFixed(2),
      ordem: taxa.ordem ?? indice,
    })));
  }
  if (data.criadoPor) {
    await db.insert(historicoAlteracoes).values({
      empresaId: data.empresaId,
      orcamentoId: orcId,
      usuarioId: data.criadoPor,
      tipo: "criacao" as any,
      detalhes: JSON.stringify({ numero: data.numero, estado: data.estado }),
    });
  }
  return { id: orcId };
}

export async function updateOrcamento(id: number, data: Partial<InsertOrcamento>, confirmacaoDupla = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await validarAlteracaoOrcamento(id, confirmacaoDupla);
  await db.update(orcamentos).set(data).where(eq(orcamentos.id, id));
  return { success: true };
}

export async function cancelarRecebivelDeVendaExcluida(orcamentoId: number, userId: number, database?: any) {
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const titulos = await db.select().from(titulosFinanceiros)
    .where(and(eq(titulosFinanceiros.origem, "orcamento"), eq(titulosFinanceiros.orcamentoId, orcamentoId)));
  if (!titulos.length) return { cancelado: false, tituloIds: [] };
  if (titulos.some((titulo: { valorBaixado: string }) => decimalParaNumero(titulo.valorBaixado) > 0)) {
    throw new Error("A venda possui recebimentos registrados e não pode ser excluída. Regularize as baixas primeiro.");
  }
  const resolvidoEm = new Date();
  const titulosAtivos = titulos.filter((titulo: { estado: string }) => titulo.estado !== "cancelado");
  if (!titulosAtivos.length) return { cancelado: false, tituloIds: [] };
  const tituloIds = titulosAtivos.map((titulo: { id: number }) => titulo.id);
  await db.update(titulosFinanceiros).set({ estado: "cancelado", canceladoEm: resolvidoEm, canceladoPor: userId })
    .where(inArray(titulosFinanceiros.id, tituloIds));
  await db.update(alertasFinanceiros).set({ resolvidoEm }).where(inArray(alertasFinanceiros.tituloId, tituloIds));
  return { cancelado: true, tituloIds, tituloId: tituloIds[0] };
}

export async function deleteOrcamento(id: number, confirmacaoDupla = false, userId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await validarAlteracaoOrcamento(id, confirmacaoDupla);
  if (userId) await cancelarRecebivelDeVendaExcluida(id, userId, db);
  await db.delete(taxasAdicionaisOrcamento).where(eq(taxasAdicionaisOrcamento.orcamentoId, id));
  await db.delete(itensOrcamento).where(eq(itensOrcamento.orcamentoId, id));
  await db.delete(orcamentos).where(eq(orcamentos.id, id));
  return { success: true };
}

export async function atribuirNumeroVendaAprovada(orcamentoId: number, database?: any) {
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const empresaId = (await getEmpresaUnica()).id;
  const venda = await db.select().from(orcamentos).where(eq(orcamentos.id, orcamentoId)).limit(1);
  if (!venda[0]) throw new Error("Venda não encontrada");
  if (venda[0].numero) return venda[0].numero;

  const sequencia = await reservarProximoNumeroDocumento(db, "venda");
  const numero = formatarNumeroDocumentoPadronizado("venda", sequencia);
  await db.insert(sequenciasVendas).values({
    empresaId,
    orcamentoId,
    numero,
  });
  await db.update(orcamentos).set({ numero }).where(eq(orcamentos.id, orcamentoId));
  return numero;
}

export async function updateOrcamentoEstado(
  id: number,
  novoEstado: "rascunho" | "enviado" | "aprovado" | "rejeitado",
  userId?: number,
  confirmacaoDupla = false,
  dependencias?: { database?: any; criarTituloReceber?: (orcamentoId: number, usuarioId: number) => Promise<unknown>; atribuirNumero?: (orcamentoId: number) => Promise<string> },
) {
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  const orcamento = await validarAlteracaoOrcamento(id, confirmacaoDupla, db);
  const numeroAprovado = novoEstado === "aprovado"
    ? await (dependencias?.atribuirNumero ?? ((orcamentoId: number) => atribuirNumeroVendaAprovada(orcamentoId, db)))(id)
    : undefined;
  await db.update(orcamentos).set({ estado: novoEstado }).where(eq(orcamentos.id, id));
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
  await db.update(orcamentos).set({ pago: true, pagoEm, formaPagamento, pagoPor: userId }).where(eq(orcamentos.id, id));
  await db.insert(historicoAlteracoes).values({
    empresaId: orcamento.empresaId,
    orcamentoId: id,
    usuarioId: userId,
    tipo: "alteracao" as any,
    detalhes: JSON.stringify({ acao: "pagamento_registrado", formaPagamento, pagoEm: pagoEm.toISOString() }),
  });
  return { success: true, pagoEm, formaPagamento };
}

export async function duplicateOrcamento(id: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const data = await getOrcamentoWithItems(id);
  if (!data) throw new Error("Orçamento não encontrado");
  const { orcamento, itens } = data;
  const novoOrc: InsertOrcamento = {
    empresaId: orcamento.empresaId,
    numero: null,
    clienteId: orcamento.clienteId,
    estado: "rascunho",
    desconto: orcamento.desconto,
    frete: orcamento.frete,
    fretePorTonelada: orcamento.fretePorTonelada,
    pesoCargaToneladas: orcamento.pesoCargaToneladas,
    abatimentoFrete: orcamento.abatimentoFrete,
    baseAposFrete: orcamento.baseAposFrete,
    comissaoTipo: orcamento.comissaoTipo,
    comissaoValor: orcamento.comissaoValor,
    comissaoCalculada: orcamento.comissaoCalculada,
    taxaDescricao: orcamento.taxaDescricao,
    taxaTipo: orcamento.taxaTipo,
    taxaValor: orcamento.taxaValor,
    taxaCalculada: orcamento.taxaCalculada,
    subtotal: orcamento.subtotal,
    total: orcamento.total,
    totalPecas: orcamento.totalPecas,
    totalMetroLinear: orcamento.totalMetroLinear,
    totalVolume: orcamento.totalVolume,
    observacoes: orcamento.observacoes,
    vendedor: orcamento.vendedor,
    criadoPor: orcamento.criadoPor,
    dataVencimento: orcamento.dataVencimento,
    competencia: orcamento.competencia,
    pago: false,
    pagoEm: null,
    formaPagamento: null,
    pagoPor: null,
  };
  const novosItens: Omit<InsertItemOrcamento, "id">[] = itens.map(i => ({
    empresaId: orcamento.empresaId,
    orcamentoId: 0, // will be replaced by createOrcamento
    madeiraId: i.madeiraId,
    bitolaId: i.bitolaId,
    madeiraNome: i.madeiraNome,
    bitolaDescricao: i.bitolaDescricao,
    espessura: i.espessura,
    largura: i.largura,
    comprimento: i.comprimento,
    quantidade: i.quantidade,
    tipoComercializacao: i.tipoComercializacao,
    unidadesPorComercializacao: i.unidadesPorComercializacao,
    precoM3: i.precoM3,
    precoLinear: i.precoLinear,
    valorPeca: i.valorPeca,
    valorTotal: i.valorTotal,
  }));
  return createOrcamento(novoOrc, novosItens, data.aproveitamentos ?? [], (data.taxasAdicionais ?? []).map((taxa) => ({
    descricao: taxa.descricao,
    tipo: taxa.tipo,
    valor: String(taxa.valor),
    calculado: String(taxa.calculado),
    ordem: taxa.ordem,
  })));
}

export async function atualizarDatasOrcamento(
  id: number,
  datas: { dataVencimento: Date; competencia: Date },
  confirmacaoDupla = false,
  database?: any,
) {
  const db = database ?? await getDb();
  if (!db) throw new Error("Database not available");
  await validarAlteracaoOrcamento(id, confirmacaoDupla, db);
  await db.update(orcamentos).set(datas).where(eq(orcamentos.id, id));

  const titulosAtivos = await db.select().from(titulosFinanceiros)
    .where(and(
      eq(titulosFinanceiros.origem, "orcamento"),
      eq(titulosFinanceiros.orcamentoId, id),
      ne(titulosFinanceiros.estado, "cancelado"),
    ));
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
    }).where(eq(titulosFinanceiros.id, titulo.id));
  } else if (titulosAtivos.length > 1) {
    await db.update(titulosFinanceiros).set({ competencia: datas.competencia })
      .where(inArray(titulosFinanceiros.id, titulosAtivos.map((titulo: { id: number }) => titulo.id)));
  }
  return { success: true, tituloAtualizado: Boolean(titulo), parcelasPreservadas: titulosAtivos.length > 1 };
}
