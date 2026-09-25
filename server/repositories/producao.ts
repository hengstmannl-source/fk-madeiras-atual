import { eq, and, asc, desc, gte, lte, ne, inArray, or, sql, type InferSelectModel, type SQL } from "drizzle-orm";
import {
  InsertUser, users, madeiras, bitolas, clientes,
  orcamentos, itensOrcamento, componentesPacoteOrcamento, taxasAdicionaisOrcamento, produtosComerciais, componentesProdutoComercial, modelosMedidaVenda, historicoAlteracoes, empresaConfiguracoes,
  empresas, credenciaisUsuarios, convitesEmpresa, recuperacoesSenha,
  fornecedores, categoriasFinanceiras, contasFinanceiras, titulosFinanceiros, sequenciasVendas, sequenciasDocumentos,
  baixasFinanceiras, chequesFinanceiros, recorrenciasFinanceiras, configuracoesFinanceiras, alertasFinanceiros, extratosBancarios, movimentosExtratoBancario, anexosFinanceiros,
  plaquetas, conferenciasVariacaoPlaquetas, romaneiosCargaToras, romaneiosProducao, itensRomaneioToras, itensRomaneioProducao, aproveitamentosRomaneioProducao, aproveitamentosOrcamento, serragensTerceiros, itensSerragemToras, itensSerragemPecas, retiradasSerragemTerceiros, itensRetiradaSerragemTerceiros, lotesPecasSerradas, movimentacoesPlaquetas, movimentacoesEstoqueSerrado, notasDiesel, abastecimentosDiesel, regularizacoesVolumePlaquetas,
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
import { prepararIdentificacaoPlaqueta } from "./estoque";
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

export async function confirmarRomaneioProducao(data: {
  plaquetaId?: number;
  tora?: { madeiraNome: string; diametro?: string | null; espessura?: string | null; largura?: string | null; comprimento?: string | null; volume: string };
  toras?: Array<{ plaquetaId?: number; novaPlaqueta?: { codigo?: string | null }; medidasConferidasManual?: boolean; tora: { madeiraNome: string; diametro?: string | null; comprimento?: string | null; volume: string } }>;
  dataProducao: Date;
  fita?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  itens: ItemProducaoEntrada[];
  aproveitamentos?: Array<{ madeiraNome: string; volume: string | number }>;
  incluirAproveitamentoNoRendimento?: boolean;
  criadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const entradasToras = data.toras ?? (data.plaquetaId && data.tora ? [{ plaquetaId: data.plaquetaId, tora: data.tora }] : []);
    if (!entradasToras.length) throw new Error("Informe ao menos uma plaqueta para o romaneio");
    const plaquetasSelecionadas = [];
    for (const entrada of entradasToras) {
      let plaqueta;
      if (entrada.novaPlaqueta) {
        const volumeInicial = Number(String(entrada.tora.volume).replace(",", "."));
        if (!Number.isFinite(volumeInicial) || volumeInicial <= 0 || !entrada.tora.madeiraNome.trim()) {
          throw new Error("Informe essência e volume válidos para a nova plaqueta");
        }
        const identificacao = await prepararIdentificacaoPlaqueta(tx, entrada.novaPlaqueta.codigo);
        const insercaoPlaqueta = await tx.insert(plaquetas).values({
          empresaId: data.empresaId,
          ...identificacao,
          madeiraNome: entrada.tora.madeiraNome.trim(),
          diametro: entrada.tora.diametro ? Number(String(entrada.tora.diametro).replace(",", ".")).toFixed(2) : null,
          comprimento: entrada.tora.comprimento ? Number(String(entrada.tora.comprimento).replace(",", ".")).toFixed(2) : null,
          volumeInicial: volumeInicial.toFixed(6),
          volumeDisponivel: volumeInicial.toFixed(6),
          dataEntrada: data.dataProducao,
          origem: "Produção — entrada imediata",
          observacoes: "Entrada e consumo imediato no romaneio diário",
          estado: "disponivel",
          criadoPor: data.criadoPor,
        });
        const plaquetaId = getInsertedId(insercaoPlaqueta as MysqlInsertResult);
        await tx.insert(movimentacoesPlaquetas).values({
          empresaId: data.empresaId,
          plaquetaId,
          tipo: "entrada",
          volume: volumeInicial.toFixed(6),
          motivo: "Entrada imediata pela Produção Diária",
          criadoPor: data.criadoPor,
        });
        plaqueta = (await tx.select().from(plaquetas).where(and(eq(plaquetas.id, plaquetaId), eq(plaquetas.empresaId, data.empresaId))).limit(1))[0];
      } else {
        plaqueta = (await tx.select().from(plaquetas).where(and(eq(plaquetas.id, entrada.plaquetaId!), eq(plaquetas.empresaId, data.empresaId))).limit(1))[0];
      }
      if (!plaqueta) throw new Error("A plaqueta selecionada não foi encontrada");
      if (plaqueta.situacaoIdentificacao === "duplicada") {
        const medidasPreenchidas = Boolean(entrada.tora.madeiraNome.trim() && entrada.tora.diametro && entrada.tora.comprimento && entrada.tora.volume);
        if (!entrada.medidasConferidasManual || !medidasPreenchidas) {
          throw new Error(`A plaqueta física ${plaqueta.codigoFisico ?? plaqueta.codigo} possui duplicidade. Confirme e preencha manualmente a essência, o diâmetro, o comprimento e o volume antes de continuar.`);
        }
      }
      plaquetasSelecionadas.push({ plaqueta, tora: entrada.tora });
    }
    const calculo = validarConfirmacaoRomaneio({ toras: plaquetasSelecionadas, itens: data.itens, aproveitamentos: data.aproveitamentos, incluirAproveitamentoNoRendimento: data.incluirAproveitamentoNoRendimento });
    const primeiraTora = calculo.toras[0];
    const numeroTemporario = `TMP-${crypto.randomUUID().slice(0, 20)}`;
    const insercaoRomaneio = await tx.insert(romaneiosProducao).values({
      empresaId: data.empresaId,
      numero: numeroTemporario,
      plaquetaId: primeiraTora.plaqueta.id,
      totalToras: calculo.totalToras,
      madeiraTora: primeiraTora.tora.madeiraNome.trim(),
      espessuraTora: null,
      larguraTora: null,
      comprimentoTora: primeiraTora.tora.comprimento ? Number(primeiraTora.tora.comprimento).toFixed(2) : null,
      volumeTora: calculo.volumeTora.toFixed(6),
      aproveitamento: calculo.aproveitamento.toFixed(2),
      volumeAproveitamento: calculo.volumeAproveitamento.toFixed(6),
      incluirAproveitamentoNoRendimento: calculo.incluirAproveitamentoNoRendimento,
      dataProducao: data.dataProducao,
      fita: data.fita?.trim() || null,
      responsavel: data.responsavel?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
      estado: "confirmado",
      confirmadoEm: new Date(),
      confirmadoPor: data.criadoPor,
      criadoPor: data.criadoPor,
    });
    const romaneioId = getInsertedId(insercaoRomaneio as MysqlInsertResult);
    const numero = `ROM-${String(romaneioId).padStart(6, "0")}`;
    await tx.update(romaneiosProducao).set({ numero }).where(eq(romaneiosProducao.id, romaneioId));

    for (const entrada of calculo.toras) {
      const plaquetaId = entrada.plaqueta.id!;
      await tx.insert(itensRomaneioToras).values({
        empresaId: data.empresaId,
        romaneioId,
        plaquetaId,
        madeiraNome: entrada.tora.madeiraNome.trim(),
        diametro: entrada.tora.diametro ? Number(entrada.tora.diametro).toFixed(2) : null,
        comprimento: entrada.tora.comprimento ? Number(entrada.tora.comprimento).toFixed(2) : null,
        volume: entrada.volume.toFixed(6),
      });
      await tx.update(plaquetas).set({
        madeiraNome: entrada.tora.madeiraNome.trim(),
        diametro: entrada.tora.diametro ? Number(entrada.tora.diametro).toFixed(2) : null,
        comprimento: entrada.tora.comprimento ? Number(entrada.tora.comprimento).toFixed(2) : null,
        volumeInicial: entrada.volume.toFixed(6),
        volumeDisponivel: "0.000000",
        estado: "consumida",
      }).where(and(eq(plaquetas.id, plaquetaId), eq(plaquetas.empresaId, data.empresaId)));
      await tx.insert(movimentacoesPlaquetas).values({
        empresaId: data.empresaId,
        plaquetaId,
        romaneioId,
        tipo: "consumo",
        volume: entrada.volume.toFixed(6),
        motivo: `Consumo no romaneio ${numero}`,
        criadoPor: data.criadoPor,
      });
    }

    for (const item of calculo.itens) {
      const dimensoes = {
        madeiraNome: item.madeiraNome,
        espessura: item.espessura.toFixed(2),
        largura: item.largura.toFixed(2),
        comprimento: item.comprimento.toFixed(2),
      };
      const insercaoItem = await tx.insert(itensRomaneioProducao).values({
        empresaId: data.empresaId,
        romaneioId,
        ...dimensoes,
        quantidade: item.quantidade,
        metrosLineares: item.metrosLineares.toFixed(4),
        volume: item.volume.toFixed(6),
      });
      const itemRomaneioId = getInsertedId(insercaoItem as MysqlInsertResult);
      const insercaoLote = await tx.insert(lotesPecasSerradas).values({
        empresaId: data.empresaId,
        romaneioId,
        itemRomaneioId,
        ...dimensoes,
        quantidadeProduzida: item.quantidade,
        quantidadeDisponivel: item.quantidade,
        metrosLineares: item.metrosLineares.toFixed(4),
        volume: item.volume.toFixed(6),
        estado: "disponivel",
      });
      const loteId = getInsertedId(insercaoLote as MysqlInsertResult);
      await tx.insert(movimentacoesEstoqueSerrado).values({ empresaId: data.empresaId, loteId, tipo: "entrada_producao", quantidade: item.quantidade, motivo: `Entrada do romaneio ${numero}`, criadoPor: data.criadoPor });
    }
    for (const aproveitamento of calculo.aproveitamentos) {
      await tx.insert(aproveitamentosRomaneioProducao).values({ empresaId: data.empresaId, romaneioId, madeiraNome: aproveitamento.madeiraNome, volume: aproveitamento.volume.toFixed(6) });
      const insercaoLote = await tx.insert(lotesPecasSerradas).values({
        empresaId: data.empresaId, romaneioId, tipo: "aproveitamento", madeiraNome: `Aproveitamento de ${aproveitamento.madeiraNome}`,
        espessura: "0.00", largura: "0.00", comprimento: "0.00", quantidadeProduzida: 1, quantidadeDisponivel: 1,
        metrosLineares: "0.0000", volume: aproveitamento.volume.toFixed(6), estado: "disponivel",
      });
      const loteId = getInsertedId(insercaoLote as MysqlInsertResult);
      await tx.insert(movimentacoesEstoqueSerrado).values({ empresaId: data.empresaId, loteId, tipo: "entrada_producao", quantidade: 1, motivo: `Aproveitamento do romaneio ${numero}`, criadoPor: data.criadoPor });
    }
    return { id: romaneioId, numero, ...calculo };
  });
}

