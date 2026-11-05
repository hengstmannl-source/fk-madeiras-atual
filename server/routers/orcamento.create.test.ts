import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const dbMocks = vi.hoisted(() => ({
  getOrcamentoById: vi.fn(),
  createOrcamentoComercialCalculado: vi.fn(),
  updateOrcamentoEstado: vi.fn(),
}));

vi.mock("../db", () => dbMocks);
vi.mock("../repositories/referencias", () => ({ validarReferenciasEmpresa: vi.fn() }));

import { orcamentoRouter } from "./orcamento";

const contexto = {
  user: {
    id: 77,
    openId: "teste-duplicacao",
    name: "Usuário de Teste",
    email: "teste@example.com",
    loginMethod: "local",
    role: "user",
    papel: "proprietario",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  configuracaoEmpresa: { id: 1, nome: "FK Madeiras", ativa: true },
} as unknown as TrpcContext;

function entradaCreate(overrides: Record<string, unknown> = {}) {
  return {
    clienteId: 5,
    estado: "rascunho" as const,
    desconto: "0",
    frete: "0",
    fretePorTonelada: "0",
    pesoCargaToneladas: "0",
    abatimentoFrete: "0",
    baseAposFrete: "0",
    comissaoTipo: "percentual" as const,
    comissaoValor: "0",
    comissaoCalculada: "0",
    taxaTipo: "percentual" as const,
    taxaValor: "0",
    taxaCalculada: "0",
    subtotal: "0",
    total: "0",
    totalPecas: 0,
    totalMetroLinear: "0",
    totalVolume: "0",
    itens: [{
      madeiraId: null,
      bitolaId: null,
      produtoComercialId: null,
      madeiraNome: "Cedrinho",
      bitolaDescricao: "18 × 100 mm",
      espessura: "18",
      largura: "100",
      comprimento: "2.40",
      quantidade: 2,
      tipoComercializacao: "metro_cubico" as const,
      unidadesPorComercializacao: 0,
      precoM3: "18000.00",
      precoLinear: "999.9999",
      valorPeca: "999.99",
      valorTotal: "1999.98",
      componentesPacote: [],
    }],
    aproveitamentos: [],
    ...overrides,
  };
}

describe("orcamento.create — cálculo autoritativo e integridade da duplicação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.getOrcamentoById.mockResolvedValue({ id: 41, empresaId: 1, estado: "rascunho", pago: false });
    dbMocks.createOrcamentoComercialCalculado.mockResolvedValue({ id: 90 });
    dbMocks.updateOrcamentoEstado.mockResolvedValue({ success: true });
  });

  it("mantém a cópia em rascunho mesmo se o cliente solicitar aprovação", async () => {
    dbMocks.getOrcamentoById.mockResolvedValue({ id: 41, empresaId: 1, estado: "aprovado", pago: false });

    await orcamentoRouter.createCaller(contexto).create(entradaCreate({ duplicadoDeId: 41, estado: "aprovado" }));

    expect(dbMocks.createOrcamentoComercialCalculado).toHaveBeenCalledWith(expect.objectContaining({
      cabecalho: expect.objectContaining({ estado: "rascunho", criadoPor: 77, empresaId: 1, versaoCalculoComercial: 1 }),
    }));
    expect(dbMocks.updateOrcamentoEstado).not.toHaveBeenCalled();
  });

  it("mantém em rascunho uma cópia cujo cliente já solicitou rascunho", async () => {
    await orcamentoRouter.createCaller(contexto).create(entradaCreate({ duplicadoDeId: 41, estado: "rascunho" }));

    expect(dbMocks.createOrcamentoComercialCalculado).toHaveBeenCalledWith(expect.objectContaining({ cabecalho: expect.objectContaining({ estado: "rascunho" }) }));
    expect(dbMocks.updateOrcamentoEstado).not.toHaveBeenCalled();
  });

  it("não herda aprovação da origem nem aprova a cópia", async () => {
    dbMocks.getOrcamentoById.mockResolvedValue({ id: 41, empresaId: 1, estado: "aprovado", pago: false });

    await orcamentoRouter.createCaller(contexto).create(entradaCreate({ duplicadoDeId: 41 }));

    expect(dbMocks.createOrcamentoComercialCalculado).toHaveBeenCalledWith(expect.objectContaining({ cabecalho: expect.objectContaining({ estado: "rascunho" }) }));
    expect(dbMocks.updateOrcamentoEstado).not.toHaveBeenCalled();
  });

  it("não herda pagamento da origem nem gera uma transição financeira para a cópia", async () => {
    dbMocks.getOrcamentoById.mockResolvedValue({ id: 41, empresaId: 1, estado: "aprovado", pago: true });

    await orcamentoRouter.createCaller(contexto).create(entradaCreate({ duplicadoDeId: 41 }));

    expect(dbMocks.createOrcamentoComercialCalculado).toHaveBeenCalledWith(expect.objectContaining({ cabecalho: expect.objectContaining({ estado: "rascunho", criadoPor: 77 }) }));
    expect(dbMocks.updateOrcamentoEstado).not.toHaveBeenCalled();
  });

  it("preserva a aprovação solicitada no fluxo manual sem duplicação", async () => {
    await orcamentoRouter.createCaller(contexto).create(entradaCreate({ estado: "aprovado" }));

    expect(dbMocks.getOrcamentoById).not.toHaveBeenCalled();
    expect(dbMocks.createOrcamentoComercialCalculado).toHaveBeenCalledWith(expect.objectContaining({ cabecalho: expect.objectContaining({ estado: "rascunho", criadoPor: 77 }) }));
    expect(dbMocks.updateOrcamentoEstado).toHaveBeenCalledOnce();
    expect(dbMocks.updateOrcamentoEstado).toHaveBeenCalledWith(90, "aprovado", 77);
  });

  it("preserva criação manual normal como rascunho sem transição de aprovação", async () => {
    await orcamentoRouter.createCaller(contexto).create(entradaCreate());

    expect(dbMocks.createOrcamentoComercialCalculado).toHaveBeenCalledWith(expect.objectContaining({ cabecalho: expect.objectContaining({ estado: "rascunho" }) }));
    expect(dbMocks.updateOrcamentoEstado).not.toHaveBeenCalled();
  });

  it("ignora totais e valores derivados forjados pelo cliente e grava a versão corrigida", async () => {
    await orcamentoRouter.createCaller(contexto).create(entradaCreate({
      subtotal: "1.00",
      total: "2.00",
      totalPecas: 999,
      totalMetroLinear: "999.00",
      totalVolume: "999.0000",
      abatimentoFrete: "888.00",
      baseAposFrete: "777.00",
      comissaoCalculada: "666.00",
      itens: [{
        ...entradaCreate().itens[0],
        precoLinear: "999.9999",
        valorPeca: "999.99",
        valorTotal: "1999.98",
      }],
    }));

    expect(dbMocks.createOrcamentoComercialCalculado).toHaveBeenCalledWith(expect.objectContaining({
      cabecalho: expect.objectContaining({
        versaoCalculoComercial: 1,
        subtotal: "155.52",
        total: "155.52",
        totalPecas: 2,
      }),
      itens: [expect.objectContaining({
        precoLinear: "32.4000",
        valorPeca: "77.76",
        valorTotal: "155.52",
      })],
    }));
  });

  it("cria venda interna pelo mesmo cálculo autoritativo e mantém versão corrigida", async () => {
    await orcamentoRouter.createCaller(contexto).create(entradaCreate({ tipoVenda: "interna" }));
    expect(dbMocks.createOrcamentoComercialCalculado).toHaveBeenCalledWith(expect.objectContaining({
      cabecalho: expect.objectContaining({ tipoVenda: "interna", versaoCalculoComercial: 1, estado: "rascunho" }),
    }));
  });
});
