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
import { garantirTituloFinanceiroAutomatico, getOrCreateCategoriaCustoMateriaPrima } from "./financeiro";
import { formatarNumeroDocumentoPadronizado, reservarProximoNumeroDocumento } from "./documentos";
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

// ─── Produção e estoque de madeira serrada ───
export function ordenarPlaquetasPorEntradaMaisRecente<T extends { createdAt: Date | string | null; id: number }>(itens: T[]) {
  return [...itens].sort((primeira, segunda) => {
    const primeiraData = primeira.createdAt ? new Date(primeira.createdAt).getTime() : 0;
    const segundaData = segunda.createdAt ? new Date(segunda.createdAt).getTime() : 0;
    return segundaData - primeiraData || segunda.id - primeira.id;
  });
}

export async function getPlaquetaDisponivelPorCodigo(codigoInformado: string) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  const codigo = normalizarCodigoPlaqueta(codigoInformado);
  if (!db || !codigo) return null;

  const candidatas = ordenarPlaquetasPorEntradaMaisRecente(
    await db
      .select()
      .from(plaquetas)
      .where(
        and(
          eq(plaquetas.empresaId, empresaId),
          or(eq(plaquetas.codigo, codigo), eq(plaquetas.codigoFisico, codigo))
        )
      )
      .orderBy(desc(plaquetas.createdAt), desc(plaquetas.id))
  );
  return candidatas.find(item => item.estado === "disponivel") ?? null;
}

/**
 * Lista somente as toras sem identificação física que ainda pertencem ao
 * estoque. A produção deve consumir uma destas plaquetas, nunca criar uma
 * segunda identificação interna para a mesma tora.
 */
export async function listPlaquetasSemIdentificacaoDisponiveis() {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];

  return ordenarPlaquetasPorEntradaMaisRecente(
    await db
      .select({
        id: plaquetas.id,
        codigo: plaquetas.codigo,
        madeiraNome: plaquetas.madeiraNome,
        diametro: plaquetas.diametro,
        comprimento: plaquetas.comprimento,
        volumeInicial: plaquetas.volumeInicial,
        volumeDisponivel: plaquetas.volumeDisponivel,
        dataEntrada: plaquetas.dataEntrada,
        origem: plaquetas.origem,
        createdAt: plaquetas.createdAt,
      })
      .from(plaquetas)
      .where(
        and(
          eq(plaquetas.empresaId, empresaId),
          eq(plaquetas.estado, "disponivel"),
          eq(plaquetas.situacaoIdentificacao, "sem_plaqueta")
        )
      )
      .orderBy(desc(plaquetas.createdAt), desc(plaquetas.id))
  );
}

/** Retorna somente vínculos já existentes, sem inferir ou reconstituir origem. */
export async function getRastreabilidadePlaqueta(plaquetaId: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return null;

  const plaqueta = (
    await db
      .select({
        id: plaquetas.id,
        codigo: plaquetas.codigo,
        codigoFisico: plaquetas.codigoFisico,
        situacaoIdentificacao: plaquetas.situacaoIdentificacao,
        madeiraNome: plaquetas.madeiraNome,
        diametro: plaquetas.diametro,
        comprimento: plaquetas.comprimento,
        volumeInicial: plaquetas.volumeInicial,
        volumeDisponivel: plaquetas.volumeDisponivel,
        estado: plaquetas.estado,
        origemDeclarada: plaquetas.origem,
        romaneioCargaId: plaquetas.romaneioCargaId,
        dataEntrada: plaquetas.dataEntrada,
      })
      .from(plaquetas)
      .where(and(eq(plaquetas.id, plaquetaId), eq(plaquetas.empresaId, empresaId)))
      .limit(1)
  )[0];
  if (!plaqueta) return null;

  const [carga, consumo, regularizacoes] = await Promise.all([
    plaqueta.romaneioCargaId
      ? db
          .select({ id: romaneiosCargaToras.id, numero: romaneiosCargaToras.numero, data: romaneiosCargaToras.dataCarga })
          .from(romaneiosCargaToras)
          .where(and(eq(romaneiosCargaToras.id, plaqueta.romaneioCargaId), eq(romaneiosCargaToras.empresaId, empresaId)))
          .limit(1)
      : Promise.resolve([]),
    db
      .select({
        id: romaneiosProducao.id,
        numero: romaneiosProducao.numero,
        data: romaneiosProducao.dataProducao,
        volumeConsumido: itensRomaneioToras.volume,
      })
      .from(itensRomaneioToras)
      .innerJoin(romaneiosProducao, and(eq(romaneiosProducao.id, itensRomaneioToras.romaneioId), eq(romaneiosProducao.empresaId, empresaId)))
      .where(and(eq(itensRomaneioToras.plaquetaId, plaqueta.id), eq(itensRomaneioToras.empresaId, empresaId)))
      .limit(1),
    db.select({
      id: regularizacoesVolumePlaquetas.id,
      volumeAnterior: regularizacoesVolumePlaquetas.volumeAnterior,
      volumeConfirmado: regularizacoesVolumePlaquetas.volumeConfirmado,
      justificativa: regularizacoesVolumePlaquetas.justificativa,
      criadoPor: regularizacoesVolumePlaquetas.criadoPor,
      createdAt: regularizacoesVolumePlaquetas.createdAt,
    }).from(regularizacoesVolumePlaquetas)
      .where(and(eq(regularizacoesVolumePlaquetas.plaquetaId, plaqueta.id), eq(regularizacoesVolumePlaquetas.empresaId, empresaId)))
      .orderBy(desc(regularizacoesVolumePlaquetas.createdAt)),
  ]);

  const origem = carga[0]
    ? { tipo: "romaneio_carga" as const, id: carga[0].id, numero: carga[0].numero, data: carga[0].data }
    : consumo[0]
      ? { tipo: "romaneio_producao" as const, id: consumo[0].id, numero: consumo[0].numero, data: consumo[0].data }
      : null;

  return { plaqueta, origem, consumo: consumo[0] ?? null, regularizacoes };
}

