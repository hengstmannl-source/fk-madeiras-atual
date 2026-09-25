import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import {
  calculosCustosGerenciais,
  categoriasCustosGerenciais,
  centrosCustosGerenciais,
  componentesCalculosCustosGerenciais,
  itensRateiosCustosGerenciais,
  itensRomaneioToras,
  lancamentosCustosGerenciais,
  lotesPecasSerradas,
  movimentacoesEstoqueSerrado,
  orcamentos,
  plaquetas,
  rateiosCustosGerenciais,
  romaneiosCargaToras,
  romaneiosProducao,
} from "../../drizzle/schema";
import {
  calcularValorLancamentoCusto,
  calcularCustoMateriaPrimaRastreavel,
  calcularRateiosPorCategoria,
  decimalCusto,
  type BaseApropriacaoCusto,
  type BasesApropriacao,
  type UnidadeValorCusto,
  validarBaseApropriacao,
} from "../custos-gerenciais.logic";
import { getDb } from "./core";
import { getEmpresaUnica } from "./identidade";

type CentroCodigo = "industrial" | "comercial_administrativo";
type TipoCategoriaCusto = "estrutural" | "direto_venda";
type OrigemLancamentoCusto = "manual" | "financeiro_referenciado" | "venda_direta";
type EntidadeCalculoCusto = "romaneio_producao" | "lote" | "venda";
type TipoComponenteCusto = "materia_prima" | "industrial" | "administrativo" | "comercial" | "frete_comercial" | "comissao" | "taxa" | "direto_venda";
type OrigemComponenteCusto = "consumo_tora" | "rateio_categoria" | "lancamento_direto" | "venda";

type ComponenteParaPersistencia = {
  categoriaCustoId?: number | null;
  itemRateioId?: number | null;
  lancamentoCustoId?: number | null;
  tipo: TipoComponenteCusto;
  origemTipo: OrigemComponenteCusto;
  origemId?: number | null;
  valor: number;
  coberturaPercentual: number;
  memoriaCalculo: Record<string, unknown>;
};

type CriarCentroCustoInput = {
  codigo: CentroCodigo;
  nome: string;
  criadoPor: number;
};

type CriarCategoriaCustoInput = {
  centroCustoId: number;
  categoriaFinanceiraId?: number | null;
  codigo: string;
  nome: string;
  tipo: TipoCategoriaCusto;
  baseApropriacao: BaseApropriacaoCusto;
  incluirComissaoVendaAutomatica?: boolean;
  criadoPor: number;
};

export type CriarLancamentoCustoInput = {
  categoriaCustoId: number;
  competencia: Date;
  descricao: string;
  unidadeValor: UnidadeValorCusto;
  valor: number | string;
  origem: OrigemLancamentoCusto;
  tituloFinanceiroId?: number | null;
  orcamentoId?: number | null;
  romaneioCargaId?: number | null;
  romaneioProducaoId?: number | null;
  loteId?: number | null;
  notaDieselId?: number | null;
  comprovanteUrl?: string | null;
  observacoes?: string | null;
  justificativaCompetencia?: string | null;
  criadoPor: number;
};

function inicioCompetencia(competencia: Date): Date {
  return new Date(competencia.getFullYear(), competencia.getMonth(), 1, 0, 0, 0, 0);
}

function proximaCompetencia(competencia: Date): Date {
  return new Date(competencia.getFullYear(), competencia.getMonth() + 1, 1, 0, 0, 0, 0);
}

function textoObrigatorio(valor: string, rotulo: string, tamanhoMaximo: number): string {
  const normalizado = valor.trim();
  if (!normalizado) throw new Error(`${rotulo} é obrigatório.`);
  if (normalizado.length > tamanhoMaximo) throw new Error(`${rotulo} excede o tamanho permitido.`);
  return normalizado;
}

function codigoNormalizado(valor: string): string {
  return textoObrigatorio(valor, "Código", 80)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "_");
}

function idInserido(resultado: unknown): number {
  const primeiro = Array.isArray(resultado) ? resultado[0] : undefined;
  const id = primeiro && typeof primeiro === "object" && "insertId" in primeiro
    ? Number((primeiro as { insertId?: number | bigint }).insertId)
    : 0;
  if (!Number.isInteger(id) || id <= 0) throw new Error("Não foi possível identificar o registro criado.");
  return id;
}

function valorNumerico(valor: unknown): number {
  return decimalCusto(typeof valor === "string" || typeof valor === "number" ? valor : 0);
}

function competenciaDaVenda(venda: { competencia: Date | null; createdAt: Date }): Date {
  return venda.competencia ?? venda.createdAt;
}

function estaNaCompetencia(data: Date, inicio: Date, fim: Date): boolean {
  return data >= inicio && data < fim;
}

export async function listarCentrosCustosGerenciais(incluirInativos = false) {
  const db = await getDb();
  if (!db) return [];
  const empresaId = (await getEmpresaUnica()).id;
  const condicoes = [eq(centrosCustosGerenciais.empresaId, empresaId)];
  if (!incluirInativos) condicoes.push(eq(centrosCustosGerenciais.ativo, true));
  return db.select().from(centrosCustosGerenciais)
    .where(and(...condicoes))
    .orderBy(asc(centrosCustosGerenciais.codigo));
}

export async function criarCentroCustoGerencial(input: CriarCentroCustoInput) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const existente = (await db.select({ id: centrosCustosGerenciais.id }).from(centrosCustosGerenciais).where(and(
    eq(centrosCustosGerenciais.empresaId, empresaId),
    eq(centrosCustosGerenciais.codigo, input.codigo),
  )).limit(1))[0];
  if (existente) throw new Error("Já existe um centro com este código.");
  const resultado = await db.insert(centrosCustosGerenciais).values({
    empresaId,
    codigo: input.codigo,
    nome: textoObrigatorio(input.nome, "Nome do centro", 150),
    ativo: true,
    criadoPor: input.criadoPor,
  });
  return { id: idInserido(resultado) };
}

