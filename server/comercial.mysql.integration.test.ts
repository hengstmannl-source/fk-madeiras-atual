import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDb } from "./repositories/core";
import { orcamentoRouter } from "./routers/orcamento";
import {
  aproveitamentosOrcamento,
  bitolas,
  categoriasFinanceiras,
  clientes,
  componentesPacoteOrcamento,
  empresas,
  historicoAlteracoes,
  itensOrcamento,
  madeiras,
  orcamentos,
  produtosComerciais,
  sequenciasDocumentos,
  sequenciasVendas,
  taxasAdicionaisOrcamento,
  titulosFinanceiros,
  reservasEstoqueVenda,
  ciclosEntrega,
  revisoesVendas,
  ajustesFinanceirosVenda,
  movimentacoesEstoqueSerrado,
} from "../drizzle/schema";
import { createOrcamentoComercialCalculado, getOrcamentoById, getOrcamentoWithItems } from "./repositories/vendas";
import { prepararNovaVendaComercial } from "./comercial.adapter";
import { prepararPersistenciaNovaOperacaoComercial } from "./comercial.persistence";
import type { TrpcContext } from "./_core/context";

const integrationEnabled = process.env.FK_MYSQL_INTEGRATION === "1";
const expectedDatabase = "fkmadeiras_phase2b7a";
const expectedHost = "127.0.0.1";
const expectedPort = "13306";
const userId = 7;

function validarDestinoExclusivamenteDescartavel(): void {
  if (!integrationEnabled) throw new Error("Defina FK_MYSQL_INTEGRATION=1 somente para o MySQL descartável");
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL temporária obrigatória");
  const url = new URL(rawUrl);
  if (url.hostname !== expectedHost || url.port !== expectedPort || url.pathname !== `/${expectedDatabase}`) {
    throw new Error("Destino MySQL recusado: host, porta ou banco não correspondem ao ambiente descartável autorizado");
  }
  if (url.username !== "root") throw new Error("A integração exige somente a conta sintética root do container descartável");
}

function contexto(empresaId: number): TrpcContext {
  const now = new Date();
  return {
    user: {
      id: userId,
      openId: "mysql-integration-synthetic",
      name: "Usuário Sintético",
      email: "mysql-integration@example.invalid",
      loginMethod: "local",
      role: "user",
      papel: "proprietario",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    },
    configuracaoEmpresa: { id: empresaId, nome: "FK Madeiras — Teste Sintético", ativa: true },
  } as unknown as TrpcContext;
}

function itemM3(madeiraId: number, bitolaId: number) {
  return {
    madeiraId,
    bitolaId,
    produtoComercialId: null,
    madeiraNome: "Cedrinho sintético",
    bitolaDescricao: "18 x 100 mm",
    espessura: "18.00",
    largura: "100.00",
    comprimento: "2.40",
    quantidade: 2,
    tipoComercializacao: "metro_cubico" as const,
    unidadesPorComercializacao: 0,
    precoM3: "18000.00",
    precoLinear: "999.9999",
    valorPeca: "999.99",
    valorTotal: "999999.99",
    componentesPacote: [],
  };
}

function itemUnidade(produtoComercialId: number) {
  return {
    madeiraId: null,
    bitolaId: null,
    produtoComercialId,
    madeiraNome: "Produto unitário sintético",
    bitolaDescricao: "Venda por unidade",
    espessura: "0",
    largura: "0",
    comprimento: "0",
    quantidade: 2,
    tipoComercializacao: "unidade" as const,
    unidadesPorComercializacao: 1,
    precoM3: "79.07",
    precoLinear: "0",
    valorPeca: "0",
    valorTotal: "0",
    componentesPacote: [],
  };
}

function itemPacote(produtoComercialId: number) {
  return {
    madeiraId: null,
    bitolaId: null,
    produtoComercialId,
    madeiraNome: "Pacote sintético",
    bitolaDescricao: "Venda por pacote",
    espessura: "0",
    largura: "0",
    comprimento: "0",
    quantidade: 2,
    tipoComercializacao: "pacote" as const,
    unidadesPorComercializacao: 999,
    precoM3: "5.55",
    precoLinear: "0",
    valorPeca: "0",
    valorTotal: "0",
    componentesPacote: [
      { descricao: "Componente A", madeiraNome: "Cedrinho", espessura: "2.00", largura: "5.00", comprimento: "3.00", quantidade: 2 },
      { descricao: "Componente B", madeiraNome: null, espessura: null, largura: null, comprimento: null, quantidade: 1 },
    ],
  };
}