export async function listPlaquetas(parametros: { busca?: string; estado?: "disponivel" | "consumida" | "cancelada"; limite?: number; deslocamento?: number } = {}) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return { itens: [], total: 0, totalDisponiveis: 0, totalVolumeDisponivel: 0, volumeMedioPorTora: 0, essenciasDisponiveis: [], alertaVariacaoAtipica: false, essenciasAtipicas: [], variacoesAtipicas: [], proximoDeslocamento: null };
  const brutas = ordenarPlaquetasPorEntradaMaisRecente(await db.select().from(plaquetas).where(eq(plaquetas.empresaId, empresaId)).orderBy(desc(plaquetas.createdAt), desc(plaquetas.id)));
  const todas = numerarDuplicidadesPlaquetas(brutas);
  const termo = (parametros.busca ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const porBusca = termo ? todas.filter((item) => {
    const codigo = `${item.codigo} ${item.codigoFisico ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    const essencia = item.madeiraNome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    return codigo.includes(termo) || essencia.includes(termo);
  }) : todas;
  const filtradas = parametros.estado ? porBusca.filter((item) => item.estado === parametros.estado) : porBusca;
  const limite = Math.min(Math.max(parametros.limite ?? 10, 1), 500);
  const deslocamento = Math.max(parametros.deslocamento ?? 0, 0);
  const itens = filtradas.slice(deslocamento, deslocamento + limite);
  const proximoDeslocamento = deslocamento + itens.length < filtradas.length ? deslocamento + itens.length : null;
  const disponiveis = todas.filter((item) => item.estado === "disponivel");
  const totalVolumeDisponivel = disponiveis.reduce((total, item) => total + Number(item.volumeDisponivel ?? 0), 0);
  const volumeMedioPorTora = disponiveis.length > 0 ? totalVolumeDisponivel / disponiveis.length : 0;
  const essenciasMap = new Map<string, { quantidade: number; volume: number }>();
  for (const item of disponiveis) {
    const essencia = String(item.madeiraNome ?? "").trim().toLocaleUpperCase("pt-BR") || "SEM ESSÊNCIA";
    const atual = essenciasMap.get(essencia) ?? { quantidade: 0, volume: 0 };
    atual.quantidade += 1;
    atual.volume += Number(item.volumeDisponivel ?? 0);
    essenciasMap.set(essencia, atual);
  }
  const essenciasDisponiveis = Array.from(essenciasMap.entries())
    .map(([essencia, dados]) => ({
      essencia,
      quantidade: dados.quantidade,
      volume: Number(dados.volume.toFixed(3)),
      volumeMedio: Number((dados.volume / dados.quantidade).toFixed(3)),
    }))
    .sort((primeira, segunda) => segunda.volume - primeira.volume || primeira.essencia.localeCompare(segunda.essencia, "pt-BR"));
  const limiarAlerta = 3;
  const variacoesIdentificadas = volumeMedioPorTora > 0
    ? essenciasDisponiveis
      .filter((item) => item.volumeMedio > limiarAlerta * volumeMedioPorTora)
      .map((item) => ({
        essencia: item.essencia,
        assinatura: `${item.essencia}|${item.quantidade}|${item.volume.toFixed(3)}|${item.volumeMedio.toFixed(3)}|${volumeMedioPorTora.toFixed(3)}`,
      }))
    : [];
  const conferencias = variacoesIdentificadas.length > 0
    ? await db.select({ essencia: conferenciasVariacaoPlaquetas.essencia, assinatura: conferenciasVariacaoPlaquetas.assinatura })
      .from(conferenciasVariacaoPlaquetas)
      .where(eq(conferenciasVariacaoPlaquetas.empresaId, empresaId))
    : [];
  const assinaturasConferidas = new Map(conferencias.map((item) => [item.essencia, item.assinatura]));
  const variacoesAtipicas = variacoesIdentificadas.filter((item) => assinaturasConferidas.get(item.essencia) !== item.assinatura);
  const essenciasAtipicas = variacoesAtipicas.map((item) => item.essencia);
  const alertaVariacaoAtipica = variacoesAtipicas.length > 0;
  return { itens, total: filtradas.length, totalDisponiveis: disponiveis.length, totalVolumeDisponivel, volumeMedioPorTora: Number(volumeMedioPorTora.toFixed(3)), essenciasDisponiveis, alertaVariacaoAtipica, essenciasAtipicas, variacoesAtipicas, proximoDeslocamento };
}

export async function confirmarVariacoesAtipicasPlaquetas(variacoes: Array<{ essencia: string; assinatura: string }>, confirmadoPor: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const registros = variacoes
    .map((item) => ({ essencia: item.essencia.trim().toLocaleUpperCase("pt-BR"), assinatura: item.assinatura.trim() }))
    .filter((item) => item.essencia.length > 0 && item.assinatura.length > 0);
  if (registros.length === 0) return { confirmadas: 0 };
  const confirmadoEm = new Date();
  for (const registro of registros) {
    await db.insert(conferenciasVariacaoPlaquetas).values({
      empresaId,
      essencia: registro.essencia,
      assinatura: registro.assinatura,
      confirmadoPor,
      confirmadoEm,
    }).onDuplicateKeyUpdate({ set: { assinatura: registro.assinatura, confirmadoPor, confirmadoEm } });
  }
  return { confirmadas: registros.length };
}

export async function getRelatorioExcecoesPlaquetas(parametros: { busca?: string; situacao?: "todas" | "duplicada" | "sem_plaqueta"; somenteDisponiveis?: boolean } = {}) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return { resumo: { duplicadas: 0, semPlaqueta: 0, pendentesConferencia: 0, disponiveis: 0 }, itens: [] };
  const brutas = await db.select().from(plaquetas).where(eq(plaquetas.empresaId, empresaId)).orderBy(desc(plaquetas.createdAt), desc(plaquetas.id));
  const numeradas = numerarDuplicidadesPlaquetas(brutas);
  const termo = (parametros.busca ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const excecoes = numeradas.filter((item) => item.situacaoIdentificacao !== "identificada");
  const itens = excecoes.filter((item) => {
    if (parametros.situacao && parametros.situacao !== "todas" && item.situacaoIdentificacao !== parametros.situacao) return false;
    if (parametros.somenteDisponiveis && item.estado !== "disponivel") return false;
    if (!termo) return true;
    const pesquisavel = `${item.codigo} ${item.codigoFisico ?? ""} ${item.madeiraNome}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
    return pesquisavel.includes(termo);
  });
  return {
    resumo: {
      duplicadas: excecoes.filter((item) => item.situacaoIdentificacao === "duplicada").length,
      semPlaqueta: excecoes.filter((item) => item.situacaoIdentificacao === "sem_plaqueta").length,
      pendentesConferencia: excecoes.filter((item) => item.situacaoIdentificacao === "duplicada" && item.estado === "disponivel").length,
      disponiveis: excecoes.filter((item) => item.estado === "disponivel").length,
    },
    itens,
  };
}