export async function atualizarCentroCustoGerencial(input: {
  id: number;
  nome?: string;
  ativo?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const atualizacao: { nome?: string; ativo?: boolean } = {};
  if (input.nome !== undefined) atualizacao.nome = textoObrigatorio(input.nome, "Nome do centro", 150);
  if (input.ativo !== undefined) atualizacao.ativo = input.ativo;
  if (!Object.keys(atualizacao).length) throw new Error("Informe ao menos um campo para atualizar.");
  const resultado = await db.update(centrosCustosGerenciais).set(atualizacao).where(and(
    eq(centrosCustosGerenciais.id, input.id),
    eq(centrosCustosGerenciais.empresaId, empresaId),
  ));
  if (!resultado[0]?.affectedRows) throw new Error("Centro de custo não encontrado.");
  return { sucesso: true };
}

export async function listarCategoriasCustosGerenciais(incluirInativas = false) {
  const db = await getDb();
  if (!db) return [];
  const empresaId = (await getEmpresaUnica()).id;
  const condicoes = [eq(categoriasCustosGerenciais.empresaId, empresaId)];
  if (!incluirInativas) condicoes.push(eq(categoriasCustosGerenciais.ativo, true));
  return db.select({
    categoria: categoriasCustosGerenciais,
    centro: centrosCustosGerenciais,
  }).from(categoriasCustosGerenciais)
    .innerJoin(centrosCustosGerenciais, and(
      eq(centrosCustosGerenciais.id, categoriasCustosGerenciais.centroCustoId),
      eq(centrosCustosGerenciais.empresaId, empresaId),
    ))
    .where(and(...condicoes))
    .orderBy(asc(centrosCustosGerenciais.codigo), asc(categoriasCustosGerenciais.nome));
}

export async function criarCategoriaCustoGerencial(input: CriarCategoriaCustoInput) {
  validarBaseApropriacao(input.baseApropriacao);
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const centro = (await db.select({ id: centrosCustosGerenciais.id, ativo: centrosCustosGerenciais.ativo }).from(centrosCustosGerenciais).where(and(
    eq(centrosCustosGerenciais.id, input.centroCustoId),
    eq(centrosCustosGerenciais.empresaId, empresaId),
  )).limit(1))[0];
  if (!centro?.ativo) throw new Error("Centro de custo ativo não encontrado.");
  const codigo = codigoNormalizado(input.codigo);
  const existente = (await db.select({ id: categoriasCustosGerenciais.id }).from(categoriasCustosGerenciais).where(and(
    eq(categoriasCustosGerenciais.empresaId, empresaId),
    eq(categoriasCustosGerenciais.codigo, codigo),
  )).limit(1))[0];
  if (existente) throw new Error("Já existe uma categoria com este código.");
  const resultado = await db.insert(categoriasCustosGerenciais).values({
    empresaId,
    centroCustoId: input.centroCustoId,
    categoriaFinanceiraId: input.categoriaFinanceiraId ?? null,
    codigo,
    nome: textoObrigatorio(input.nome, "Nome da categoria", 150),
    tipo: input.tipo,
    baseApropriacao: input.baseApropriacao,
    incluirComissaoVendaAutomatica: input.incluirComissaoVendaAutomatica ?? false,
    ativo: true,
    criadoPor: input.criadoPor,
  });
  return { id: idInserido(resultado) };
}

export async function atualizarCategoriaCustoGerencial(input: {
  id: number;
  centroCustoId?: number;
  categoriaFinanceiraId?: number | null;
  nome?: string;
  tipo?: TipoCategoriaCusto;
  baseApropriacao?: BaseApropriacaoCusto;
  incluirComissaoVendaAutomatica?: boolean;
  ativo?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  if (input.baseApropriacao) validarBaseApropriacao(input.baseApropriacao);
  if (input.centroCustoId) {
    const centro = (await db.select({ id: centrosCustosGerenciais.id }).from(centrosCustosGerenciais).where(and(
      eq(centrosCustosGerenciais.id, input.centroCustoId),
      eq(centrosCustosGerenciais.empresaId, empresaId),
    )).limit(1))[0];
    if (!centro) throw new Error("Centro de custo não encontrado.");
  }
  const atualizacao: Partial<typeof categoriasCustosGerenciais.$inferInsert> = {};
  if (input.centroCustoId !== undefined) atualizacao.centroCustoId = input.centroCustoId;
  if (input.categoriaFinanceiraId !== undefined) atualizacao.categoriaFinanceiraId = input.categoriaFinanceiraId;
  if (input.nome !== undefined) atualizacao.nome = textoObrigatorio(input.nome, "Nome da categoria", 150);
  if (input.tipo !== undefined) atualizacao.tipo = input.tipo;
  if (input.baseApropriacao !== undefined) atualizacao.baseApropriacao = input.baseApropriacao;
  if (input.incluirComissaoVendaAutomatica !== undefined) atualizacao.incluirComissaoVendaAutomatica = input.incluirComissaoVendaAutomatica;
  if (input.ativo !== undefined) atualizacao.ativo = input.ativo;
  if (!Object.keys(atualizacao).length) throw new Error("Informe ao menos um campo para atualizar.");
  const resultado = await db.update(categoriasCustosGerenciais).set(atualizacao).where(and(
    eq(categoriasCustosGerenciais.id, input.id),
    eq(categoriasCustosGerenciais.empresaId, empresaId),
  ));
  if (!resultado[0]?.affectedRows) throw new Error("Categoria de custo não encontrada.");
  return { sucesso: true };
}

export async function listarLancamentosCustosGerenciais(input: {
  competencia?: Date;
  categoriaCustoId?: number;
  incluirCancelados?: boolean;
} = {}) {
  const db = await getDb();
  if (!db) return [];
  const empresaId = (await getEmpresaUnica()).id;
  const condicoes = [eq(lancamentosCustosGerenciais.empresaId, empresaId)];
  if (!input.incluirCancelados) condicoes.push(eq(lancamentosCustosGerenciais.estado, "ativo"));
  if (input.categoriaCustoId) condicoes.push(eq(lancamentosCustosGerenciais.categoriaCustoId, input.categoriaCustoId));
  if (input.competencia) {
    const inicio = inicioCompetencia(input.competencia);
    condicoes.push(gte(lancamentosCustosGerenciais.competencia, inicio));
    condicoes.push(lt(lancamentosCustosGerenciais.competencia, proximaCompetencia(inicio)));
  }
  return db.select({
    lancamento: lancamentosCustosGerenciais,
    categoria: categoriasCustosGerenciais,
    centro: centrosCustosGerenciais,
  }).from(lancamentosCustosGerenciais)
    .innerJoin(categoriasCustosGerenciais, eq(categoriasCustosGerenciais.id, lancamentosCustosGerenciais.categoriaCustoId))
    .innerJoin(centrosCustosGerenciais, eq(centrosCustosGerenciais.id, categoriasCustosGerenciais.centroCustoId))
    .where(and(...condicoes))
    .orderBy(desc(lancamentosCustosGerenciais.competencia), desc(lancamentosCustosGerenciais.createdAt));
}

export async function criarLancamentoCustoGerencial(input: CriarLancamentoCustoInput) {
  const valor = decimalCusto(input.valor);
  if (valor < 0) throw new Error("O valor do custo não pode ser negativo.");
  if (input.unidadeValor === "percentual" && valor > 100) throw new Error("O percentual de custo não pode superar 100%.");
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const categoria = (await db.select({ id: categoriasCustosGerenciais.id, ativo: categoriasCustosGerenciais.ativo }).from(categoriasCustosGerenciais).where(and(
    eq(categoriasCustosGerenciais.id, input.categoriaCustoId),
    eq(categoriasCustosGerenciais.empresaId, empresaId),
  )).limit(1))[0];
  if (!categoria?.ativo) throw new Error("Categoria de custo ativa não encontrada.");
  let competencia = inicioCompetencia(input.competencia);
  let competenciaOriginal = competencia;
  let competenciaAlteradaEm: Date | null = null;
  let competenciaAlteradaPor: number | null = null;
  let justificativaCompetencia: string | null = null;
  if (input.origem === "venda_direta") {
    if (!input.orcamentoId) throw new Error("Um custo direto de venda deve referenciar a venda correspondente.");
    const venda = (await db.select({ competencia: orcamentos.competencia, createdAt: orcamentos.createdAt }).from(orcamentos).where(and(
      eq(orcamentos.id, input.orcamentoId),
      eq(orcamentos.empresaId, empresaId),
    )).limit(1))[0];
    if (!venda) throw new Error("Venda de referência não encontrada.");
    competenciaOriginal = inicioCompetencia(competenciaDaVenda(venda));
    if (competencia.getTime() !== competenciaOriginal.getTime()) {
      justificativaCompetencia = textoObrigatorio(input.justificativaCompetencia ?? "", "Justificativa da exceção de competência", 4_000);
      competenciaAlteradaEm = new Date();
      competenciaAlteradaPor = input.criadoPor;
    }
  }
  const resultado = await db.insert(lancamentosCustosGerenciais).values({
    empresaId,
    categoriaCustoId: input.categoriaCustoId,
    competencia,
    competenciaOriginal,
    competenciaAlteradaEm,
    competenciaAlteradaPor,
    justificativaCompetencia,
    descricao: textoObrigatorio(input.descricao, "Descrição", 300),
    unidadeValor: input.unidadeValor,
    valor: valor.toFixed(4),
    origem: input.origem,
    tituloFinanceiroId: input.tituloFinanceiroId ?? null,
    orcamentoId: input.orcamentoId ?? null,
    romaneioCargaId: input.romaneioCargaId ?? null,
    romaneioProducaoId: input.romaneioProducaoId ?? null,
    loteId: input.loteId ?? null,
    notaDieselId: input.notaDieselId ?? null,
    comprovanteUrl: input.comprovanteUrl?.trim() || null,
    observacoes: input.observacoes?.trim() || null,
    estado: "ativo",
    criadoPor: input.criadoPor,
  });
  return { id: idInserido(resultado) };
}

export async function cancelarLancamentoCustoGerencial(input: { id: number; motivo: string; canceladoPor: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const motivo = textoObrigatorio(input.motivo, "Motivo do cancelamento", 4_000);
  return db.transaction(async (tx) => {
    const lancamento = (await tx.select({ id: lancamentosCustosGerenciais.id, estado: lancamentosCustosGerenciais.estado }).from(lancamentosCustosGerenciais).where(and(
      eq(lancamentosCustosGerenciais.id, input.id),
      eq(lancamentosCustosGerenciais.empresaId, empresaId),
    )).for("update").limit(1))[0];
    if (!lancamento) throw new Error("Lançamento de custo não encontrado.");
    if (lancamento.estado === "cancelado") throw new Error("Este lançamento de custo já está cancelado.");
    await tx.update(lancamentosCustosGerenciais).set({
      estado: "cancelado",
      canceladoEm: new Date(),
      canceladoPor: input.canceladoPor,
      motivoCancelamento: motivo,
    }).where(eq(lancamentosCustosGerenciais.id, lancamento.id));
    return { sucesso: true };
  });
}

async function calcularBasesRateio(tx: any, empresaId: number, competencia: Date): Promise<BasesApropriacao> {
  const inicio = inicioCompetencia(competencia);
  const fim = proximaCompetencia(inicio);
  const [lotesProduzidos, cargas, vendas] = await Promise.all([
    tx.select({
      volume: lotesPecasSerradas.volume,
      tipo: lotesPecasSerradas.tipo,
      incluirAproveitamentoNoRendimento: romaneiosProducao.incluirAproveitamentoNoRendimento,
    }).from(lotesPecasSerradas)
      .innerJoin(romaneiosProducao, eq(romaneiosProducao.id, lotesPecasSerradas.romaneioId))
      .where(and(
        eq(lotesPecasSerradas.empresaId, empresaId),
        eq(lotesPecasSerradas.propriedade, "proprio"),
        eq(romaneiosProducao.empresaId, empresaId),
        eq(romaneiosProducao.estado, "confirmado"),
        gte(romaneiosProducao.dataProducao, inicio),
        lt(romaneiosProducao.dataProducao, fim),
      )),
    tx.select({ total: sql<number>`count(*)` }).from(romaneiosCargaToras).where(and(
      eq(romaneiosCargaToras.empresaId, empresaId),
      gte(romaneiosCargaToras.dataCarga, inicio),
      lt(romaneiosCargaToras.dataCarga, fim),
    )),
    tx.select({
      id: orcamentos.id,
      competencia: orcamentos.competencia,
      createdAt: orcamentos.createdAt,
      totalVolume: orcamentos.totalVolume,
      totalPecas: orcamentos.totalPecas,
      total: orcamentos.total,
    }).from(orcamentos).where(and(
      eq(orcamentos.empresaId, empresaId),
      eq(orcamentos.estado, "aprovado"),
    )),
  ]);
  const vendasDaCompetencia = vendas.filter((venda: { competencia: Date | null; createdAt: Date }) => estaNaCompetencia(competenciaDaVenda(venda), inicio, fim));
  return {
    m3_produzido: lotesProduzidos.reduce((soma: number, lote: { volume: string | number; tipo: "peca" | "aproveitamento"; incluirAproveitamentoNoRendimento: boolean }) => {
      const incluir = lote.tipo === "peca" || lote.incluirAproveitamentoNoRendimento;
      return incluir ? soma + valorNumerico(lote.volume) : soma;
    }, 0),
    m3_vendido: vendasDaCompetencia.reduce((soma: number, venda: { totalVolume: string | number }) => soma + valorNumerico(venda.totalVolume), 0),
    valor_vendido: vendasDaCompetencia.reduce((soma: number, venda: { total: string | number }) => soma + valorNumerico(venda.total), 0),
    quantidade_vendida: vendasDaCompetencia.reduce((soma: number, venda: { totalPecas: number }) => soma + venda.totalPecas, 0),
    carga: Number(cargas[0]?.total ?? 0),
    pedido: vendasDaCompetencia.length,
    percentual_receita: vendasDaCompetencia.reduce((soma: number, venda: { total: string | number }) => soma + valorNumerico(venda.total), 0),
    manual: 0,
  };
}

export async function gerarRateioCustoGerencial(input: { competencia: Date; criadoPor: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const competencia = inicioCompetencia(input.competencia);
  return db.transaction(async (tx) => {
    const [categorias, lancamentos, existentes] = await Promise.all([
      tx.select({ id: categoriasCustosGerenciais.id, baseApropriacao: categoriasCustosGerenciais.baseApropriacao, tipo: categoriasCustosGerenciais.tipo }).from(categoriasCustosGerenciais)
        .where(and(eq(categoriasCustosGerenciais.empresaId, empresaId), eq(categoriasCustosGerenciais.ativo, true))),
      tx.select().from(lancamentosCustosGerenciais).where(and(
        eq(lancamentosCustosGerenciais.empresaId, empresaId),
        eq(lancamentosCustosGerenciais.estado, "ativo"),
        gte(lancamentosCustosGerenciais.competencia, competencia),
        lt(lancamentosCustosGerenciais.competencia, proximaCompetencia(competencia)),
      )),
      tx.select().from(rateiosCustosGerenciais).where(and(
        eq(rateiosCustosGerenciais.empresaId, empresaId),
        eq(rateiosCustosGerenciais.competencia, competencia),
      )).for("update"),
    ]);
    const categoriasPorId = new Map(categorias.map((categoria: { id: number; baseApropriacao: BaseApropriacaoCusto; tipo: TipoCategoriaCusto }) => [categoria.id, categoria]));
    const bases = await calcularBasesRateio(tx, empresaId, competencia);
    const lancamentosEstruturais = lancamentos.filter((lancamento: typeof lancamentosCustosGerenciais.$inferSelect) => {
      const categoria = categoriasPorId.get(lancamento.categoriaCustoId);
      if (!categoria) throw new Error(`A categoria ${lancamento.categoriaCustoId} deste lançamento não está ativa.`);
      return categoria.tipo === "estrutural";
    });
    const calculados = calcularRateiosPorCategoria(lancamentosEstruturais.map((lancamento: typeof lancamentosCustosGerenciais.$inferSelect) => {
      const categoria = categoriasPorId.get(lancamento.categoriaCustoId);
      if (!categoria) throw new Error(`A categoria ${lancamento.categoriaCustoId} deste lançamento não está ativa.`);
      return {
        id: lancamento.id,
        categoriaCustoId: lancamento.categoriaCustoId,
        baseApropriacao: categoria.baseApropriacao,
        unidadeValor: lancamento.unidadeValor,
        valor: lancamento.valor,
      };
    }), bases);
    const agora = new Date();
    const atualVigente = existentes.filter((item: { estado: string }) => item.estado === "vigente");
    if (atualVigente.length) {
      await tx.update(rateiosCustosGerenciais).set({
        estado: "substituido",
        substituidoEm: agora,
        substituidoPor: input.criadoPor,
      }).where(and(
        eq(rateiosCustosGerenciais.empresaId, empresaId),
        eq(rateiosCustosGerenciais.competencia, competencia),
        eq(rateiosCustosGerenciais.estado, "vigente"),
      ));
    }
    const versao = existentes.reduce((maior: number, item: { versao: number }) => Math.max(maior, item.versao), 0) + 1;
    const criteriosSnapshot = JSON.stringify({
      competencia: competencia.toISOString(),
      versao,
      bases,
      regra: "Somente lotes próprios do romaneio de produção confirmado entram em m3_produzido; terceiros e aproveitamento ficam fora. Vendas usam a competência explícita da venda ou, na ausência, sua criação; o rateio não utiliza o volume histórico zerado das movimentações de estoque.",
      lancamentos: calculados.map((item) => ({ categoriaCustoId: item.categoriaCustoId, lancamentosIds: item.lancamentosIds })),
      lancamentosDiretosExcluidosDoRateio: lancamentos.length - lancamentosEstruturais.length,
    });
    const insercao = await tx.insert(rateiosCustosGerenciais).values({
      empresaId,
      competencia,
      versao,
      estado: "vigente",
      criteriosSnapshot,
      criadoPor: input.criadoPor,
    });
    const rateioId = idInserido(insercao);
    if (calculados.length) {
      await tx.insert(itensRateiosCustosGerenciais).values(calculados.map((item) => ({
        empresaId,
        rateioId,
        categoriaCustoId: item.categoriaCustoId,
        baseApropriacao: item.baseApropriacao,
        baseTotal: item.baseTotal.toFixed(6),
        valorRateado: item.valorRateado.toFixed(2),
        fatorUnitario: item.fatorUnitario.toFixed(8),
        coberturaPercentual: item.coberturaPercentual.toFixed(2),
        memoriaCalculo: JSON.stringify({
          lancamentosIds: item.lancamentosIds,
          baseTotal: item.baseTotal,
          valorRateado: item.valorRateado,
          fatorUnitario: item.fatorUnitario,
          coberturaPercentual: item.coberturaPercentual,
        }),
      })));
    }
    return { id: rateioId, versao, itens: calculados, bases };
  });
}

export async function listarRateiosCustosGerenciais(competencia?: Date) {
  const db = await getDb();
  if (!db) return [];
  const empresaId = (await getEmpresaUnica()).id;
  const condicoes = [eq(rateiosCustosGerenciais.empresaId, empresaId)];
  if (competencia) condicoes.push(eq(rateiosCustosGerenciais.competencia, inicioCompetencia(competencia)));
  return db.select({
    rateio: rateiosCustosGerenciais,
    item: itensRateiosCustosGerenciais,
    categoria: categoriasCustosGerenciais,
  }).from(rateiosCustosGerenciais)
    .leftJoin(itensRateiosCustosGerenciais, eq(itensRateiosCustosGerenciais.rateioId, rateiosCustosGerenciais.id))
    .leftJoin(categoriasCustosGerenciais, eq(categoriasCustosGerenciais.id, itensRateiosCustosGerenciais.categoriaCustoId))
    .where(and(...condicoes))
    .orderBy(desc(rateiosCustosGerenciais.competencia), desc(rateiosCustosGerenciais.versao), asc(categoriasCustosGerenciais.nome));
}

export type LoteCustoMateriaPrimaRastreavel = {
  loteId: number;
  madeiraNome: string;
  tipo: "peca" | "aproveitamento";
  volumeM3: number;
  participaDoDenominador: boolean;
  custoMateriaPrimaRastreavel: number | null;
  coberturaPercentual: number;
  statusCobertura: "completo" | "parcial" | "nao_determinado" | "sem_volume_produzido";
};

/**
 * Reconstitui o custo de MP de uma produção a partir da tora efetivamente consumida.
 * O custo conhecido é distribuído apenas entre lotes próprios do mesmo romaneio pelo
 * volume produzido. Quando falta origem de carga, a cobertura fica parcial — nunca há
 * uso de médias, preços anteriores ou estimativas para completar o valor ausente.
 */
export async function obterCustoMateriaPrimaRastreavelPorRomaneio(romaneioId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const producao = (await db.select({
    id: romaneiosProducao.id,
    numero: romaneiosProducao.numero,
    estado: romaneiosProducao.estado,
    incluirAproveitamentoNoRendimento: romaneiosProducao.incluirAproveitamentoNoRendimento,
    dataProducao: romaneiosProducao.dataProducao,
  }).from(romaneiosProducao).where(and(
    eq(romaneiosProducao.id, romaneioId),
    eq(romaneiosProducao.empresaId, empresaId),
  )).limit(1))[0];
  if (!producao) throw new Error("Romaneio de produção não encontrado.");
  if (producao.estado !== "confirmado") throw new Error("O custo rastreável só pode ser consultado em romaneio confirmado.");

  const [torasConsumidas, lotes] = await Promise.all([
    db.select({
      itemId: itensRomaneioToras.id,
      volumeConsumidoM3: itensRomaneioToras.volume,
      plaquetaCodigo: plaquetas.codigo,
      plaquetaId: plaquetas.id,
      romaneioCargaId: plaquetas.romaneioCargaId,
      valorMetroCubico: plaquetas.valorMetroCubico,
      cargaId: romaneiosCargaToras.id,
      fretePorMetroCubico: romaneiosCargaToras.fretePorMetroCubico,
    }).from(itensRomaneioToras)
      .leftJoin(plaquetas, and(eq(plaquetas.id, itensRomaneioToras.plaquetaId), eq(plaquetas.empresaId, empresaId)))
      .leftJoin(romaneiosCargaToras, and(eq(romaneiosCargaToras.id, plaquetas.romaneioCargaId), eq(romaneiosCargaToras.empresaId, empresaId)))
      .where(and(eq(itensRomaneioToras.empresaId, empresaId), eq(itensRomaneioToras.romaneioId, romaneioId))),
    db.select({
      id: lotesPecasSerradas.id,
      madeiraNome: lotesPecasSerradas.madeiraNome,
      tipo: lotesPecasSerradas.tipo,
      volume: lotesPecasSerradas.volume,
    }).from(lotesPecasSerradas).where(and(
      eq(lotesPecasSerradas.empresaId, empresaId),
      eq(lotesPecasSerradas.romaneioId, romaneioId),
      eq(lotesPecasSerradas.propriedade, "proprio"),
    )),
  ]);

  const consumo = torasConsumidas.map((tora: {
    itemId: number;
    volumeConsumidoM3: string | number;
    plaquetaCodigo: string | null;
    plaquetaId: number | null;
    romaneioCargaId: number | null;
    valorMetroCubico: string | number | null;
    cargaId: number | null;
    fretePorMetroCubico: string | number | null;
  }) => {
    const volume = valorNumerico(tora.volumeConsumidoM3);
    const possuiOrigemDeCusto = tora.plaquetaId !== null && tora.romaneioCargaId !== null && tora.cargaId !== null;
    return {
      identificador: tora.plaquetaCodigo ?? `item-tora-${tora.itemId}`,
      volumeConsumidoM3: volume,
      custoTora: possuiOrigemDeCusto ? volume * valorNumerico(tora.valorMetroCubico) : null,
      freteEntrada: possuiOrigemDeCusto ? volume * valorNumerico(tora.fretePorMetroCubico) : null,
    };
  });
  const resumo = calcularCustoMateriaPrimaRastreavel(consumo);
  const lotesComParticipacao = lotes.map((lote: { id: number; madeiraNome: string; tipo: "peca" | "aproveitamento"; volume: string | number }) => ({
    ...lote,
    volumeM3: valorNumerico(lote.volume),
    participaDoDenominador: lote.tipo === "peca" || producao.incluirAproveitamentoNoRendimento,
  }));
  const volumeProduzidoBase = lotesComParticipacao
    .filter((lote: { participaDoDenominador: boolean }) => lote.participaDoDenominador)
    .reduce((soma: number, lote: { volumeM3: number }) => soma + lote.volumeM3, 0);
  const statusCobertura: LoteCustoMateriaPrimaRastreavel["statusCobertura"] = volumeProduzidoBase <= 0
    ? "sem_volume_produzido"
    : resumo.coberturaPercentual <= 0
      ? "nao_determinado"
      : resumo.coberturaPercentual < 100
        ? "parcial"
        : "completo";
  const custoPorM3Produzido = volumeProduzidoBase > 0 && resumo.custoRastreavel > 0
    ? resumo.custoRastreavel / volumeProduzidoBase
    : null;
  const lotesComCusto: LoteCustoMateriaPrimaRastreavel[] = lotesComParticipacao.map((lote: {
    id: number;
    madeiraNome: string;
    tipo: "peca" | "aproveitamento";
    volumeM3: number;
    participaDoDenominador: boolean;
  }) => ({
    loteId: lote.id,
    madeiraNome: lote.madeiraNome,
    tipo: lote.tipo,
    volumeM3: lote.volumeM3,
    participaDoDenominador: lote.participaDoDenominador,
    custoMateriaPrimaRastreavel: lote.participaDoDenominador && custoPorM3Produzido !== null
      ? Math.round((lote.volumeM3 * custoPorM3Produzido + Number.EPSILON) * 100) / 100
      : null,
    coberturaPercentual: resumo.coberturaPercentual,
    statusCobertura,
  }));
  return {
    romaneio: producao,
    resumo: {
      ...resumo,
      volumeProduzidoBase,
      custoPorM3Produzido: custoPorM3Produzido === null ? null : Math.round((custoPorM3Produzido + Number.EPSILON) * 10_000) / 10_000,
      statusCobertura,
    },
    lotes: lotesComCusto,
  };
}

export async function obterCustoMateriaPrimaRastreavelPorLote(loteId: number) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const lote = (await db.select({
    id: lotesPecasSerradas.id,
    romaneioId: lotesPecasSerradas.romaneioId,
    propriedade: lotesPecasSerradas.propriedade,
  }).from(lotesPecasSerradas).where(and(
    eq(lotesPecasSerradas.id, loteId),
    eq(lotesPecasSerradas.empresaId, empresaId),
  )).limit(1))[0];
  if (!lote) throw new Error("Lote não encontrado.");
  if (lote.propriedade !== "proprio") throw new Error("Lotes de terceiros não compõem o custo de estoque próprio.");
  if (!lote.romaneioId) throw new Error("Este lote não possui romaneio de produção rastreável.");
  const custoRomaneio = await obterCustoMateriaPrimaRastreavelPorRomaneio(lote.romaneioId);
  const custoLote = custoRomaneio.lotes.find((item) => item.loteId === loteId);
  if (!custoLote) throw new Error("O lote não pertence aos lotes próprios do romaneio informado.");
  return { ...custoLote, romaneio: custoRomaneio.romaneio, resumoRomaneio: custoRomaneio.resumo };
}

function resumoDasParcelas(componentes: ComponenteParaPersistencia[]) {
  const porTipo = (tipos: TipoComponenteCusto[]) => componentes
    .filter((item) => tipos.includes(item.tipo))
    .reduce((soma, item) => soma + item.valor, 0);
  const custoMateriaPrima = porTipo(["materia_prima"]);
  const custoIndustrial = porTipo(["industrial"]);
  const custoAdministrativo = porTipo(["administrativo"]);
  const custoComercial = porTipo(["comercial", "frete_comercial", "comissao", "taxa", "direto_venda"]);
  const valorCoberto = componentes
    .reduce((soma, item) => soma + (item.valor * Math.max(0, Math.min(100, item.coberturaPercentual))) / 100, 0);
  const custoTotal = custoMateriaPrima + custoIndustrial + custoAdministrativo + custoComercial;
  const coberturaPercentual = custoTotal > 0 ? Math.round((valorCoberto / custoTotal) * 10_000) / 100 : 0;
  return {
    custoMateriaPrima: Math.round((custoMateriaPrima + Number.EPSILON) * 100) / 100,
    custoIndustrial: Math.round((custoIndustrial + Number.EPSILON) * 100) / 100,
    custoAdministrativo: Math.round((custoAdministrativo + Number.EPSILON) * 100) / 100,
    custoComercial: Math.round((custoComercial + Number.EPSILON) * 100) / 100,
    custoTotal: Math.round((custoTotal + Number.EPSILON) * 100) / 100,
    coberturaPercentual: Math.max(0, Math.min(100, coberturaPercentual)),
  };
}

function statusCoberturaParaCalculo(input: { possuiVolume: boolean; componentes: ComponenteParaPersistencia[] }) {
  if (!input.possuiVolume) return "sem_volume_produzido" as const;
  if (!input.componentes.length || input.componentes.some((item) => item.coberturaPercentual <= 0)) return "nao_determinado" as const;
  if (input.componentes.some((item) => item.coberturaPercentual < 100)) return "parcial" as const;
  return "completo" as const;
}

async function persistirCalculoVersionado(tx: any, input: {
  empresaId: number;
  entidadeTipo: EntidadeCalculoCusto;
  entidadeId: number;
  competencia: Date;
  rateioId?: number | null;
  componentes: ComponenteParaPersistencia[];
  criteriosSnapshot: Record<string, unknown>;
  possuiVolume: boolean;
  criadoPor: number;
}) {
  const existentes = await tx.select().from(calculosCustosGerenciais).where(and(
    eq(calculosCustosGerenciais.empresaId, input.empresaId),
    eq(calculosCustosGerenciais.entidadeTipo, input.entidadeTipo),
    eq(calculosCustosGerenciais.entidadeId, input.entidadeId),
  )).for("update");
  const agora = new Date();
  if (existentes.some((item: { estado: string }) => item.estado === "vigente")) {
    await tx.update(calculosCustosGerenciais).set({ estado: "substituido", substituidoEm: agora, substituidoPor: input.criadoPor }).where(and(
      eq(calculosCustosGerenciais.empresaId, input.empresaId),
      eq(calculosCustosGerenciais.entidadeTipo, input.entidadeTipo),
      eq(calculosCustosGerenciais.entidadeId, input.entidadeId),
      eq(calculosCustosGerenciais.estado, "vigente"),
    ));
  }
  const versao = existentes.reduce((maior: number, item: { versao: number }) => Math.max(maior, item.versao), 0) + 1;
  const resumo = resumoDasParcelas(input.componentes);
  const statusCobertura = statusCoberturaParaCalculo({ possuiVolume: input.possuiVolume, componentes: input.componentes });
  const insercao = await tx.insert(calculosCustosGerenciais).values({
    empresaId: input.empresaId,
    entidadeTipo: input.entidadeTipo,
    entidadeId: input.entidadeId,
    competencia: inicioCompetencia(input.competencia),
    versao,
    estado: "vigente",
    rateioId: input.rateioId ?? null,
    custoMateriaPrima: resumo.custoMateriaPrima.toFixed(2),
    custoIndustrial: resumo.custoIndustrial.toFixed(2),
    custoAdministrativo: resumo.custoAdministrativo.toFixed(2),
    custoComercial: resumo.custoComercial.toFixed(2),
    custoTotal: resumo.custoTotal.toFixed(2),
    coberturaPercentual: resumo.coberturaPercentual.toFixed(2),
    statusCobertura,
    criteriosSnapshot: JSON.stringify({ ...input.criteriosSnapshot, versao, geradoEm: agora.toISOString() }),
    criadoPor: input.criadoPor,
  });
  const calculoId = idInserido(insercao);
  if (input.componentes.length) {
    await tx.insert(componentesCalculosCustosGerenciais).values(input.componentes.map((item) => ({
      empresaId: input.empresaId,
      calculoId,
      categoriaCustoId: item.categoriaCustoId ?? null,
      itemRateioId: item.itemRateioId ?? null,
      lancamentoCustoId: item.lancamentoCustoId ?? null,
      tipo: item.tipo,
      origemTipo: item.origemTipo,
      origemId: item.origemId ?? null,
      valor: item.valor.toFixed(2),
      coberturaPercentual: item.coberturaPercentual.toFixed(2),
      memoriaCalculo: JSON.stringify(item.memoriaCalculo),
    })));
  }
  return { id: calculoId, versao, ...resumo, statusCobertura };
}

async function obterRateioVigente(tx: any, empresaId: number, competencia: Date) {
  const rateio = (await tx.select().from(rateiosCustosGerenciais).where(and(
    eq(rateiosCustosGerenciais.empresaId, empresaId),
    eq(rateiosCustosGerenciais.competencia, inicioCompetencia(competencia)),
    eq(rateiosCustosGerenciais.estado, "vigente"),
  )).limit(1))[0];
  if (!rateio) return { rateio: null, itens: [] as any[] };
  const itens = await tx.select({
    item: itensRateiosCustosGerenciais,
    categoria: categoriasCustosGerenciais,
    centro: centrosCustosGerenciais,
  }).from(itensRateiosCustosGerenciais)
    .innerJoin(categoriasCustosGerenciais, eq(categoriasCustosGerenciais.id, itensRateiosCustosGerenciais.categoriaCustoId))
    .innerJoin(centrosCustosGerenciais, eq(centrosCustosGerenciais.id, categoriasCustosGerenciais.centroCustoId))
    .where(and(eq(itensRateiosCustosGerenciais.empresaId, empresaId), eq(itensRateiosCustosGerenciais.rateioId, rateio.id)));
  return { rateio, itens };
}

function componentesRateioIndustrialPorVolume(itens: any[], volumeM3: number) {
  return itens
    .filter(({ item, centro }: any) => centro.codigo === "industrial" && item.baseApropriacao === "m3_produzido")
    .map(({ item, categoria }: any): ComponenteParaPersistencia => ({
      categoriaCustoId: categoria.id,
      itemRateioId: item.id,
      tipo: "industrial",
      origemTipo: "rateio_categoria",
      origemId: item.id,
      valor: Math.round((valorNumerico(item.fatorUnitario) * volumeM3 + Number.EPSILON) * 100) / 100,
      coberturaPercentual: valorNumerico(item.coberturaPercentual),
      memoriaCalculo: { baseApropriacao: item.baseApropriacao, fatorUnitario: valorNumerico(item.fatorUnitario), volumeAplicadoM3: volumeM3 },
    }));
}

export async function materializarCustoGerencialPorLote(input: { loteId: number; criadoPor: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const rastreio = await obterCustoMateriaPrimaRastreavelPorLote(input.loteId);
  return db.transaction(async (tx) => {
    const { rateio, itens } = await obterRateioVigente(tx, empresaId, rastreio.romaneio.dataProducao);
    const componentes: ComponenteParaPersistencia[] = [];
    if (rastreio.custoMateriaPrimaRastreavel !== null) {
      componentes.push({
        tipo: "materia_prima",
        origemTipo: "consumo_tora",
        origemId: rastreio.romaneio.id,
        valor: rastreio.custoMateriaPrimaRastreavel,
        coberturaPercentual: rastreio.coberturaPercentual,
        memoriaCalculo: { romaneioId: rastreio.romaneio.id, volumeLoteM3: rastreio.volumeM3, custoPorM3Produzido: rastreio.resumoRomaneio.custoPorM3Produzido, itensSemCusto: rastreio.resumoRomaneio.itensSemCusto },
      });
    }
    if (rastreio.participaDoDenominador) componentes.push(...componentesRateioIndustrialPorVolume(itens, rastreio.volumeM3));
    return persistirCalculoVersionado(tx, {
      empresaId,
      entidadeTipo: "lote",
      entidadeId: input.loteId,
      competencia: rastreio.romaneio.dataProducao,
      rateioId: rateio?.id ?? null,
      componentes,
      criteriosSnapshot: {
        fonteMateriaPrima: "romaneio_carga > plaqueta > consumo_tora > romaneio_producao > lote",
        romaneioProducaoId: rastreio.romaneio.id,
        statusMateriaPrima: rastreio.statusCobertura,
        volumeProduzidoBaseM3: rastreio.resumoRomaneio.volumeProduzidoBase,
        excluirTerceiros: true,
      },
      possuiVolume: rastreio.volumeM3 > 0,
      criadoPor: input.criadoPor,
    });
  });
}

export async function materializarCustoGerencialPorRomaneio(input: { romaneioId: number; criadoPor: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const rastreio = await obterCustoMateriaPrimaRastreavelPorRomaneio(input.romaneioId);
  return db.transaction(async (tx) => {
    const { rateio, itens } = await obterRateioVigente(tx, empresaId, rastreio.romaneio.dataProducao);
    const componentes: ComponenteParaPersistencia[] = [];
    if (rastreio.resumo.custoRastreavel > 0) {
      componentes.push({
        tipo: "materia_prima",
        origemTipo: "consumo_tora",
        origemId: rastreio.romaneio.id,
        valor: rastreio.resumo.custoRastreavel,
        coberturaPercentual: rastreio.resumo.coberturaPercentual,
        memoriaCalculo: { volumeConsumidoM3: rastreio.resumo.volumeConsumidoM3, volumeCobertoM3: rastreio.resumo.volumeCobertoM3, volumeSemCustoM3: rastreio.resumo.volumeSemCustoM3, itensSemCusto: rastreio.resumo.itensSemCusto },
      });
    }
    if (rastreio.resumo.volumeProduzidoBase > 0) componentes.push(...componentesRateioIndustrialPorVolume(itens, rastreio.resumo.volumeProduzidoBase));
    return persistirCalculoVersionado(tx, {
      empresaId,
      entidadeTipo: "romaneio_producao",
      entidadeId: input.romaneioId,
      competencia: rastreio.romaneio.dataProducao,
      rateioId: rateio?.id ?? null,
      componentes,
      criteriosSnapshot: {
        fonteMateriaPrima: "romaneio_carga > plaqueta > consumo_tora > romaneio_producao",
        statusMateriaPrima: rastreio.resumo.statusCobertura,
        volumeProduzidoBaseM3: rastreio.resumo.volumeProduzidoBase,
        excluirTerceiros: true,
        incluirAproveitamentoNoRendimento: rastreio.romaneio.incluirAproveitamentoNoRendimento,
      },
      possuiVolume: rastreio.resumo.volumeProduzidoBase > 0,
      criadoPor: input.criadoPor,
    });
  });
}

function proporcionalArredondado(valor: number | string | null, proporcao: number) {
  return Math.round((valorNumerico(valor) * proporcao + Number.EPSILON) * 100) / 100;
}

/**
 * Materializa o custo de uma venda apenas sobre a saída física líquida já registrada.
 * O volume histórico da movimentação é deliberadamente ignorado porque há registros
 * antigos com zero: o volume é reconstruído por quantidade e volume do lote de origem.
 */
export async function materializarCustoGerencialPorVenda(input: { vendaId: number; criadoPor: number }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const empresaId = (await getEmpresaUnica()).id;
  const venda = (await db.select({
    id: orcamentos.id,
    competencia: orcamentos.competencia,
    createdAt: orcamentos.createdAt,
    total: orcamentos.total,
    totalPecas: orcamentos.totalPecas,
    totalVolume: orcamentos.totalVolume,
    comissaoCalculada: orcamentos.comissaoCalculada,
  }).from(orcamentos).where(and(
    eq(orcamentos.id, input.vendaId),
    eq(orcamentos.empresaId, empresaId),
  )).limit(1))[0];
  if (!venda) throw new Error("Venda não encontrada.");

  const movimentos = await db.select({
    tipo: movimentacoesEstoqueSerrado.tipo,
    quantidade: movimentacoesEstoqueSerrado.quantidade,
    loteId: lotesPecasSerradas.id,
    propriedade: lotesPecasSerradas.propriedade,
    quantidadeProduzida: lotesPecasSerradas.quantidadeProduzida,
    volumeLote: lotesPecasSerradas.volume,
  }).from(movimentacoesEstoqueSerrado)
    .innerJoin(lotesPecasSerradas, and(
      eq(lotesPecasSerradas.id, movimentacoesEstoqueSerrado.loteId),
      eq(lotesPecasSerradas.empresaId, empresaId),
    ))
    .where(and(
      eq(movimentacoesEstoqueSerrado.empresaId, empresaId),
      eq(movimentacoesEstoqueSerrado.orcamentoId, input.vendaId),
    ));
  const lotesPorId = new Map<number, { loteId: number; quantidadeLiquida: number; quantidadeProduzida: number; volumeLote: number }>();
  for (const movimento of movimentos) {
    if (movimento.propriedade !== "proprio") continue;
    if (movimento.tipo !== "saida_entrega" && movimento.tipo !== "estorno_entrega") continue;
    const lote = lotesPorId.get(movimento.loteId) ?? {
      loteId: movimento.loteId,
      quantidadeLiquida: 0,
      quantidadeProduzida: movimento.quantidadeProduzida,
      volumeLote: valorNumerico(movimento.volumeLote),
    };
    lote.quantidadeLiquida += movimento.tipo === "saida_entrega" ? movimento.quantidade : -movimento.quantidade;
    lotesPorId.set(movimento.loteId, lote);
  }
  const lotesEntregues = Array.from(lotesPorId.values())
    .filter((lote) => lote.quantidadeLiquida > 0 && lote.quantidadeProduzida > 0);
  const idsLotes = lotesEntregues.map((lote) => lote.loteId);
  const calculosLotes = idsLotes.length ? await db.select().from(calculosCustosGerenciais).where(and(
    eq(calculosCustosGerenciais.empresaId, empresaId),
    eq(calculosCustosGerenciais.entidadeTipo, "lote"),
    eq(calculosCustosGerenciais.estado, "vigente"),
    inArray(calculosCustosGerenciais.entidadeId, idsLotes),
  )) : [];
  const calculoLotePorId = new Map(calculosLotes.map((calculo) => [calculo.entidadeId, calculo]));
  const semCalculo = lotesEntregues.filter((lote) => !calculoLotePorId.has(lote.loteId)).map((lote) => lote.loteId);
  if (semCalculo.length) throw new Error(`Calcule primeiro o custo dos lotes entregues: ${semCalculo.join(", ")}.`);

  const volumeVendidoM3 = lotesEntregues.reduce((soma, lote) => soma + (lote.volumeLote * lote.quantidadeLiquida) / lote.quantidadeProduzida, 0);
  const quantidadeVendida = lotesEntregues.reduce((soma, lote) => soma + lote.quantidadeLiquida, 0);
  const proporcaoReceita = valorNumerico(venda.totalVolume) > 0
    ? Math.min(1, volumeVendidoM3 / valorNumerico(venda.totalVolume))
    : venda.totalPecas > 0 ? Math.min(1, quantidadeVendida / venda.totalPecas) : 0;
  const receitaVendida = proporcionalArredondado(venda.total, proporcaoReceita);
  const competencia = inicioCompetencia(competenciaDaVenda(venda));

  return db.transaction(async (tx) => {
    const { rateio, itens } = await obterRateioVigente(tx, empresaId, competencia);
    const componentes: ComponenteParaPersistencia[] = [];
    for (const lote of lotesEntregues) {
      const calculo = calculoLotePorId.get(lote.loteId)!;
      const proporcaoLote = lote.quantidadeLiquida / lote.quantidadeProduzida;
      const parcelas: Array<[TipoComponenteCusto, string]> = [
        ["materia_prima", calculo.custoMateriaPrima],
        ["industrial", calculo.custoIndustrial],
        ["administrativo", calculo.custoAdministrativo],
        ["comercial", calculo.custoComercial],
      ];
      for (const [tipo, valor] of parcelas) {
        const valorProporcional = proporcionalArredondado(valor, proporcaoLote);
        if (valorProporcional <= 0) continue;
        componentes.push({
          tipo,
          origemTipo: "consumo_tora",
          origemId: calculo.id,
          valor: valorProporcional,
          coberturaPercentual: valorNumerico(calculo.coberturaPercentual),
          memoriaCalculo: {
            calculoLoteId: calculo.id,
            loteId: lote.loteId,
            versaoCalculoLote: calculo.versao,
            quantidadeEntregue: lote.quantidadeLiquida,
            quantidadeProduzida: lote.quantidadeProduzida,
            proporcaoLote,
          },
        });
      }
    }
    const baseComercial: Record<string, number> = {
      m3_vendido: volumeVendidoM3,
      valor_vendido: receitaVendida,
      quantidade_vendida: quantidadeVendida,
      pedido: quantidadeVendida > 0 ? 1 : 0,
      carga: 0,
      percentual_receita: receitaVendida,
    };
    for (const { item, categoria, centro } of itens as any[]) {
      if (centro.codigo !== "comercial_administrativo") continue;
      const baseAplicada = baseComercial[item.baseApropriacao] ?? 0;
      const valor = proporcionalArredondado(item.fatorUnitario, baseAplicada);
      if (valor <= 0) continue;
      componentes.push({
        categoriaCustoId: categoria.id,
        itemRateioId: item.id,
        tipo: "administrativo",
        origemTipo: "rateio_categoria",
        origemId: item.id,
        valor,
        coberturaPercentual: valorNumerico(item.coberturaPercentual),
        memoriaCalculo: { baseApropriacao: item.baseApropriacao, baseAplicada, fatorUnitario: valorNumerico(item.fatorUnitario), rateioId: rateio?.id ?? null },
      });
    }
    const lancamentosDiretos = await tx.select({ lancamento: lancamentosCustosGerenciais, categoria: categoriasCustosGerenciais }).from(lancamentosCustosGerenciais)
      .innerJoin(categoriasCustosGerenciais, eq(categoriasCustosGerenciais.id, lancamentosCustosGerenciais.categoriaCustoId))
      .where(and(
        eq(lancamentosCustosGerenciais.empresaId, empresaId),
        eq(lancamentosCustosGerenciais.orcamentoId, input.vendaId),
        eq(lancamentosCustosGerenciais.origem, "venda_direta"),
        eq(lancamentosCustosGerenciais.estado, "ativo"),
        eq(categoriasCustosGerenciais.tipo, "direto_venda"),
      ));
    for (const { lancamento, categoria } of lancamentosDiretos as any[]) {
      const valor = calcularValorLancamentoCusto(lancamento, receitaVendida);
      if (valor <= 0) continue;
      componentes.push({
        categoriaCustoId: categoria.id,
        lancamentoCustoId: lancamento.id,
        tipo: "direto_venda",
        origemTipo: "lancamento_direto",
        origemId: lancamento.id,
        valor,
        coberturaPercentual: 100,
        memoriaCalculo: { unidadeValor: lancamento.unidadeValor, valorInformado: valorNumerico(lancamento.valor), receitaAplicada: receitaVendida, competenciaOriginal: lancamento.competenciaOriginal?.toISOString() ?? null, justificativaCompetencia: lancamento.justificativaCompetencia ?? null },
      });
    }
    const categoriasComissao = await tx.select().from(categoriasCustosGerenciais).where(and(
      eq(categoriasCustosGerenciais.empresaId, empresaId),
      eq(categoriasCustosGerenciais.ativo, true),
      eq(categoriasCustosGerenciais.tipo, "direto_venda"),
      eq(categoriasCustosGerenciais.incluirComissaoVendaAutomatica, true),
    ));
    if (categoriasComissao.length > 1) throw new Error("Há mais de uma categoria ativa autorizada para comissão automática.");
    const comissao = proporcionalArredondado(venda.comissaoCalculada, proporcaoReceita);
    if (categoriasComissao[0] && comissao > 0) {
      componentes.push({
        categoriaCustoId: categoriasComissao[0].id,
        tipo: "comissao",
        origemTipo: "venda",
        origemId: input.vendaId,
        valor: comissao,
        coberturaPercentual: 100,
        memoriaCalculo: { fonte: "orcamentos.comissaoCalculada", categoriaAutorizadaExplicitamente: true, proporcaoReceita, comissaoIntegral: valorNumerico(venda.comissaoCalculada) },
      });
    }
    return persistirCalculoVersionado(tx, {
      empresaId,
      entidadeTipo: "venda",
      entidadeId: input.vendaId,
      competencia,
      rateioId: rateio?.id ?? null,
      componentes,
      criteriosSnapshot: {
        fonteEstoque: "movimentacoesEstoqueSerrado.saida_entrega - estorno_entrega",
        volumeHistoricoDaMovimentacaoIgnorado: true,
        volumeReconstruidoPorQuantidadeELote: true,
        lotesEntregues: lotesEntregues.map((lote) => ({ loteId: lote.loteId, quantidadeLiquida: lote.quantidadeLiquida, quantidadeProduzida: lote.quantidadeProduzida })),
        receitaVendaTotal: valorNumerico(venda.total),
        receitaVendida,
        proporcaoReceita,
        freteComercialSoPorCategoriaOuLancamentoExplicito: true,
        comissaoSoComCategoriaExplicita: Boolean(categoriasComissao[0] && comissao > 0),
      },
      possuiVolume: volumeVendidoM3 > 0 || quantidadeVendida > 0,
      criadoPor: input.criadoPor,
    });
  });
}

export async function listarCalculosCustosGerenciais(input?: {
  entidadeTipo?: EntidadeCalculoCusto;
  entidadeId?: number;
  competencia?: Date;
  incluirSubstituidos?: boolean;
}) {
  const db = await getDb();
  if (!db) return [];
  const empresaId = (await getEmpresaUnica()).id;
  const condicoes = [eq(calculosCustosGerenciais.empresaId, empresaId)];
  if (input?.entidadeTipo) condicoes.push(eq(calculosCustosGerenciais.entidadeTipo, input.entidadeTipo));
  if (input?.entidadeId) condicoes.push(eq(calculosCustosGerenciais.entidadeId, input.entidadeId));
  if (input?.competencia) condicoes.push(eq(calculosCustosGerenciais.competencia, inicioCompetencia(input.competencia)));
  if (!input?.incluirSubstituidos) condicoes.push(eq(calculosCustosGerenciais.estado, "vigente"));
  const calculos = await db.select().from(calculosCustosGerenciais)
    .where(and(...condicoes))
    .orderBy(desc(calculosCustosGerenciais.competencia), desc(calculosCustosGerenciais.versao));
  if (!calculos.length) return [];
  const componentes = await db.select().from(componentesCalculosCustosGerenciais).where(and(
    eq(componentesCalculosCustosGerenciais.empresaId, empresaId),
    inArray(componentesCalculosCustosGerenciais.calculoId, calculos.map((calculo) => calculo.id)),
  )).orderBy(asc(componentesCalculosCustosGerenciais.id));
  const porCalculo = new Map<number, typeof componentesCalculosCustosGerenciais.$inferSelect[]>();
  for (const componente of componentes) {
    const lista = porCalculo.get(componente.calculoId) ?? [];
    lista.push(componente);
    porCalculo.set(componente.calculoId, lista);
  }
  return calculos.map((calculo) => ({ ...calculo, componentes: porCalculo.get(calculo.id) ?? [] }));
}