function payload(input: {
  clienteId: number;
  madeiraId: number;
  bitolaId: number;
  produtoUnidadeId: number;
  produtoPacoteId: number;
  duplicadoDeId?: number;
}) {
  return {
    clienteId: input.clienteId,
    ...(input.duplicadoDeId === undefined ? {} : { duplicadoDeId: input.duplicadoDeId }),
    estado: "rascunho" as const,
    tipoVenda: "externa" as const,
    desconto: "1.00",
    frete: "777.77",
    fretePorTonelada: "0.02",
    pesoCargaToneladas: "0.250",
    abatimentoFrete: "777.77",
    baseAposFrete: "777.77",
    comissaoTipo: "percentual" as const,
    comissaoValor: "10.00",
    comissaoCalculada: "777.77",
    taxaTipo: "percentual" as const,
    taxaValor: "0",
    taxaCalculada: "777.77",
    taxasAdicionais: [
      { descricao: "Taxa fixa sintética", tipo: "fixo" as const, valor: "0.02", calculado: "777.77" },
      { descricao: "Taxa percentual sintética", tipo: "percentual" as const, valor: "1.0000", calculado: "777.77" },
    ],
    subtotal: "999999.99",
    total: "999999.99",
    totalPecas: 999999,
    totalMetroLinear: "999999.9999",
    totalVolume: "999999.999999",
    observacoes: "Registro sintético de integração",
    vendedor: "Teste automatizado",
    dataVencimento: "2026-11-30",
    competencia: "2026-11-01",
    itens: [
      itemM3(input.madeiraId, input.bitolaId),
      itemUnidade(input.produtoUnidadeId),
      itemPacote(input.produtoPacoteId),
    ],
    aproveitamentos: [{ madeiraNome: "Aproveitamento sintético", volume: "0.250", precoM3: "0.02" }],
  };
}

const integration = integrationEnabled ? describe : describe.skip;