export function getModeloImportacaoTorasProducaoCsv() {
  return criarModeloCsvTorasProducao();
}

export function getModeloImportacaoPecasProducaoCsv() {
  return criarModeloCsvPecasProducao();
}

export function prepararPecasProducaoCsv(conteudo: string) {
  return validarCsvPecasProducao(conteudo);
}

export function getModeloImportacaoTorasSerragemTerceirosCsv() {
  return criarModeloCsvTorasSerragemTerceiros();
}

export function prepararTorasSerragemTerceirosCsv(conteudo: string) {
  return validarCsvTorasSerragemTerceiros(conteudo);
}

export async function prepararTorasProducaoCsv(conteudo: string) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const estoque = await db.select({
    id: plaquetas.id,
    codigo: plaquetas.codigo,
    estado: plaquetas.estado,
    madeiraNome: plaquetas.madeiraNome,
    diametro: plaquetas.diametro,
    comprimento: plaquetas.comprimento,
    volumeDisponivel: plaquetas.volumeDisponivel,
  }).from(plaquetas).where(eq(plaquetas.empresaId, empresaId));
  return prepararImportacaoTorasProducao({ conteudo, plaquetas: estoque });
}

export async function listRomaneiosCargaToras(filtros: { dataInicial?: Date; dataFinal?: Date; origem?: string } = {}) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  const origem = filtros.origem?.trim().toLocaleLowerCase("pt-BR");
  const condicoes = [
    eq(romaneiosCargaToras.empresaId, empresaId),
    filtros.dataInicial ? gte(romaneiosCargaToras.dataCarga, filtros.dataInicial) : undefined,
    filtros.dataFinal ? lte(romaneiosCargaToras.dataCarga, filtros.dataFinal) : undefined,
  ];
  const resultado = await db.select().from(romaneiosCargaToras).where(and(...condicoes)).orderBy(desc(romaneiosCargaToras.dataCarga), desc(romaneiosCargaToras.id));
  return origem ? resultado.filter((item) => (item.origem ?? "").toLocaleLowerCase("pt-BR").includes(origem)) : resultado;
}

export async function getRomaneioCargaComPlaquetas(id: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return undefined;
  const carga = await db.select().from(romaneiosCargaToras).where(and(eq(romaneiosCargaToras.id, id), eq(romaneiosCargaToras.empresaId, empresaId))).limit(1);
  if (!carga[0]) return undefined;
  const itens = await db.select().from(plaquetas).where(and(eq(plaquetas.romaneioCargaId, id), eq(plaquetas.empresaId, empresaId))).orderBy(asc(plaquetas.id));
  const todas = await db.select().from(plaquetas).where(eq(plaquetas.empresaId, empresaId));
  const numeradas = numerarDuplicidadesPlaquetas(todas);
  const identificacaoPorId = new Map(numeradas.map((item) => [item.id, item]));
  return { carga: carga[0], plaquetas: itens.map((item) => ({ ...item, ...identificacaoPorId.get(item.id) })) };
}

export function getModeloImportacaoPlaquetasCargaCsv() {
  return criarModeloCsvPlaquetasCarga();
}