/**
 * Regulariza exclusivamente uma tora consumida cujo volume persistido esteja
 * ausente ou inválido. A produção resultante não é reaberta e o valor original
 * fica preservado na trilha própria de regularização.
 */
export async function regularizarVolumePlaquetaConsumida(data: {
  plaquetaId: number;
  volumeConfirmado: string;
  justificativa: string;
  criadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const volumeConfirmado = Number(String(data.volumeConfirmado).replace(",", "."));
  if (!Number.isFinite(volumeConfirmado) || volumeConfirmado <= 0) {
    throw new Error("Informe um volume cúbico confirmado maior que zero");
  }
  const justificativa = data.justificativa.trim();
  if (justificativa.length < 10) {
    throw new Error("Explique a regularização do volume com ao menos 10 caracteres");
  }

  return db.transaction(async (tx: any) => {
    const plaqueta = (await tx.select().from(plaquetas)
      .where(and(eq(plaquetas.id, data.plaquetaId), eq(plaquetas.empresaId, data.empresaId)))
      .limit(1))[0];
    if (!plaqueta) throw new Error("A plaqueta não foi encontrada");
    if (plaqueta.estado !== "consumida") throw new Error("A regularização de volume é permitida apenas para tora já consumida");

    const consumo = (await tx.select().from(itensRomaneioToras)
      .where(and(eq(itensRomaneioToras.plaquetaId, plaqueta.id), eq(itensRomaneioToras.empresaId, data.empresaId)))
      .limit(1))[0];
    if (!consumo) throw new Error("Não foi localizado o consumo de produção desta plaqueta");

    const volumePlaqueta = Number(plaqueta.volumeInicial ?? 0);
    const volumeConsumo = Number(consumo.volume ?? 0);
    if (volumePlaqueta > 0 && volumeConsumo > 0) {
      throw new Error("Esta tora já possui volume válido. A regularização é exclusiva para dados ausentes ou inválidos");
    }
    const volumeAnterior = volumeConsumo > 0 ? volumeConsumo : volumePlaqueta;

    await tx.update(plaquetas).set({ volumeInicial: volumeConfirmado.toFixed(6), volumeDisponivel: "0.000000" })
      .where(and(eq(plaquetas.id, plaqueta.id), eq(plaquetas.empresaId, data.empresaId)));
    await tx.update(itensRomaneioToras).set({ volume: volumeConfirmado.toFixed(6) })
      .where(and(eq(itensRomaneioToras.id, consumo.id), eq(itensRomaneioToras.empresaId, data.empresaId)));
    await tx.update(movimentacoesPlaquetas).set({ volume: volumeConfirmado.toFixed(6), motivo: `Consumo regularizado: ${justificativa}` })
      .where(and(eq(movimentacoesPlaquetas.plaquetaId, plaqueta.id), eq(movimentacoesPlaquetas.romaneioId, consumo.romaneioId), eq(movimentacoesPlaquetas.empresaId, data.empresaId), eq(movimentacoesPlaquetas.tipo, "consumo")));

    const volumes = await tx.select({ volume: itensRomaneioToras.volume }).from(itensRomaneioToras)
      .where(and(eq(itensRomaneioToras.romaneioId, consumo.romaneioId), eq(itensRomaneioToras.empresaId, data.empresaId)));
    const volumeTora = volumes.reduce((soma: number, item: { volume: string | null }) => soma + Number(item.volume ?? 0), 0);
    await tx.update(romaneiosProducao).set({ volumeTora: volumeTora.toFixed(6) })
      .where(and(eq(romaneiosProducao.id, consumo.romaneioId), eq(romaneiosProducao.empresaId, data.empresaId)));

    const registro = await tx.insert(regularizacoesVolumePlaquetas).values({
      empresaId: data.empresaId,
      plaquetaId: plaqueta.id,
      romaneioProducaoId: consumo.romaneioId,
      volumeAnterior: volumeAnterior.toFixed(6),
      volumeConfirmado: volumeConfirmado.toFixed(6),
      justificativa,
      criadoPor: data.criadoPor,
    });
    return { plaquetaId: plaqueta.id, romaneioProducaoId: consumo.romaneioId, volumeAnterior, volumeConfirmado, regularizacaoId: getInsertedId(registro as MysqlInsertResult) };
  });
}

async function getOrCreateCategoriaReceitaSerragem(tx: any, empresaId: number, userId: number): Promise<number> {
  const existente = (await tx.select().from(categoriasFinanceiras)
    .where(and(eq(categoriasFinanceiras.empresaId, empresaId), eq(categoriasFinanceiras.nome, "Serviço de serragem"), eq(categoriasFinanceiras.ativo, true))).limit(1))[0];
  if (existente) return existente.id;
  const resultado = await tx.insert(categoriasFinanceiras).values({ empresaId, nome: "Serviço de serragem", tipo: "receita", ativo: true, criadoPor: userId });
  return getInsertedId(resultado as MysqlInsertResult);
}

export async function criarSerragemTerceiros(data: {
  clienteId: number;
  centroCustoId?: number | null;
  dataProducao: Date;
  dataVencimento: Date;
  responsavel?: string | null;
  observacoes?: string | null;
  valorMetroCubico: string;
  toras: Array<{ referencia: string; madeiraNome: string; diametro?: string | null; comprimento?: string | null; volume?: string }>;
  itens: ItemProducaoEntrada[];
  criadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx: any) => {
    if (data.centroCustoId) await obterCentroCustoAtivo(data.centroCustoId, tx, data.empresaId);
    const cliente = (await tx.select().from(clientes).where(and(eq(clientes.id, data.clienteId), eq(clientes.empresaId, data.empresaId))).limit(1))[0];
    if (!cliente) throw new Error("Cliente não encontrado para o serviço de serragem");
    const calculo = validarSerragemTerceiros({ toras: data.toras, itens: data.itens });
    const valorMetroCubico = Number(String(data.valorMetroCubico).replace(",", "."));
    if (!Number.isFinite(valorMetroCubico) || valorMetroCubico <= 0) throw new Error("Informe um preço por m³ válido para o serviço de serragem");
    const valorServico = Number((calculo.volumeToras * valorMetroCubico).toFixed(2));
    const insercao = await tx.insert(serragensTerceiros).values({
      empresaId: data.empresaId,
      numero: `SER-TMP-${crypto.randomUUID().slice(0, 16)}`,
      clienteId: data.clienteId,
      centroCustoId: data.centroCustoId ?? null,
      dataProducao: data.dataProducao,
      responsavel: data.responsavel?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
      valorServico: valorServico.toFixed(2),
      valorMetroCubico: valorMetroCubico.toFixed(2),
      dataVencimento: data.dataVencimento,
      volumeToras: calculo.volumeToras.toFixed(6),
      volumeProduzido: calculo.volumeProduzido.toFixed(6),
      aproveitamento: calculo.aproveitamento.toFixed(2),
      criadoPor: data.criadoPor,
    });
    const serragemId = getInsertedId(insercao as MysqlInsertResult);
    const numero = `SER-${String(serragemId).padStart(6, "0")}`;
    await tx.update(serragensTerceiros).set({ numero }).where(eq(serragensTerceiros.id, serragemId));
    await tx.insert(itensSerragemToras).values(calculo.toras.map((tora) => ({
      empresaId: data.empresaId, serragemId, referencia: tora.referencia, madeiraNome: tora.madeiraNome,
      diametro: tora.diametro ? Number(String(tora.diametro).replace(",", ".")).toFixed(2) : null,
      comprimento: tora.comprimento ? Number(String(tora.comprimento).replace(",", ".")).toFixed(2) : null,
      volume: tora.volume.toFixed(6),
    })));
    for (const item of calculo.itens) {
      const insercaoItem = await tx.insert(itensSerragemPecas).values({
        empresaId: data.empresaId, serragemId, madeiraNome: item.madeiraNome, espessura: item.espessura.toFixed(2), largura: item.largura.toFixed(2), comprimento: item.comprimento.toFixed(2),
        quantidade: item.quantidade, metrosLineares: item.metrosLineares.toFixed(4), volume: item.volume.toFixed(6),
      });
      const itemSerragemId = getInsertedId(insercaoItem as MysqlInsertResult);
      const insercaoLote = await tx.insert(lotesPecasSerradas).values({
        empresaId: data.empresaId, romaneioId: null, itemRomaneioId: null, serragemTerceirosId: serragemId, itemSerragemId, propriedade: "terceiro", clienteProprietarioId: data.clienteId,
        madeiraNome: item.madeiraNome, espessura: item.espessura.toFixed(2), largura: item.largura.toFixed(2), comprimento: item.comprimento.toFixed(2), quantidadeProduzida: item.quantidade, quantidadeDisponivel: item.quantidade,
        metrosLineares: item.metrosLineares.toFixed(4), volume: item.volume.toFixed(6), estado: "disponivel",
      });
      const loteId = getInsertedId(insercaoLote as MysqlInsertResult);
      await tx.insert(movimentacoesEstoqueSerrado).values({ empresaId: data.empresaId, loteId, tipo: "entrada_producao", quantidade: item.quantidade, motivo: `Serragem de terceiros ${numero} — propriedade de ${cliente.nome}`, criadoPor: data.criadoPor });
    }
    const categoriaId = await getOrCreateCategoriaReceitaSerragem(tx, data.empresaId, data.criadoPor);
    const { id: tituloFinanceiroId } = await garantirTituloFinanceiroAutomatico({
      tipo: "receber", origem: "serragem_terceiros", chaveIdempotencia: `FIN-SERRAGEM-TERCEIROS-${serragemId}`,
      descricao: `Serviço de serragem — ${numero}`,
      clienteId: data.clienteId, contraparteNome: cliente.nome, serragemTerceirosId: serragemId,
      categoriaId, valorOriginal: valorServico.toFixed(2),
      centroCustoId: data.centroCustoId ?? null,
      dataEmissao: data.dataProducao, dataVencimento: data.dataVencimento, competencia: data.dataProducao,
      observacoes: "Cobrança referente exclusivamente ao serviço de serragem; as peças permanecem de propriedade do cliente.", criadoPor: data.criadoPor,
      database: tx,
    });
    return { id: serragemId, numero, tituloFinanceiroId, ...calculo };
  });
}