integration("integração de persistência comercial em MySQL 8.4 descartável", () => {
  let database: Awaited<ReturnType<typeof getDb>>;
  let empresaId: number;
  let clienteId: number;
  let madeiraId: number;
  let bitolaId: number;
  let produtoUnidadeId: number;
  let produtoPacoteId: number;
  let disposePool: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    validarDestinoExclusivamenteDescartavel();
    database = await getDb();
    if (!database) throw new Error("Conexão ao MySQL descartável indisponível");
    const client = (database as unknown as { $client?: { end: () => Promise<void> } }).$client;
    if (client) disposePool = () => client.end();

    // O banco é descartável; limpar somente estas tabelas permite reexecutar o
    // teste sem depender de estado deixado por uma execução de teste anterior.
    await database.delete(titulosFinanceiros);
    await database.delete(ajustesFinanceirosVenda);
    await database.delete(revisoesVendas);
    await database.delete(ciclosEntrega);
    await database.delete(reservasEstoqueVenda);
    await database.delete(categoriasFinanceiras);
    await database.delete(sequenciasVendas);
    await database.delete(sequenciasDocumentos);
    await database.delete(historicoAlteracoes);
    await database.delete(taxasAdicionaisOrcamento);
    await database.delete(aproveitamentosOrcamento);
    await database.delete(componentesPacoteOrcamento);
    await database.delete(itensOrcamento);
    await database.delete(orcamentos);
    await database.delete(produtosComerciais);
    await database.delete(bitolas);
    await database.delete(madeiras);
    await database.delete(clientes);
    await database.delete(empresas);

    empresaId = Number((await database.insert(empresas).values({ nome: "FK Madeiras — Teste Sintético", ativa: true }))[0].insertId);
    clienteId = Number((await database.insert(clientes).values({ empresaId, nome: "Cliente Sintético", criadoPor: userId }))[0].insertId);
    madeiraId = Number((await database.insert(madeiras).values({ empresaId, nome: "Cedrinho sintético", precoM3: "18000.00", criadoPor: userId }))[0].insertId);
    bitolaId = Number((await database.insert(bitolas).values({ empresaId, madeiraId, espessura: "18.00", largura: "100.00", comprimento: "240.00", criadoPor: userId }))[0].insertId);
    produtoUnidadeId = Number((await database.insert(produtosComerciais).values({ empresaId, nome: "Produto unitário sintético", tipoComercializacao: "unidade", precoPadrao: "79.07", criadoPor: userId }))[0].insertId);
    produtoPacoteId = Number((await database.insert(produtosComerciais).values({ empresaId, nome: "Pacote sintético", tipoComercializacao: "pacote", precoPadrao: "5.55", criadoPor: userId }))[0].insertId);
  }, 30_000);

  afterAll(async () => {
    await disposePool?.();
  });

  it("persiste cálculo autoritativo de m³, unidade, pacote, aproveitamento e ajustes; aprova e cria recebível idempotente", async () => {
    const caller = orcamentoRouter.createCaller(contexto(empresaId));
    const input = payload({ clienteId, madeiraId, bitolaId, produtoUnidadeId, produtoPacoteId });
    const created = await caller.create(input);
    const saved = await getOrcamentoWithItems(created.id);
    expect(saved).toBeDefined();
    expect(saved?.orcamento).toMatchObject({
      subtotal: "324.77",
      total: "294.64",
      desconto: "1.00",
      frete: "0.01",
      abatimentoFrete: "0.01",
      baseAposFrete: "323.76",
      comissaoCalculada: "32.38",
      taxaCalculada: "3.26",
      versaoCalculoComercial: 1,
      estado: "rascunho",
    });
    expect(saved?.itens.map((item) => [item.tipoComercializacao, item.valorPeca, item.valorTotal])).toEqual([
      ["metro_cubico", "77.76", "155.52"],
      ["unidade", "79.07", "158.14"],
      ["pacote", "5.55", "11.10"],
    ]);
    expect(saved?.itens[2].componentesPacote).toHaveLength(2);
    expect(saved?.itens[2].unidadesPorComercializacao).toBe(3);
    expect(saved?.aproveitamentos).toMatchObject([{ volume: "0.250", precoM3: "0.02", valorTotal: "0.01" }]);
    expect(saved?.taxasAdicionais.map((taxa) => [taxa.tipo, taxa.valor, taxa.calculado])).toEqual([
      ["fixo", "0.0200", "0.02"],
      ["percentual", "1.0000", "3.24"],
    ]);

    await caller.updateEstado({ id: created.id, estado: "aprovado" });
    const approved = await getOrcamentoById(created.id);
    expect(approved).toMatchObject({ estado: "aprovado", total: "294.64", versaoCalculoComercial: 1 });
    const receivables = await database!.select().from(titulosFinanceiros).where((await import("drizzle-orm")).eq(titulosFinanceiros.orcamentoId, created.id));
    expect(receivables).toHaveLength(1);
    expect(receivables[0]).toMatchObject({ origem: "orcamento", tipo: "receber", valorOriginal: "294.64", estado: "aberto" });
  }, 30_000);

  it("rejeita referências inválidas sem persistência parcial e cria vendas internas", async () => {
    const caller = orcamentoRouter.createCaller(contexto(empresaId));
    const before = await database!.select().from(orcamentos);
    await expect(caller.create(payload({ clienteId: 999_991, madeiraId, bitolaId, produtoUnidadeId, produtoPacoteId }))).rejects.toBeTruthy();
    await expect(caller.create(payload({ clienteId, madeiraId: 999_992, bitolaId, produtoUnidadeId, produtoPacoteId }))).rejects.toBeTruthy();
    const mismatched = payload({ clienteId, madeiraId, bitolaId, produtoUnidadeId, produtoPacoteId });
    mismatched.itens[2].produtoComercialId = produtoUnidadeId;
    await expect(caller.create(mismatched)).rejects.toBeTruthy();
    const interna = await caller.create({ ...payload({ clienteId, madeiraId, bitolaId, produtoUnidadeId, produtoPacoteId }), tipoVenda: "interna" });
    const internaSalva = await getOrcamentoWithItems(interna.id);
    expect(internaSalva?.orcamento).toMatchObject({ tipoVenda: "interna", estado: "rascunho", versaoCalculoComercial: 1 });
    await caller.updateEstado({ id: interna.id, estado: "aprovado" });
    const reservas = await database!.select().from(reservasEstoqueVenda).where((await import("drizzle-orm")).eq(reservasEstoqueVenda.orcamentoId, interna.id));
    expect(reservas).toHaveLength(1);
    expect(reservas[0]).toMatchObject({ tipoComercializacao: "metro_cubico", unidadeMedida: "peca", estado: "reservada" });
    const internaTitles = await database!.select().from(titulosFinanceiros).where((await import("drizzle-orm")).eq(titulosFinanceiros.orcamentoId, interna.id));
    expect(internaTitles).toHaveLength(1);
    expect(internaTitles[0].valorOriginal).toBe(internaSalva?.orcamento.total);
    expect(await database!.select().from(orcamentos)).toHaveLength(before.length + 1);
  }, 30_000);

  it("revisa venda interna, ajusta recebível, baixa somente m³ e estorna somente o ciclo", async () => {
    const caller = orcamentoRouter.createCaller(contexto(empresaId));
    const created = await caller.create({ ...payload({ clienteId, madeiraId, bitolaId, produtoUnidadeId, produtoPacoteId }), tipoVenda: "interna" });
    await caller.updateEstado({ id: created.id, estado: "aprovado" });
    const originalTitle = (await database!.select().from(titulosFinanceiros).where((await import("drizzle-orm")).eq(titulosFinanceiros.orcamentoId, created.id)))[0];
    const revisionInput = payload({ clienteId, madeiraId, bitolaId, produtoUnidadeId, produtoPacoteId });
    revisionInput.itens[0].precoM3 = "19000.00";
    const revised = await caller.revisarInterna({ id: created.id, versaoComercialEsperada: 1, motivo: "Correção de preço acordada", ...revisionInput });
    expect(revised).toMatchObject({ success: true, versaoComercial: 2 });
    const revisionRecord = (await database!.select().from(revisoesVendas).where((await import("drizzle-orm")).eq(revisoesVendas.id, revised.revisaoId)))[0];
    const snapshotNovo = typeof revisionRecord.snapshotNovo === "string" ? JSON.parse(revisionRecord.snapshotNovo) : revisionRecord.snapshotNovo;
    expect(snapshotNovo.itens[2].componentesPacote).toHaveLength(2);
    const saleAfterRevision = await getOrcamentoById(created.id);
    expect(saleAfterRevision?.versaoComercial).toBe(2);
    expect(saleAfterRevision?.total).not.toBe(originalTitle.valorOriginal);
    const titlesAfterRevision = await database!.select().from(titulosFinanceiros).where((await import("drizzle-orm")).eq(titulosFinanceiros.orcamentoId, created.id));
    expect(titlesAfterRevision.reduce((sum, title) => sum + Math.round(Number(title.valorOriginal) * 100), 0)).toBe(Math.round(Number(saleAfterRevision?.total) * 100));
    expect(await database!.select().from(ajustesFinanceirosVenda).where((await import("drizzle-orm")).eq(ajustesFinanceirosVenda.orcamentoId, created.id))).toHaveLength(1);
    const reservasAtivas = await database!.select().from(reservasEstoqueVenda).where((await import("drizzle-orm")).and(
      (await import("drizzle-orm")).eq(reservasEstoqueVenda.orcamentoId, created.id),
      (await import("drizzle-orm")).eq(reservasEstoqueVenda.estado, "reservada"),
    ));
    expect(reservasAtivas).toHaveLength(1);

    await caller.entregarFisicamente({ id: created.id, entregueEm: "2026-11-05", modalidadeEntrega: "retirada", responsavelEntrega: "Operador sintético", aproveitamentos: [] });
    const ciclo = (await database!.select().from(ciclosEntrega).where((await import("drizzle-orm")).eq(ciclosEntrega.orcamentoId, created.id)))[0];
    expect(ciclo?.estado).toBe("entregue");
    const saidasCiclo = await database!.select().from(movimentacoesEstoqueSerrado).where((await import("drizzle-orm")).and(
      (await import("drizzle-orm")).eq(movimentacoesEstoqueSerrado.cicloEntregaId, ciclo.id),
      (await import("drizzle-orm")).eq(movimentacoesEstoqueSerrado.tipo, "saida_entrega"),
    ));
    expect(saidasCiclo).toHaveLength(1);
    expect(saidasCiclo[0].quantidade).toBe(2);
    expect(reservasAtivas.map((reserva) => reserva.tipoComercializacao)).toEqual(["metro_cubico"]);

    await caller.estornarEntrega({ id: created.id, motivo: "Mercadoria retornou ao depósito", confirmacaoMercadoriaNoDeposito: true });
    const cicloEstornado = (await database!.select().from(ciclosEntrega).where((await import("drizzle-orm")).eq(ciclosEntrega.id, ciclo.id)))[0];
    expect(cicloEstornado?.estado).toBe("estornado");
    const reversoes = await database!.select().from(movimentacoesEstoqueSerrado).where((await import("drizzle-orm")).and(
      (await import("drizzle-orm")).eq(movimentacoesEstoqueSerrado.cicloEntregaId, ciclo.id),
      (await import("drizzle-orm")).eq(movimentacoesEstoqueSerrado.tipo, "estorno_entrega"),
    ));
    expect(reversoes).toHaveLength(saidasCiclo.length);
    const reservasRestauradas = await database!.select().from(reservasEstoqueVenda).where((await import("drizzle-orm")).and(
      (await import("drizzle-orm")).eq(reservasEstoqueVenda.orcamentoId, created.id),
      (await import("drizzle-orm")).eq(reservasEstoqueVenda.versaoComercial, 2),
      (await import("drizzle-orm")).eq(reservasEstoqueVenda.estado, "reservada"),
    ));
    expect(reservasRestauradas).toHaveLength(1);
  }, 30_000);

  it("reverte cabeçalho e itens quando o segundo INSERT viola o limite DECIMAL do MySQL", async () => {
    const before = await database!.select().from(orcamentos);
    const adapted = prepararNovaVendaComercial("externa", {
      clienteId,
      desconto: "0.00",
      fretePorTonelada: "0.00",
      pesoCargaToneladas: "0.000",
      comissaoTipo: "fixo",
      comissaoValor: "0.00",
      itens: [
        { ...itemM3(madeiraId, bitolaId), quantidade: 1 },
        { ...itemM3(madeiraId, bitolaId), quantidade: 1 },
      ],
    });
    const prepared = prepararPersistenciaNovaOperacaoComercial(adapted, {
      empresaId,
      criadoPor: userId,
      estado: "rascunho",
      observacoes: null,
      vendedor: "Rollback sintético",
      dataValidade: null,
      dataVencimento: new Date("2026-11-30T12:00:00Z"),
      competencia: new Date("2026-11-01T12:00:00Z"),
    });
    prepared.itens[1].valorTotal = "99999999999.99";
    await expect(createOrcamentoComercialCalculado(prepared)).rejects.toBeTruthy();
    expect(await database!.select().from(orcamentos)).toHaveLength(before.length);
  }, 30_000);

  it("preserva orçamento legado ao ler e duplicar, recalculando somente o novo registro", async () => {
    const legacyId = Number((await database!.insert(orcamentos).values({
      empresaId,
      clienteId,
      estado: "rascunho",
      subtotal: "999.99",
      total: "999.99",
      versaoCalculoComercial: null,
      observacoes: "Snapshot legado sintético",
      criadoPor: userId,
    }))[0].insertId);
    const before = await getOrcamentoById(legacyId);
    expect(before).toMatchObject({ total: "999.99", versaoCalculoComercial: null });

    const copied = await orcamentoRouter.createCaller(contexto(empresaId)).create(payload({
      clienteId,
      madeiraId,
      bitolaId,
      produtoUnidadeId,
      produtoPacoteId,
      duplicadoDeId: legacyId,
    }));
    const after = await getOrcamentoById(legacyId);
    const newRecord = await getOrcamentoById(copied.id);
    expect(after).toMatchObject({ total: "999.99", versaoCalculoComercial: null });
    expect(newRecord).toMatchObject({ total: "294.64", versaoCalculoComercial: 1, estado: "rascunho" });
  }, 30_000);
});