export async function importarPlaquetasCargaCsv(
  input: { conteudo: string; dataCarga: Date; dataVencimento: Date; origem?: string | null; fornecedorId?: number | null; responsavel?: string | null; observacoes?: string | null; fretePorMetroCubico: string },
  criadoPor: number,
) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const codigosExistentes = await db.select({ codigo: plaquetas.codigo }).from(plaquetas).where(eq(plaquetas.empresaId, empresaId));
  const preparo = prepararImportacaoPlaquetasCarga({ conteudo: input.conteudo, codigosExistentes });
  if (preparo.erros.length) return { importados: 0, erros: preparo.erros, avisos: preparo.avisos, numero: null as string | null };
  const carga = await criarRomaneioCargaToras({
    dataCarga: input.dataCarga,
    dataVencimento: input.dataVencimento,
    origem: input.origem ?? null,
    fornecedorId: input.fornecedorId ?? null,
    responsavel: input.responsavel ?? null,
    observacoes: input.observacoes ?? null,
    fretePorMetroCubico: input.fretePorMetroCubico,
    plaquetas: preparo.linhas.map(({ codigo, madeiraNome, diametro, comprimento, valorMetroCubico, observacoes }) => ({ codigo, madeiraNome, diametro, comprimento, valorMetroCubico, observacoes })),
    criadoPor,
    empresaId,
  });
  return { importados: preparo.linhas.length, erros: [] as string[], avisos: preparo.avisos, numero: carga.numero };
}

type PlaquetaCargaEntrada = { codigo?: string | null; madeiraNome: string; diametro: string; comprimento: string; valorMetroCubico: string; observacoes?: string | null };

type SituacaoIdentificacaoPlaqueta = "identificada" | "sem_plaqueta" | "duplicada";

function gerarCodigoInternoPlaqueta() {
  return `INT-${crypto.randomUUID().replaceAll("-", "").slice(0, 20).toUpperCase()}`;
}

export async function prepararIdentificacaoPlaqueta(tx: any, codigoInformado: string | null | undefined): Promise<{ codigo: string; codigoFisico: string | null; situacaoIdentificacao: SituacaoIdentificacaoPlaqueta }> {
  const empresaId = (await getEmpresaUnica()).id;
  const codigoFisico = normalizarCodigoPlaqueta(codigoInformado ?? "") || null;
  if (!codigoFisico) {
    return { codigo: `SEM-PLQ-${gerarCodigoInternoPlaqueta().slice(4)}`, codigoFisico: null, situacaoIdentificacao: "sem_plaqueta" };
  }

  const mesmoCodigoFisico = or(eq(plaquetas.codigo, codigoFisico), eq(plaquetas.codigoFisico, codigoFisico));
  const existentes = await tx.select({ id: plaquetas.id }).from(plaquetas).where(and(mesmoCodigoFisico, eq(plaquetas.empresaId, empresaId)));
  if (!existentes.length) return { codigo: codigoFisico, codigoFisico, situacaoIdentificacao: "identificada" };

  await tx.update(plaquetas).set({ codigoFisico, situacaoIdentificacao: "duplicada" }).where(and(mesmoCodigoFisico, eq(plaquetas.empresaId, empresaId)));
  return { codigo: gerarCodigoInternoPlaqueta(), codigoFisico, situacaoIdentificacao: "duplicada" };
}

function prepararPlaquetasCarga(entrada: PlaquetaCargaEntrada[]) {
  if (!entrada.length) throw new Error("Adicione ao menos uma plaqueta ao romaneio de carga");
  if (entrada.length > 200) throw new Error("O romaneio de carga suporta no máximo 200 plaquetas");
  return entrada.map((plaqueta, indice) => {
    const codigoFisico = normalizarCodigoPlaqueta(plaqueta.codigo ?? "") || null;
    const referencia = codigoFisico ?? `sem plaqueta na linha ${indice + 1}`;
    const madeiraNome = plaqueta.madeiraNome.trim();
    if (!madeiraNome) throw new Error(`Informe a essência da tora ${referencia}`);
    const diametro = Number(String(plaqueta.diametro).replace(",", "."));
    const comprimento = Number(String(plaqueta.comprimento).replace(",", "."));
    const valorMetroCubico = Number(String(plaqueta.valorMetroCubico).replace(",", "."));
    const volume = calcularVolumeToraCilindrica(diametro, comprimento);
    if (!Number.isFinite(valorMetroCubico) || valorMetroCubico <= 0) throw new Error(`Informe o valor por m³ da tora ${referencia}`);
    return { codigoFisico, madeiraNome, diametro, comprimento, volume, valorMetroCubico, valorTotal: Number((volume * valorMetroCubico).toFixed(2)), observacoes: plaqueta.observacoes?.trim() || null };
  });
}

export function normalizarFreteCarga(valor: string) {
  const fretePorMetroCubico = Number(String(valor ?? "0").replace(",", "."));
  if (!Number.isFinite(fretePorMetroCubico) || fretePorMetroCubico < 0) throw new Error("Informe um frete por m³ válido");
  return fretePorMetroCubico;
}