export async function listSerragensTerceiros() {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: serragensTerceiros.id, numero: serragensTerceiros.numero, dataProducao: serragensTerceiros.dataProducao, dataVencimento: serragensTerceiros.dataVencimento,
    clienteId: serragensTerceiros.clienteId, clienteNome: clientes.nome, valorServico: serragensTerceiros.valorServico, volumeToras: serragensTerceiros.volumeToras,
    volumeProduzido: serragensTerceiros.volumeProduzido, aproveitamento: serragensTerceiros.aproveitamento, responsavel: serragensTerceiros.responsavel,
  }).from(serragensTerceiros).innerJoin(clientes, and(eq(serragensTerceiros.clienteId, clientes.id), eq(clientes.empresaId, empresaId)))
    .where(eq(serragensTerceiros.empresaId, empresaId)).orderBy(desc(serragensTerceiros.dataProducao), desc(serragensTerceiros.id));
}

export async function getDetalheSerragemTerceiros(id: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const servico = (await db.select({
    id: serragensTerceiros.id, numero: serragensTerceiros.numero, dataProducao: serragensTerceiros.dataProducao, dataVencimento: serragensTerceiros.dataVencimento,
    clienteId: serragensTerceiros.clienteId, clienteNome: clientes.nome, responsavel: serragensTerceiros.responsavel, observacoes: serragensTerceiros.observacoes,
    valorMetroCubico: serragensTerceiros.valorMetroCubico,
  }).from(serragensTerceiros).innerJoin(clientes, and(eq(serragensTerceiros.clienteId, clientes.id), eq(clientes.empresaId, empresaId)))
    .where(and(eq(serragensTerceiros.id, id), eq(serragensTerceiros.empresaId, empresaId))).limit(1))[0];
  if (!servico) throw new Error("Serviço de serragem não encontrado");
  const toras = await db.select({ referencia: itensSerragemToras.referencia, madeiraNome: itensSerragemToras.madeiraNome, diametro: itensSerragemToras.diametro, comprimento: itensSerragemToras.comprimento, volume: itensSerragemToras.volume })
    .from(itensSerragemToras).where(and(eq(itensSerragemToras.empresaId, empresaId), eq(itensSerragemToras.serragemId, id))).orderBy(asc(itensSerragemToras.id));
  const itens = await db.select({ madeiraNome: itensSerragemPecas.madeiraNome, espessura: itensSerragemPecas.espessura, largura: itensSerragemPecas.largura, comprimento: itensSerragemPecas.comprimento, quantidade: itensSerragemPecas.quantidade })
    .from(itensSerragemPecas).where(and(eq(itensSerragemPecas.empresaId, empresaId), eq(itensSerragemPecas.serragemId, id))).orderBy(asc(itensSerragemPecas.id));
  const lotes = await db.select({
    id: lotesPecasSerradas.id, madeiraNome: lotesPecasSerradas.madeiraNome, espessura: lotesPecasSerradas.espessura, largura: lotesPecasSerradas.largura,
    comprimento: lotesPecasSerradas.comprimento, quantidadeProduzida: lotesPecasSerradas.quantidadeProduzida, quantidadeDisponivel: lotesPecasSerradas.quantidadeDisponivel,
    metrosLineares: lotesPecasSerradas.metrosLineares, volume: lotesPecasSerradas.volume, estado: lotesPecasSerradas.estado,
  }).from(lotesPecasSerradas).where(and(eq(lotesPecasSerradas.empresaId, empresaId), eq(lotesPecasSerradas.serragemTerceirosId, id), eq(lotesPecasSerradas.propriedade, "terceiro"))).orderBy(asc(lotesPecasSerradas.id));
  const retiradas = await db.select({
    id: retiradasSerragemTerceiros.id, dataRetirada: retiradasSerragemTerceiros.dataRetirada, responsavel: retiradasSerragemTerceiros.responsavel,
    observacoes: retiradasSerragemTerceiros.observacoes, loteId: itensRetiradaSerragemTerceiros.loteId, quantidade: itensRetiradaSerragemTerceiros.quantidade,
    madeiraNome: lotesPecasSerradas.madeiraNome, espessura: lotesPecasSerradas.espessura, largura: lotesPecasSerradas.largura, comprimento: lotesPecasSerradas.comprimento,
  }).from(retiradasSerragemTerceiros).innerJoin(itensRetiradaSerragemTerceiros, eq(itensRetiradaSerragemTerceiros.retiradaId, retiradasSerragemTerceiros.id))
    .innerJoin(lotesPecasSerradas, eq(lotesPecasSerradas.id, itensRetiradaSerragemTerceiros.loteId))
    .where(and(eq(retiradasSerragemTerceiros.empresaId, empresaId), eq(retiradasSerragemTerceiros.serragemId, id))).orderBy(desc(retiradasSerragemTerceiros.dataRetirada), desc(retiradasSerragemTerceiros.id));
  return { servico, toras, itens, lotes, retiradas };
}