export async function criarRomaneioCargaToras(data: {
  dataCarga: Date;
  dataVencimento: Date;
  origem?: string | null;
  fornecedorId?: number | null;
  centroCustoId?: number | null;
  responsavel?: string | null;
  observacoes?: string | null;
  fretePorMetroCubico: string;
  plaquetas: PlaquetaCargaEntrada[];
  criadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const plaquetasPreparadas = prepararPlaquetasCarga(data.plaquetas);
  const volumeTotal = plaquetasPreparadas.reduce((total, plaqueta) => total + plaqueta.volume, 0);
  const valorProdutos = plaquetasPreparadas.reduce((total, plaqueta) => total + plaqueta.valorTotal, 0);
  const fretePorMetroCubico = normalizarFreteCarga(data.fretePorMetroCubico);
  const frete = Number((volumeTotal * fretePorMetroCubico).toFixed(2));
  const valorTotal = valorProdutos + frete;
  return db.transaction(async (tx: any) => {
    if (data.centroCustoId) await obterCentroCustoAtivo(data.centroCustoId, tx, data.empresaId);
    const temporario = `TMP-${crypto.randomUUID().slice(0, 20)}`;
    const insercao = await tx.insert(romaneiosCargaToras).values({
      numero: temporario,
      dataCarga: data.dataCarga,
      dataVencimento: data.dataVencimento,
      origem: data.origem?.trim() || null,
      fornecedorId: data.fornecedorId ?? null,
      centroCustoId: data.centroCustoId ?? null,
      responsavel: data.responsavel?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
      totalPlaquetas: plaquetasPreparadas.length,
      volumeTotal: volumeTotal.toFixed(6),
      valorProdutos: valorProdutos.toFixed(2),
      fretePorMetroCubico: fretePorMetroCubico.toFixed(2),
      frete: frete.toFixed(2),
      valorTotal: valorTotal.toFixed(2),
      criadoPor: data.criadoPor,
      empresaId: data.empresaId,
    });
    const id = getInsertedId(insercao as MysqlInsertResult);
    const sequencia = await reservarProximoNumeroDocumento(tx, "romaneio_entrada");
    const numero = formatarNumeroDocumentoPadronizado("romaneio_entrada", sequencia);
    await tx.update(romaneiosCargaToras).set({ numero }).where(eq(romaneiosCargaToras.id, id));
    await sincronizarTituloMateriaPrimaCarga(tx, {
      romaneioId: id,
      numero,
      dataCarga: data.dataCarga,
      dataVencimento: data.dataVencimento,
      origem: data.origem,
      fornecedorId: data.fornecedorId,
      centroCustoId: data.centroCustoId,
      observacoes: data.observacoes,
      valorTotal,
      criadoPor: data.criadoPor,
      empresaId: data.empresaId,
    });
    for (const plaqueta of plaquetasPreparadas) {
      const identificacao = await prepararIdentificacaoPlaqueta(tx, plaqueta.codigoFisico);
      const insercaoPlaqueta = await tx.insert(plaquetas).values({
        ...identificacao,
        madeiraNome: plaqueta.madeiraNome,
        comprimento: plaqueta.comprimento.toFixed(2),
        diametro: plaqueta.diametro.toFixed(2),
        volumeInicial: plaqueta.volume.toFixed(6),
        volumeDisponivel: plaqueta.volume.toFixed(6),
        valorMetroCubico: plaqueta.valorMetroCubico.toFixed(2),
        valorTotal: plaqueta.valorTotal.toFixed(2),
        dataEntrada: data.dataCarga,
        romaneioCargaId: id,
        origem: data.origem?.trim() || null,
        observacoes: plaqueta.observacoes,
        estado: "disponivel",
        criadoPor: data.criadoPor,
        empresaId: data.empresaId,
      });
      const plaquetaId = getInsertedId(insercaoPlaqueta as MysqlInsertResult);
      await tx.insert(movimentacoesPlaquetas).values({ empresaId: data.empresaId, plaquetaId, tipo: "entrada", volume: plaqueta.volume.toFixed(6), motivo: `Entrada pelo romaneio ${numero}`, criadoPor: data.criadoPor });
    }
    return { id, numero, totalPlaquetas: plaquetasPreparadas.length, volumeTotal, valorProdutos, fretePorMetroCubico, frete, valorTotal };
  });
}

export async function atualizarRomaneioCargaToras(id: number, data: {
  dataCarga: Date;
  dataVencimento: Date;
  origem?: string | null;
  fornecedorId?: number | null;
  centroCustoId?: number | null;
  responsavel?: string | null;
  observacoes?: string | null;
  fretePorMetroCubico: string;
  plaquetas: PlaquetaCargaEntrada[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const plaquetasPreparadas = prepararPlaquetasCarga(data.plaquetas);
  const volumeTotal = plaquetasPreparadas.reduce((total, plaqueta) => total + plaqueta.volume, 0);
  const valorProdutos = plaquetasPreparadas.reduce((total, plaqueta) => total + plaqueta.valorTotal, 0);
  const fretePorMetroCubico = normalizarFreteCarga(data.fretePorMetroCubico);
  const frete = Number((volumeTotal * fretePorMetroCubico).toFixed(2));
  const valorTotal = valorProdutos + frete;

  return db.transaction(async (tx: any) => {
    const carga = (await tx.select().from(romaneiosCargaToras).where(eq(romaneiosCargaToras.id, id)).limit(1))[0];
    if (!carga) throw new Error("Romaneio de carga não encontrado");
    if (data.centroCustoId) await obterCentroCustoAtivo(data.centroCustoId, tx, carga.empresaId);
    const existentes = await tx.select().from(plaquetas).where(eq(plaquetas.romaneioCargaId, id));
    if (existentes.some((plaqueta: any) => plaqueta.estado !== "disponivel")) throw new Error("Este romaneio possui toras utilizadas na produção e não pode ser alterado");
    for (const plaqueta of existentes) await tx.delete(movimentacoesPlaquetas).where(eq(movimentacoesPlaquetas.plaquetaId, plaqueta.id));
    for (const plaqueta of existentes) await tx.delete(plaquetas).where(eq(plaquetas.id, plaqueta.id));

    for (const plaqueta of plaquetasPreparadas) {
      const identificacao = await prepararIdentificacaoPlaqueta(tx, plaqueta.codigoFisico);
      const valores = {
        ...identificacao,
        madeiraNome: plaqueta.madeiraNome,
        comprimento: plaqueta.comprimento.toFixed(2),
        diametro: plaqueta.diametro.toFixed(2),
        volumeInicial: plaqueta.volume.toFixed(6),
        volumeDisponivel: plaqueta.volume.toFixed(6),
        valorMetroCubico: plaqueta.valorMetroCubico.toFixed(2),
        valorTotal: plaqueta.valorTotal.toFixed(2),
        dataEntrada: data.dataCarga,
        origem: data.origem?.trim() || null,
        observacoes: plaqueta.observacoes,
      };
      const plaquetaId = getInsertedId(await tx.insert(plaquetas).values({ ...valores, empresaId: carga.empresaId, romaneioCargaId: id, estado: "disponivel", criadoPor: carga.criadoPor }) as MysqlInsertResult);
      await tx.insert(movimentacoesPlaquetas).values({ empresaId: carga.empresaId, plaquetaId, tipo: "entrada", volume: plaqueta.volume.toFixed(6), motivo: `Entrada pelo romaneio ${carga.numero}`, criadoPor: carga.criadoPor });
    }
    await tx.update(romaneiosCargaToras).set({ dataCarga: data.dataCarga, dataVencimento: data.dataVencimento, origem: data.origem?.trim() || null, fornecedorId: data.fornecedorId ?? null, centroCustoId: data.centroCustoId ?? null, responsavel: data.responsavel?.trim() || null, observacoes: data.observacoes?.trim() || null, totalPlaquetas: plaquetasPreparadas.length, volumeTotal: volumeTotal.toFixed(6), valorProdutos: valorProdutos.toFixed(2), fretePorMetroCubico: fretePorMetroCubico.toFixed(2), frete: frete.toFixed(2), valorTotal: valorTotal.toFixed(2) }).where(eq(romaneiosCargaToras.id, id));
    await sincronizarTituloMateriaPrimaCarga(tx, {
      romaneioId: id,
      numero: carga.numero,
      dataCarga: data.dataCarga,
      dataVencimento: data.dataVencimento,
      origem: data.origem,
      fornecedorId: data.fornecedorId,
      centroCustoId: data.centroCustoId,
      observacoes: data.observacoes,
      valorTotal,
      criadoPor: carga.criadoPor,
      empresaId: carga.empresaId,
    });
    return { id, numero: carga.numero, totalPlaquetas: plaquetasPreparadas.length, volumeTotal, valorProdutos, fretePorMetroCubico, frete, valorTotal };
  });
}

async function sincronizarTituloMateriaPrimaCarga(tx: any, data: {
  romaneioId: number;
  numero: string;
  dataCarga: Date;
  dataVencimento: Date;
  origem?: string | null;
  fornecedorId?: number | null;
  centroCustoId?: number | null;
  observacoes?: string | null;
  valorTotal: number;
  criadoPor: number;
  empresaId: number;
}) {
  const fornecedor = data.fornecedorId
    ? (await tx.select().from(fornecedores).where(and(eq(fornecedores.id, data.fornecedorId), eq(fornecedores.empresaId, data.empresaId))).limit(1))[0]
    : null;
  if (data.fornecedorId && !fornecedor) throw new Error("Fornecedor não encontrado para a conta a pagar da carga");
  const categoriaId = await getOrCreateCategoriaCustoMateriaPrima(tx, data.criadoPor);
  const valorOriginal = data.valorTotal.toFixed(2);
  const observacoes = ["Lançamento automático vinculado ao romaneio de carga.", data.observacoes?.trim()].filter(Boolean).join("\n");
  const valores = {
    tipo: "pagar" as const,
    origem: "romaneio_carga" as const,
    descricao: `Custo de matéria-prima — ${data.numero}`,
    fornecedorId: data.fornecedorId ?? null,
    contraparteNome: fornecedor?.nome ?? data.origem?.trim() ?? null,
    romaneioCargaId: data.romaneioId,
    categoriaId,
    centroCustoId: data.centroCustoId ?? null,
    valorOriginal,
    dataEmissao: data.dataCarga,
    dataVencimento: data.dataVencimento,
    competencia: data.dataCarga,
    estado: calcularEstadoTitulo({ valorOriginal, dataVencimento: data.dataVencimento }),
    observacoes: observacoes || null,
  };
  const existente = (await tx.select().from(titulosFinanceiros).where(and(eq(titulosFinanceiros.romaneioCargaId, data.romaneioId), eq(titulosFinanceiros.empresaId, data.empresaId))).limit(1))[0];
  if (existente) {
    if (decimalParaNumero(existente.valorBaixado) > 0) throw new Error("A carga possui uma conta a pagar com baixa registrada e não pode ser alterada");
    await tx.update(titulosFinanceiros).set(valores).where(eq(titulosFinanceiros.id, existente.id));
    await tx.update(romaneiosCargaToras).set({ tituloFinanceiroId: existente.id }).where(eq(romaneiosCargaToras.id, data.romaneioId));
    return { id: existente.id, atualizado: true };
  }
  const { id: tituloFinanceiroId } = await garantirTituloFinanceiroAutomatico({
    ...valores,
    chaveIdempotencia: `FIN-ROMANEIO-CARGA-${data.romaneioId}`,
    criadoPor: data.criadoPor,
    database: tx,
  });
  await tx.update(romaneiosCargaToras).set({ tituloFinanceiroId }).where(eq(romaneiosCargaToras.id, data.romaneioId));
  return { id: tituloFinanceiroId, atualizado: false };
}

export async function excluirRomaneioCargaToras(id: number, canceladoPor: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async (tx: any) => {
    const carga = (await tx.select().from(romaneiosCargaToras).where(eq(romaneiosCargaToras.id, id)).limit(1))[0];
    if (!carga) throw new Error("Romaneio de carga não encontrado");
    const itens = await tx.select().from(plaquetas).where(eq(plaquetas.romaneioCargaId, id));
    if (itens.some((plaqueta: any) => plaqueta.estado !== "disponivel")) {
      throw new Error("Este romaneio possui toras utilizadas na produção e não pode ser excluído");
    }
    if (carga.tituloFinanceiroId) {
      const titulo = (await tx.select().from(titulosFinanceiros).where(eq(titulosFinanceiros.id, carga.tituloFinanceiroId)).limit(1))[0];
      if (titulo && decimalParaNumero(titulo.valorBaixado) > 0) throw new Error("A conta a pagar desta carga já possui baixa e o romaneio não pode ser excluído");
      if (titulo && titulo.estado !== "cancelado") {
        await tx.update(titulosFinanceiros).set({ estado: "cancelado", canceladoEm: new Date(), canceladoPor }).where(eq(titulosFinanceiros.id, titulo.id));
      }
    }

    for (const plaqueta of itens) {
      await tx.delete(movimentacoesPlaquetas).where(eq(movimentacoesPlaquetas.plaquetaId, plaqueta.id));
      await tx.delete(plaquetas).where(eq(plaquetas.id, plaqueta.id));
    }
    await tx.delete(romaneiosCargaToras).where(eq(romaneiosCargaToras.id, id));
    return { id, numero: carga.numero, totalPlaquetas: itens.length };
  });
}

export async function createPlaqueta(data: {
  codigo?: string | null;
  madeiraNome: string;
  espessura?: string | null;
  largura?: string | null;
  comprimento?: string | null;
  volumeInicial: string;
  dataEntrada: Date;
  origem?: string | null;
  localizacao?: string | null;
  observacoes?: string | null;
  criadoPor: number;
  empresaId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const volumeInicial = Number(String(data.volumeInicial).replace(",", "."));
  if (!data.madeiraNome.trim() || !Number.isFinite(volumeInicial) || volumeInicial <= 0) {
    throw new Error("Informe madeira e volume inicial válidos para a plaqueta");
  }
  return db.transaction(async (tx: any) => {
    const empresaId = data.empresaId;
    const identificacao = await prepararIdentificacaoPlaqueta(tx, data.codigo);
    const result = await tx.insert(plaquetas).values({
      empresaId,
      ...identificacao,
      madeiraNome: data.madeiraNome.trim(),
      espessura: data.espessura ? Number(String(data.espessura).replace(",", ".")).toFixed(2) : null,
      largura: data.largura ? Number(String(data.largura).replace(",", ".")).toFixed(2) : null,
      comprimento: data.comprimento ? Number(String(data.comprimento).replace(",", ".")).toFixed(2) : null,
      volumeInicial: volumeInicial.toFixed(6),
      volumeDisponivel: volumeInicial.toFixed(6),
      dataEntrada: data.dataEntrada,
      origem: data.origem?.trim() || null,
      localizacao: data.localizacao?.trim() || null,
      observacoes: data.observacoes?.trim() || null,
      estado: "disponivel",
      criadoPor: data.criadoPor,
    });
    const id = getInsertedId(result as MysqlInsertResult);
    await tx.insert(movimentacoesPlaquetas).values({ empresaId, plaquetaId: id, tipo: "entrada", volume: volumeInicial.toFixed(6), motivo: "Entrada manual de plaqueta", criadoPor: data.criadoPor });
    return { id, codigo: identificacao.codigo, codigoFisico: identificacao.codigoFisico, situacaoIdentificacao: identificacao.situacaoIdentificacao };
  });
}

export async function listRomaneiosProducao() {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  const [romaneios, totaisToras, totaisPecas] = await Promise.all([
    db.select({
      id: romaneiosProducao.id,
      numero: romaneiosProducao.numero,
      dataProducao: romaneiosProducao.dataProducao,
      fita: romaneiosProducao.fita,
      responsavel: romaneiosProducao.responsavel,
      estado: romaneiosProducao.estado,
      observacoes: romaneiosProducao.observacoes,
      plaquetaId: romaneiosProducao.plaquetaId,
      plaquetaCodigo: plaquetas.codigo,
      madeiraNome: plaquetas.madeiraNome,
      volumePlaqueta: plaquetas.volumeInicial,
      madeiraTora: romaneiosProducao.madeiraTora,
      espessuraTora: romaneiosProducao.espessuraTora,
      larguraTora: romaneiosProducao.larguraTora,
      comprimentoTora: romaneiosProducao.comprimentoTora,
      volumeTora: romaneiosProducao.volumeTora,
      aproveitamento: romaneiosProducao.aproveitamento,
      confirmadoEm: romaneiosProducao.confirmadoEm,
    }).from(romaneiosProducao)
      .leftJoin(plaquetas, and(eq(romaneiosProducao.plaquetaId, plaquetas.id), eq(plaquetas.empresaId, empresaId)))
      .where(eq(romaneiosProducao.empresaId, empresaId))
      .orderBy(desc(romaneiosProducao.dataProducao), desc(romaneiosProducao.id)),
    db.select({
      romaneioId: itensRomaneioToras.romaneioId,
      totalToras: sql<number>`count(*)`,
      volumeToras: sql<string>`coalesce(sum(${itensRomaneioToras.volume}), 0)`,
    }).from(itensRomaneioToras).groupBy(itensRomaneioToras.romaneioId),
    db.select({
      romaneioId: itensRomaneioProducao.romaneioId,
      totalPecas: sql<number>`coalesce(sum(${itensRomaneioProducao.quantidade}), 0)`,
      volumeProduzido: sql<string>`coalesce(sum(${itensRomaneioProducao.volume}), 0)`,
    }).from(itensRomaneioProducao).groupBy(itensRomaneioProducao.romaneioId),
  ]);
  const porRomaneioToras = new Map(totaisToras.map((total) => [total.romaneioId, total]));
  const porRomaneioPecas = new Map(totaisPecas.map((total) => [total.romaneioId, total]));
  return romaneios.map((romaneio) => {
    const toras = porRomaneioToras.get(romaneio.id);
    const pecas = porRomaneioPecas.get(romaneio.id);
    return {
      ...romaneio,
      totalToras: Number(toras?.totalToras ?? (romaneio.plaquetaId ? 1 : 0)),
      volumeTora: toras?.volumeToras ?? romaneio.volumeTora ?? romaneio.volumePlaqueta ?? "0",
      totalPecas: Number(pecas?.totalPecas ?? 0),
      volumeProduzido: pecas?.volumeProduzido ?? "0",
    };
  });
}

export async function listItensRomaneioProducao(romaneioId: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return [];
  return db.select().from(itensRomaneioProducao).where(and(eq(itensRomaneioProducao.romaneioId, romaneioId), eq(itensRomaneioProducao.empresaId, empresaId))).orderBy(itensRomaneioProducao.id);
}

export async function getRomaneioProducaoComItens(romaneioId: number) {
  const empresaId = (await getEmpresaUnica()).id;
  const db = await getDb();
  if (!db) return null;
  const romaneio = (await db.select({
    id: romaneiosProducao.id,
    numero: romaneiosProducao.numero,
    dataProducao: romaneiosProducao.dataProducao,
    fita: romaneiosProducao.fita,
    responsavel: romaneiosProducao.responsavel,
    observacoes: romaneiosProducao.observacoes,
    madeiraTora: romaneiosProducao.madeiraTora,
    espessuraTora: romaneiosProducao.espessuraTora,
    larguraTora: romaneiosProducao.larguraTora,
    comprimentoTora: romaneiosProducao.comprimentoTora,
    volumeTora: romaneiosProducao.volumeTora,
    aproveitamento: romaneiosProducao.aproveitamento,
    volumeAproveitamento: romaneiosProducao.volumeAproveitamento,
    incluirAproveitamentoNoRendimento: romaneiosProducao.incluirAproveitamentoNoRendimento,
    plaquetaCodigo: plaquetas.codigo,
    origemPlaqueta: plaquetas.origem,
    localizacaoPlaqueta: plaquetas.localizacao,
  }).from(romaneiosProducao).leftJoin(plaquetas, and(eq(romaneiosProducao.plaquetaId, plaquetas.id), eq(plaquetas.empresaId, empresaId))).where(and(eq(romaneiosProducao.id, romaneioId), eq(romaneiosProducao.empresaId, empresaId))).limit(1))[0];
  if (!romaneio) return null;
  const [itens, toras, aproveitamentos] = await Promise.all([
    listItensRomaneioProducao(romaneioId),
    db.select({
      id: itensRomaneioToras.id,
      plaquetaId: itensRomaneioToras.plaquetaId,
      codigo: plaquetas.codigo,
      madeiraNome: itensRomaneioToras.madeiraNome,
      diametro: itensRomaneioToras.diametro,
      comprimento: itensRomaneioToras.comprimento,
      volume: itensRomaneioToras.volume,
    }).from(itensRomaneioToras).innerJoin(plaquetas, and(eq(itensRomaneioToras.plaquetaId, plaquetas.id), eq(plaquetas.empresaId, empresaId))).where(and(eq(itensRomaneioToras.romaneioId, romaneioId), eq(itensRomaneioToras.empresaId, empresaId))),
    db.select().from(aproveitamentosRomaneioProducao).where(and(eq(aproveitamentosRomaneioProducao.romaneioId, romaneioId), eq(aproveitamentosRomaneioProducao.empresaId, empresaId))),
  ]);
  return { romaneio, itens, toras, aproveitamentos };
}