export async function atualizarSerragemTerceiros(id: number, data: {
  clienteId: number;
  dataProducao: Date;
  dataVencimento: Date;
  responsavel?: string | null;
  observacoes?: string | null;
  valorMetroCubico: string;
  toras: Array<{ referencia: string; madeiraNome: string; diametro?: string | null; comprimento?: string | null; volume?: string }>;
  itens: ItemProducaoEntrada[];
  atualizadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx: any) => {
    const servico = (await tx.select().from(serragensTerceiros).where(and(eq(serragensTerceiros.id, id), eq(serragensTerceiros.empresaId, data.empresaId))).limit(1))[0];
    if (!servico) throw new Error("Serviço de serragem não encontrado");
    const lotes = await tx.select().from(lotesPecasSerradas).where(and(eq(lotesPecasSerradas.serragemTerceirosId, id), eq(lotesPecasSerradas.empresaId, data.empresaId)));
    for (const lote of lotes) {
      const movimentosPosteriores = await tx.select({ id: movimentacoesEstoqueSerrado.id }).from(movimentacoesEstoqueSerrado)
        .where(and(eq(movimentacoesEstoqueSerrado.loteId, lote.id), ne(movimentacoesEstoqueSerrado.tipo, "entrada_producao"))).limit(1);
      if (movimentosPosteriores[0] || lote.quantidadeDisponivel !== lote.quantidadeProduzida) {
        throw new Error("Este serviço possui peças já retiradas ou movimentadas e não pode ser editado. Regularize as saídas antes de alterar a serragem.");
      }
    }
    const titulo = (await tx.select().from(titulosFinanceiros).where(and(eq(titulosFinanceiros.serragemTerceirosId, id), eq(titulosFinanceiros.empresaId, data.empresaId), eq(titulosFinanceiros.origem, "serragem_terceiros"))).limit(1))[0];
    if (!titulo) throw new Error("A cobrança vinculada ao serviço de serragem não foi encontrada");
    const baixa = (await tx.select({ id: baixasFinanceiras.id }).from(baixasFinanceiras).where(and(eq(baixasFinanceiras.tituloId, titulo.id), eq(baixasFinanceiras.empresaId, data.empresaId))).limit(1))[0];
    if (baixa || titulo.estado === "quitado" || titulo.estado === "cancelado") throw new Error("A cobrança deste serviço já possui movimentação financeira e não pode ser editada.");
    const cliente = (await tx.select().from(clientes).where(and(eq(clientes.id, data.clienteId), eq(clientes.empresaId, data.empresaId))).limit(1))[0];
    if (!cliente) throw new Error("Cliente não encontrado para o serviço de serragem");
    const calculo = validarSerragemTerceiros({ toras: data.toras, itens: data.itens });
    const valorMetroCubico = Number(String(data.valorMetroCubico).replace(",", "."));
    if (!Number.isFinite(valorMetroCubico) || valorMetroCubico <= 0) throw new Error("Informe um preço por m³ válido para o serviço de serragem");
    const valorServico = Number((calculo.volumeToras * valorMetroCubico).toFixed(2));
    for (const lote of lotes) await tx.delete(movimentacoesEstoqueSerrado).where(eq(movimentacoesEstoqueSerrado.loteId, lote.id));
    await tx.delete(lotesPecasSerradas).where(and(eq(lotesPecasSerradas.serragemTerceirosId, id), eq(lotesPecasSerradas.empresaId, data.empresaId)));
    await tx.delete(itensSerragemPecas).where(and(eq(itensSerragemPecas.serragemId, id), eq(itensSerragemPecas.empresaId, data.empresaId)));
    await tx.delete(itensSerragemToras).where(and(eq(itensSerragemToras.serragemId, id), eq(itensSerragemToras.empresaId, data.empresaId)));
    await tx.update(serragensTerceiros).set({ clienteId: data.clienteId, dataProducao: data.dataProducao, dataVencimento: data.dataVencimento, responsavel: data.responsavel?.trim() || null, observacoes: data.observacoes?.trim() || null, valorServico: valorServico.toFixed(2), valorMetroCubico: valorMetroCubico.toFixed(2), volumeToras: calculo.volumeToras.toFixed(6), volumeProduzido: calculo.volumeProduzido.toFixed(6), aproveitamento: calculo.aproveitamento.toFixed(2) }).where(eq(serragensTerceiros.id, id));
    await tx.insert(itensSerragemToras).values(calculo.toras.map((tora) => ({ empresaId: data.empresaId, serragemId: id, referencia: tora.referencia, madeiraNome: tora.madeiraNome, diametro: tora.diametro.toFixed(2), comprimento: tora.comprimento.toFixed(2), volume: tora.volume.toFixed(6) })));
    for (const item of calculo.itens) {
      const insercaoItem = await tx.insert(itensSerragemPecas).values({ empresaId: data.empresaId, serragemId: id, madeiraNome: item.madeiraNome, espessura: item.espessura.toFixed(2), largura: item.largura.toFixed(2), comprimento: item.comprimento.toFixed(2), quantidade: item.quantidade, metrosLineares: item.metrosLineares.toFixed(4), volume: item.volume.toFixed(6) });
      const itemSerragemId = getInsertedId(insercaoItem as MysqlInsertResult);
      const insercaoLote = await tx.insert(lotesPecasSerradas).values({ empresaId: data.empresaId, romaneioId: null, itemRomaneioId: null, serragemTerceirosId: id, itemSerragemId, propriedade: "terceiro", clienteProprietarioId: data.clienteId, madeiraNome: item.madeiraNome, espessura: item.espessura.toFixed(2), largura: item.largura.toFixed(2), comprimento: item.comprimento.toFixed(2), quantidadeProduzida: item.quantidade, quantidadeDisponivel: item.quantidade, metrosLineares: item.metrosLineares.toFixed(4), volume: item.volume.toFixed(6), estado: "disponivel" });
      const loteId = getInsertedId(insercaoLote as MysqlInsertResult);
      await tx.insert(movimentacoesEstoqueSerrado).values({ empresaId: data.empresaId, loteId, tipo: "entrada_producao", quantidade: item.quantidade, motivo: `Serragem de terceiros ${servico.numero} — propriedade de ${cliente.nome}`, criadoPor: data.atualizadoPor });
    }
    await tx.update(titulosFinanceiros).set({ descricao: `Serviço de serragem — ${servico.numero}`, clienteId: data.clienteId, contraparteNome: cliente.nome, valorOriginal: valorServico.toFixed(2), dataEmissao: data.dataProducao, dataVencimento: data.dataVencimento, competencia: data.dataProducao, estado: calcularEstadoTitulo({ valorOriginal: valorServico.toFixed(2), dataVencimento: data.dataVencimento }) }).where(eq(titulosFinanceiros.id, titulo.id));
    return { id, numero: servico.numero, ...calculo };
  });
}

export async function registrarRetiradaSerragemTerceiros(data: {
  serragemId: number;
  dataRetirada: Date;
  responsavel?: string | null;
  observacoes?: string | null;
  itens: Array<{ loteId: number; quantidade: number }>;
  criadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const itens = validarRetiradaSerragemTerceiros({ itens: data.itens });
  return db.transaction(async (tx: any) => {
    const servico = (await tx.select().from(serragensTerceiros).where(and(eq(serragensTerceiros.id, data.serragemId), eq(serragensTerceiros.empresaId, data.empresaId))).limit(1))[0];
    if (!servico) throw new Error("Serviço de serragem não encontrado");
    const lotes = [] as Array<{ lote: typeof lotesPecasSerradas.$inferSelect; quantidade: number }>;
    for (const item of itens) {
      const lote = (await tx.select().from(lotesPecasSerradas).where(and(eq(lotesPecasSerradas.id, item.loteId), eq(lotesPecasSerradas.empresaId, data.empresaId), eq(lotesPecasSerradas.serragemTerceirosId, data.serragemId), eq(lotesPecasSerradas.propriedade, "terceiro"), eq(lotesPecasSerradas.clienteProprietarioId, servico.clienteId))).limit(1))[0];
      if (!lote) throw new Error("Uma das peças selecionadas não pertence a este serviço de serragem");
      if (item.quantidade > lote.quantidadeDisponivel) throw new Error(`A retirada de ${lote.madeiraNome} excede o saldo disponível de ${lote.quantidadeDisponivel} peça(s)`);
      lotes.push({ lote, quantidade: item.quantidade });
    }
    const insercao = await tx.insert(retiradasSerragemTerceiros).values({ empresaId: data.empresaId, serragemId: data.serragemId, clienteId: servico.clienteId, dataRetirada: data.dataRetirada, responsavel: data.responsavel?.trim() || null, observacoes: data.observacoes?.trim() || null, criadoPor: data.criadoPor });
    const retiradaId = getInsertedId(insercao as MysqlInsertResult);
    for (const { lote, quantidade } of lotes) {
      const saldo = lote.quantidadeDisponivel - quantidade;
      await tx.update(lotesPecasSerradas).set({ quantidadeDisponivel: saldo, estado: saldo === 0 ? "esgotado" : "disponivel" }).where(eq(lotesPecasSerradas.id, lote.id));
      await tx.insert(itensRetiradaSerragemTerceiros).values({ empresaId: data.empresaId, retiradaId, loteId: lote.id, quantidade });
      await tx.insert(movimentacoesEstoqueSerrado).values({ empresaId: data.empresaId, loteId: lote.id, tipo: "retirada_terceiro", quantidade: -quantidade, motivo: `Retirada pelo cliente — ${servico.numero}`, criadoPor: data.criadoPor });
    }
    return { id: retiradaId, serragemId: data.serragemId };
  });
}

export async function atualizarRomaneioProducao(id: number, data: {
  dataProducao: Date;
  fita?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  itens: ItemProducaoEntrada[];
  atualizadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const romaneio = (await tx.select().from(romaneiosProducao).where(and(eq(romaneiosProducao.id, id), eq(romaneiosProducao.empresaId, data.empresaId))).limit(1))[0];
    if (!romaneio) throw new Error("Romaneio de produção não encontrado");

    const lotes = await tx.select().from(lotesPecasSerradas).where(and(eq(lotesPecasSerradas.romaneioId, id), eq(lotesPecasSerradas.empresaId, data.empresaId)));
    for (const lote of lotes) {
      const movimentosPosteriores = await tx.select({ id: movimentacoesEstoqueSerrado.id }).from(movimentacoesEstoqueSerrado)
        .where(and(eq(movimentacoesEstoqueSerrado.loteId, lote.id), ne(movimentacoesEstoqueSerrado.tipo, "entrada_producao"))).limit(1);
      if (movimentosPosteriores[0] || lote.quantidadeDisponivel !== lote.quantidadeProduzida) {
        throw new Error("Este romaneio possui peças já movimentadas no estoque e não pode ser editado. Regularize as saídas antes de alterar a produção.");
      }
    }

    const torasRegistradas = await tx.select().from(itensRomaneioToras).where(and(eq(itensRomaneioToras.romaneioId, id), eq(itensRomaneioToras.empresaId, data.empresaId)));
    if (!torasRegistradas.length) throw new Error("O romaneio não possui toras rastreáveis para recalcular o aproveitamento");
    const toras = [] as Array<{ plaqueta: typeof plaquetas.$inferSelect; tora: { madeiraNome: string; diametro: string | null; comprimento: string | null; volume: string } }>;
    for (const toraRegistrada of torasRegistradas) {
      const plaqueta = (await tx.select().from(plaquetas).where(and(eq(plaquetas.id, toraRegistrada.plaquetaId), eq(plaquetas.empresaId, data.empresaId))).limit(1))[0];
      if (!plaqueta) throw new Error("Uma plaqueta vinculada a este romaneio não foi encontrada");
      toras.push({
        plaqueta,
        tora: {
          madeiraNome: toraRegistrada.madeiraNome,
          diametro: toraRegistrada.diametro,
          comprimento: toraRegistrada.comprimento,
          volume: toraRegistrada.volume,
        },
      });
    }
    const calculo = validarConfirmacaoRomaneio({ toras, itens: data.itens, permitirPlaquetasConsumidas: true });

    for (const lote of lotes) {
      await tx.delete(movimentacoesEstoqueSerrado).where(eq(movimentacoesEstoqueSerrado.loteId, lote.id));
    }
    await tx.delete(lotesPecasSerradas).where(eq(lotesPecasSerradas.romaneioId, id));
    await tx.delete(itensRomaneioProducao).where(eq(itensRomaneioProducao.romaneioId, id));

    await tx.update(romaneiosProducao).set({
      dataProducao: data.dataProducao,
      fita: data.fita?.trim() || null,
      responsavel: data.responsavel?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
      volumeTora: calculo.volumeTora.toFixed(6),
      aproveitamento: calculo.aproveitamento.toFixed(2),
    }).where(and(eq(romaneiosProducao.id, id), eq(romaneiosProducao.empresaId, data.empresaId)));

    for (const item of calculo.itens) {
      const dimensoes = {
        madeiraNome: item.madeiraNome,
        espessura: item.espessura.toFixed(2),
        largura: item.largura.toFixed(2),
        comprimento: item.comprimento.toFixed(2),
      };
      const insercaoItem = await tx.insert(itensRomaneioProducao).values({
        empresaId: data.empresaId,
        romaneioId: id,
        ...dimensoes,
        quantidade: item.quantidade,
        metrosLineares: item.metrosLineares.toFixed(4),
        volume: item.volume.toFixed(6),
      });
      const itemRomaneioId = getInsertedId(insercaoItem as MysqlInsertResult);
      const insercaoLote = await tx.insert(lotesPecasSerradas).values({
        empresaId: data.empresaId,
        romaneioId: id,
        itemRomaneioId,
        ...dimensoes,
        quantidadeProduzida: item.quantidade,
        quantidadeDisponivel: item.quantidade,
        metrosLineares: item.metrosLineares.toFixed(4),
        volume: item.volume.toFixed(6),
        estado: "disponivel",
      });
      const loteId = getInsertedId(insercaoLote as MysqlInsertResult);
      await tx.insert(movimentacoesEstoqueSerrado).values({
        empresaId: data.empresaId,
        loteId,
        tipo: "entrada_producao",
        quantidade: item.quantidade,
        motivo: `Entrada revisada do romaneio ${romaneio.numero}`,
        criadoPor: data.atualizadoPor,
      });
    }
    return { id, numero: romaneio.numero, ...calculo };
  });
}

export async function excluirRomaneioProducao(id: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const romaneio = (await tx.select().from(romaneiosProducao)
      .where(and(eq(romaneiosProducao.id, id), eq(romaneiosProducao.empresaId, empresaId))).limit(1))[0];
    if (!romaneio) throw new Error("Romaneio de produção não encontrado");

    const lotes = await tx.select().from(lotesPecasSerradas)
      .where(and(eq(lotesPecasSerradas.romaneioId, id), eq(lotesPecasSerradas.empresaId, empresaId)));
    for (const lote of lotes) {
      const movimentoPosterior = (await tx.select({ id: movimentacoesEstoqueSerrado.id }).from(movimentacoesEstoqueSerrado)
        .where(and(eq(movimentacoesEstoqueSerrado.loteId, lote.id), ne(movimentacoesEstoqueSerrado.tipo, "entrada_producao"))).limit(1))[0];
      validarExclusaoRomaneioProducao({
        possuiMovimentacoesPosteriores: Boolean(movimentoPosterior),
        saldoDasPecasFoiAlterado: Number(lote.quantidadeDisponivel) !== Number(lote.quantidadeProduzida),
      });
    }

    const toras = await tx.select({
      plaquetaId: itensRomaneioToras.plaquetaId,
      madeiraNome: itensRomaneioToras.madeiraNome,
      diametro: itensRomaneioToras.diametro,
      comprimento: itensRomaneioToras.comprimento,
      volume: itensRomaneioToras.volume,
      plaqueta: plaquetas,
    }).from(itensRomaneioToras)
      .innerJoin(plaquetas, and(eq(itensRomaneioToras.plaquetaId, plaquetas.id), eq(plaquetas.empresaId, empresaId)))
      .where(and(eq(itensRomaneioToras.romaneioId, id), eq(itensRomaneioToras.empresaId, empresaId)));

    for (const tora of toras) {
      const entradaImediata = tora.plaqueta.origem === "Produção — entrada imediata"
        && tora.plaqueta.observacoes === "Entrada e consumo imediato no romaneio diário";
      if (entradaImediata) {
        await tx.delete(movimentacoesPlaquetas).where(eq(movimentacoesPlaquetas.plaquetaId, tora.plaquetaId));
        await tx.delete(plaquetas).where(and(eq(plaquetas.id, tora.plaquetaId), eq(plaquetas.empresaId, empresaId)));
        continue;
      }
      await tx.delete(movimentacoesPlaquetas).where(and(
        eq(movimentacoesPlaquetas.plaquetaId, tora.plaquetaId),
        eq(movimentacoesPlaquetas.romaneioId, id),
      ));
      await tx.update(plaquetas).set({
        madeiraNome: tora.madeiraNome,
        diametro: tora.diametro,
        comprimento: tora.comprimento,
        volumeInicial: tora.volume,
        volumeDisponivel: tora.volume,
        estado: "disponivel",
      }).where(and(eq(plaquetas.id, tora.plaquetaId), eq(plaquetas.empresaId, empresaId)));
    }

    for (const lote of lotes) {
      await tx.delete(movimentacoesEstoqueSerrado).where(eq(movimentacoesEstoqueSerrado.loteId, lote.id));
    }
    await tx.delete(lotesPecasSerradas).where(and(eq(lotesPecasSerradas.romaneioId, id), eq(lotesPecasSerradas.empresaId, empresaId)));
    await tx.delete(itensRomaneioProducao).where(and(eq(itensRomaneioProducao.romaneioId, id), eq(itensRomaneioProducao.empresaId, empresaId)));
    await tx.delete(itensRomaneioToras).where(and(eq(itensRomaneioToras.romaneioId, id), eq(itensRomaneioToras.empresaId, empresaId)));
    await tx.delete(romaneiosProducao).where(and(eq(romaneiosProducao.id, id), eq(romaneiosProducao.empresaId, empresaId)));
    return { id, numero: romaneio.numero };
  });
}

export async function getResumoEstoqueSerrado() {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  const lotes = await db.select().from(lotesPecasSerradas).where(eq(lotesPecasSerradas.empresaId, empresaId));
  return agruparEstoquePecas(lotes.filter((lote) => lote.estado !== "cancelado"));
}

export async function getRelatorioInventarioSerrado(dataInicial: Date | undefined, dataFinal: Date | undefined) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return { linhas: [], resumo: { itensAnalisados: 0, itensEmRutura: 0, itensCriticos: 0, pecasEmDeficit: 0, saidasNoPeriodo: 0 }, periodo: { dataInicial: new Date(), dataFinal: new Date(), dias: 1 } };
  const fim = dataFinal ? new Date(dataFinal) : new Date();
  fim.setHours(23, 59, 59, 999);
  const inicio = dataInicial ? new Date(dataInicial) : new Date(fim);
  if (!dataInicial) inicio.setDate(inicio.getDate() - 89);
  inicio.setHours(0, 0, 0, 0);
  const [lotes, movimentos] = await Promise.all([
    db.select().from(lotesPecasSerradas).where(eq(lotesPecasSerradas.empresaId, empresaId)),
    db.select().from(movimentacoesEstoqueSerrado).where(eq(movimentacoesEstoqueSerrado.empresaId, empresaId)),
  ]);
  const movimentosNoPeriodo = movimentos.filter((movimento) => {
    const dataMovimento = new Date(movimento.createdAt).getTime();
    return dataMovimento >= inicio.getTime() && dataMovimento <= fim.getTime();
  });
  const dias = Math.max(1, Math.floor((fim.getTime() - inicio.getTime()) / 86_400_000) + 1);
  return {
    ...calcularRelatorioInventarioSerrado(lotes.filter((lote) => lote.estado !== "cancelado"), movimentosNoPeriodo, dias),
    periodo: { dataInicial: inicio, dataFinal: fim, dias },
  };
}

export async function listAjustesEstoqueSerrado() {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  const [movimentos, lotes, utilizadores] = await Promise.all([
    db.select().from(movimentacoesEstoqueSerrado).where(eq(movimentacoesEstoqueSerrado.empresaId, empresaId)),
    db.select().from(lotesPecasSerradas).where(eq(lotesPecasSerradas.empresaId, empresaId)),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);
  const lotesPorId = new Map(lotes.map((lote) => [lote.id, lote]));
  const utilizadoresPorId = new Map(utilizadores.map((utilizador) => [utilizador.id, utilizador]));
  return movimentos
    .filter((movimento) => movimento.tipo === "ajuste")
    .sort((primeiro, segundo) => new Date(segundo.createdAt).getTime() - new Date(primeiro.createdAt).getTime())
    .slice(0, 30)
    .flatMap((movimento) => {
      const lote = lotesPorId.get(movimento.loteId);
      if (!lote) return [];
      return [{
        id: movimento.id,
        quantidade: movimento.quantidade,
        motivo: movimento.motivo,
        createdAt: movimento.createdAt,
        madeiraNome: lote.madeiraNome,
        espessura: lote.espessura,
        largura: lote.largura,
        comprimento: lote.comprimento,
        utilizador: utilizadoresPorId.get(movimento.criadoPor)?.name ?? `Utilizador #${movimento.criadoPor}`,
      }];
    });
}

export async function ajustarEstoqueSerrado(data: {
  madeiraNome: string;
  espessura: string | number;
  largura: string | number;
  comprimento: string | number;
  quantidadeContada: number;
  motivo: string;
  criadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const quantidadeContada = Number(data.quantidadeContada);
  if (!Number.isInteger(quantidadeContada) || quantidadeContada < 0) throw new Error("Informe uma contagem inteira igual ou superior a zero");
  if (data.motivo.trim().length < 3) throw new Error("Informe o motivo do ajuste de inventário");
  const dimensoes = calcularItemRomaneio({
    madeiraNome: data.madeiraNome,
    espessura: data.espessura,
    largura: data.largura,
    comprimento: data.comprimento,
    quantidade: 1,
  });
  return db.transaction(async (tx: any) => {
    const lotes = await tx.select().from(lotesPecasSerradas);
    const mesmaMedida = (lote: any) => lote.estado !== "cancelado"
      && lote.madeiraNome.trim().toLocaleUpperCase("pt-BR") === dimensoes.madeiraNome.trim().toLocaleUpperCase("pt-BR")
      && Math.abs(Number(lote.espessura) - dimensoes.espessura) < 0.0001
      && Math.abs(Number(lote.largura) - dimensoes.largura) < 0.0001
      && Math.abs(Number(lote.comprimento) - dimensoes.comprimento) < 0.0001;
    const saldoAnterior = lotes.filter(mesmaMedida).reduce((total: number, lote: any) => total + Number(lote.quantidadeDisponivel), 0);
    const variacao = quantidadeContada - saldoAnterior;
    if (!variacao) throw new Error("A contagem informada já corresponde ao saldo atual desta medida");
    const calculoVariacao = calcularItemRomaneio({ ...dimensoes, quantidade: Math.abs(variacao) });
    const insercao = await tx.insert(lotesPecasSerradas).values({
      empresaId: data.empresaId,
      romaneioId: null,
      itemRomaneioId: null,
      madeiraNome: calculoVariacao.madeiraNome,
      espessura: calculoVariacao.espessura.toFixed(2),
      largura: calculoVariacao.largura.toFixed(2),
      comprimento: calculoVariacao.comprimento.toFixed(2),
      quantidadeProduzida: Math.max(variacao, 0),
      quantidadeDisponivel: variacao,
      metrosLineares: calculoVariacao.metrosLineares.toFixed(4),
      volume: calculoVariacao.volume.toFixed(6),
      estado: variacao < 0 ? "negativo" : "disponivel",
    });
    const loteId = getInsertedId(insercao as MysqlInsertResult);
    await tx.insert(movimentacoesEstoqueSerrado).values({
      empresaId: data.empresaId,
      loteId,
      tipo: "ajuste",
      quantidade: variacao,
      motivo: `Inventário: ${data.motivo.trim()} | saldo anterior: ${saldoAnterior}; contagem: ${quantidadeContada}`,
      criadoPor: data.criadoPor,
    });
    return { success: true, saldoAnterior, quantidadeContada, variacao, loteId };
  });
}

export type DadosEntregaFisica = {
  entregueEm: Date;
  modalidadeEntrega: "retirada" | "entrega";
  observacoesEntrega?: string | null;
  responsavelEntrega: string;
  aproveitamentos?: Array<{ madeiraNome: string; volume: string }>;
};

export async function entregarVendaFisicamente(vendaId: number, userId: number, dadosEntrega: DadosEntregaFisica, dependencias?: { database?: any }) {
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx: any) => {
    const venda = (await tx.select().from(orcamentos).where(eq(orcamentos.id, vendaId)).limit(1))[0];
    if (!venda) throw new Error("Venda não encontrada");
    if (venda.estado !== "aprovado") throw new Error("Somente vendas aprovadas podem ser entregues");
    if (venda.entregue) throw new Error("Esta venda já possui entrega física registrada");

    const [itens, lotes] = await Promise.all([
      tx.select().from(itensOrcamento).where(eq(itensOrcamento.orcamentoId, vendaId)),
      tx.select().from(lotesPecasSerradas).where(and(eq(lotesPecasSerradas.empresaId, venda.empresaId), eq(lotesPecasSerradas.propriedade, "proprio"))),
    ]);
    const itensParaEstoque = itens
      .filter((item: any) => (item.tipoComercializacao ?? "metro_cubico") === "metro_cubico" && Number(item.quantidade) > 0)
      .map((item: any) => converterDimensoesVendaParaEstoque({
        ...item,
        quantidade: Number(item.quantidade),
      }));
    const { alocacoes, deficits } = alocarPecasPermitindoNegativo(itensParaEstoque, lotes);
    const lotesPorId = new Map<number, any>(lotes.map((lote: any) => [lote.id, lote] as [number, any]));
    const movimentacoes: Array<{ itemVendaId?: number; loteId: number; quantidade: number; volume?: number }> = [];
    for (const alocacao of alocacoes) {
      const lote = lotesPorId.get(alocacao.loteId);
      if (!lote) throw new Error("Lote de peças não encontrado durante a entrega");
      const saldo = Number(lote.quantidadeDisponivel) - alocacao.quantidade;
      if (saldo < 0) throw new Error("O saldo do lote foi alterado durante a confirmação. Revise o estoque e tente novamente.");
      await tx.update(lotesPecasSerradas).set({ quantidadeDisponivel: saldo, estado: saldo === 0 ? "esgotado" : "disponivel" }).where(eq(lotesPecasSerradas.id, lote.id));
      await tx.insert(movimentacoesEstoqueSerrado).values({
        empresaId: venda.empresaId,
        loteId: lote.id,
        itemVendaId: alocacao.itemVendaId,
        orcamentoId: vendaId,
        tipo: "saida_entrega",
        quantidade: alocacao.quantidade,
        volume: "0",
        motivo: `Entrega física da venda ${venda.numero ?? venda.id}`,
        criadoPor: userId,
      });
      movimentacoes.push(alocacao);
    }
    for (const deficit of deficits) {
      const dimensoes = calcularItemRomaneio({
        madeiraNome: deficit.madeiraNome,
        espessura: deficit.espessura,
        largura: deficit.largura,
        comprimento: deficit.comprimento,
        quantidade: deficit.quantidade,
      });
      const insercao = await tx.insert(lotesPecasSerradas).values({
        empresaId: venda.empresaId,
        romaneioId: null,
        itemRomaneioId: null,
        madeiraNome: dimensoes.madeiraNome,
        espessura: dimensoes.espessura.toFixed(2),
        largura: dimensoes.largura.toFixed(2),
        comprimento: dimensoes.comprimento.toFixed(2),
        quantidadeProduzida: 0,
        quantidadeDisponivel: -dimensoes.quantidade,
        metrosLineares: dimensoes.metrosLineares.toFixed(4),
        volume: dimensoes.volume.toFixed(6),
        estado: "negativo",
      });
      const loteId = getInsertedId(insercao as MysqlInsertResult);
      await tx.insert(movimentacoesEstoqueSerrado).values({
        empresaId: venda.empresaId,
        loteId,
        itemVendaId: deficit.itemVendaId,
        orcamentoId: vendaId,
        tipo: "saida_entrega",
        quantidade: deficit.quantidade,
        volume: "0",
        motivo: `Entrega física sem saldo da venda ${venda.numero ?? venda.id}`,
        criadoPor: userId,
      });
      movimentacoes.push({ itemVendaId: deficit.itemVendaId, loteId, quantidade: deficit.quantidade });
    }
    const aproveitamentosSolicitados = new Map<string, number>();
    for (const aproveitamento of dadosEntrega.aproveitamentos ?? []) {
      const essencia = aproveitamento.madeiraNome.trim().toLocaleUpperCase("pt-BR");
      aproveitamentosSolicitados.set(essencia, Number(((aproveitamentosSolicitados.get(essencia) ?? 0) + Number(aproveitamento.volume)).toFixed(6)));
    }
    let aproveitamentoEntregue = 0;
    let aproveitamentoSemEstoque = 0;
    for (const [essencia, volumeSolicitado] of Array.from(aproveitamentosSolicitados.entries())) {
      let restante = volumeSolicitado;
      const lotesAproveitamento = lotes
        .filter((lote: any) => lote.tipo === "aproveitamento" && lote.madeiraNome.trim().toLocaleUpperCase("pt-BR") === `APROVEITAMENTO DE ${essencia}`)
        .sort((a: any, b: any) => a.id - b.id);
      for (const lote of lotesAproveitamento) {
        if (restante <= 0) break;
        const saldoVolume = Math.max(0, Number(lote.volume));
        const volumeBaixado = Math.min(saldoVolume, restante);
        if (volumeBaixado <= 0) continue;
        const novoVolume = Number((saldoVolume - volumeBaixado).toFixed(6));
        await tx.update(lotesPecasSerradas).set({
          volume: novoVolume.toFixed(6),
          quantidadeDisponivel: novoVolume > 0 ? 1 : 0,
          estado: novoVolume > 0 ? "disponivel" : "esgotado",
        }).where(eq(lotesPecasSerradas.id, lote.id));
        await tx.insert(movimentacoesEstoqueSerrado).values({
          empresaId: venda.empresaId,
          loteId: lote.id,
          orcamentoId: vendaId,
          tipo: "saida_entrega",
          quantidade: 0,
          volume: volumeBaixado.toFixed(6),
          motivo: `Aproveitamento de ${essencia} entregue na venda ${venda.numero ?? venda.id}`,
          criadoPor: userId,
        });
        movimentacoes.push({ loteId: lote.id, quantidade: 0, volume: volumeBaixado });
        aproveitamentoEntregue += volumeBaixado;
        restante = Number((restante - volumeBaixado).toFixed(6));
      }
      if (restante > 0) {
        const insercao = await tx.insert(lotesPecasSerradas).values({
          empresaId: venda.empresaId,
          romaneioId: null,
          itemRomaneioId: null,
          madeiraNome: `Aproveitamento de ${essencia}`,
          espessura: "0",
          largura: "0",
          comprimento: "0",
          quantidadeProduzida: 0,
          quantidadeDisponivel: -1,
          metrosLineares: "0",
          volume: (-restante).toFixed(6),
          tipo: "aproveitamento",
          propriedade: "proprio",
          estado: "negativo",
        });
        const loteId = getInsertedId(insercao as MysqlInsertResult);
        await tx.insert(movimentacoesEstoqueSerrado).values({
          empresaId: venda.empresaId,
          loteId,
          orcamentoId: vendaId,
          tipo: "saida_entrega",
          quantidade: 0,
          volume: restante.toFixed(6),
          motivo: `Aproveitamento de ${essencia} entregue sem saldo na venda ${venda.numero ?? venda.id}`,
          criadoPor: userId,
        });
        movimentacoes.push({ loteId, quantidade: 0, volume: restante });
        aproveitamentoEntregue += restante;
        aproveitamentoSemEstoque += restante;
      }
    }
    const entregueEm = dadosEntrega.entregueEm;
    const observacoesEntrega = dadosEntrega.observacoesEntrega?.trim() || null;
    const responsavelEntrega = dadosEntrega.responsavelEntrega.trim();
    await tx.update(orcamentos).set({
      entregue: true,
      entregueEm,
      entreguePor: userId,
      modalidadeEntrega: dadosEntrega.modalidadeEntrega,
      observacoesEntrega,
      responsavelEntrega,
    }).where(eq(orcamentos.id, vendaId));
    await tx.insert(historicoAlteracoes).values({
      empresaId: venda.empresaId,
      orcamentoId: vendaId,
      usuarioId: userId,
      tipo: "alteracao" as any,
      detalhes: JSON.stringify({
        acao: "entrega_fisica_confirmada",
        entregueEm: entregueEm.toISOString(),
        modalidadeEntrega: dadosEntrega.modalidadeEntrega,
        responsavelEntrega,
        observacoesEntrega,
        alocacoes: movimentacoes,
      }),
    });
    return { success: true, entregueEm, pecasEntregues: movimentacoes.reduce((total, alocacao) => total + alocacao.quantidade, 0), pecasSemEstoque: deficits.reduce((total, deficit) => total + deficit.quantidade, 0), aproveitamentoEntregue: Number(aproveitamentoEntregue.toFixed(6)), aproveitamentoSemEstoque: Number(aproveitamentoSemEstoque.toFixed(6)) };
  });
}

export async function estornarEntregaVenda(vendaId: number, userId: number, motivo: string, dependencias?: { database?: any }) {
  const db = dependencias?.database ?? await getDb();
  if (!db) throw new Error("Database not available");
  if (motivo.trim().length < 3) throw new Error("Informe o motivo do estorno da entrega");
  return db.transaction(async (tx: any) => {
    const venda = (await tx.select().from(orcamentos).where(eq(orcamentos.id, vendaId)).limit(1))[0];
    if (!venda?.entregue) throw new Error("Esta venda não possui entrega física para estornar");
    const itens = await tx.select({ id: itensOrcamento.id }).from(itensOrcamento).where(eq(itensOrcamento.orcamentoId, vendaId));
    const idsItens = new Set(itens.map((item: any) => item.id));
    const saidas = (await tx.select().from(movimentacoesEstoqueSerrado)).filter((movimento: any) => movimento.tipo === "saida_entrega" && (movimento.orcamentoId === vendaId || (movimento.itemVendaId && idsItens.has(movimento.itemVendaId))));
    if (!saidas.length) throw new Error("Não foram encontradas peças baixadas para esta entrega");
    const lotes = await tx.select().from(lotesPecasSerradas);
    const lotesPorId = new Map<number, any>(lotes.map((lote: any) => [lote.id, lote] as [number, any]));
    for (const saida of saidas) {
      const lote = lotesPorId.get(saida.loteId);
      if (!lote) throw new Error("Lote de peças não encontrado durante o estorno");
      const volumeSaida = Number(saida.volume ?? 0);
      const saldo = Number(lote.quantidadeDisponivel) + saida.quantidade;
      const volumeRestaurado = Number((Number(lote.volume) + volumeSaida).toFixed(6));
      const saldoAtualizado = volumeSaida > 0 ? (volumeRestaurado === 0 ? 0 : volumeRestaurado < 0 ? -1 : 1) : saldo;
      await tx.update(lotesPecasSerradas).set({ quantidadeDisponivel: saldoAtualizado, volume: volumeSaida > 0 ? volumeRestaurado.toFixed(6) : lote.volume, estado: saldoAtualizado === 0 ? "esgotado" : saldoAtualizado < 0 ? "negativo" : "disponivel" }).where(eq(lotesPecasSerradas.id, lote.id));
      await tx.insert(movimentacoesEstoqueSerrado).values({ empresaId: venda.empresaId, loteId: lote.id, itemVendaId: saida.itemVendaId, orcamentoId: vendaId, tipo: "estorno_entrega", quantidade: saida.quantidade, volume: volumeSaida.toFixed(6), motivo: motivo.trim(), criadoPor: userId });
    }
    await tx.update(orcamentos).set({
      entregue: false,
      entregueEm: null,
      entreguePor: null,
      modalidadeEntrega: null,
      observacoesEntrega: null,
      responsavelEntrega: null,
    }).where(eq(orcamentos.id, vendaId));
    await tx.insert(historicoAlteracoes).values({ empresaId: venda.empresaId, orcamentoId: vendaId, usuarioId: userId, tipo: "alteracao" as any, detalhes: JSON.stringify({ acao: "entrega_fisica_estornada", motivo: motivo.trim() }) });
    return { success: true, pecasDevolvidas: saidas.reduce((total: number, saida: any) => total + saida.quantidade, 0) };
  });
}
