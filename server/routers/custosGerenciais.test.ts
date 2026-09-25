import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../repositories/custosGerenciais", () => ({
  listarCentrosCustosGerenciais: vi.fn(),
  criarCentroCustoGerencial: vi.fn(),
  atualizarCentroCustoGerencial: vi.fn(),
  listarCategoriasCustosGerenciais: vi.fn(),
  criarCategoriaCustoGerencial: vi.fn(),
  atualizarCategoriaCustoGerencial: vi.fn(),
  listarLancamentosCustosGerenciais: vi.fn(),
  criarLancamentoCustoGerencial: vi.fn(),
  cancelarLancamentoCustoGerencial: vi.fn(),
  listarRateiosCustosGerenciais: vi.fn(),
  gerarRateioCustoGerencial: vi.fn(),
  obterCustoMateriaPrimaRastreavelPorRomaneio: vi.fn(),
  obterCustoMateriaPrimaRastreavelPorLote: vi.fn(),
  listarCalculosCustosGerenciais: vi.fn(),
  materializarCustoGerencialPorRomaneio: vi.fn(),
  materializarCustoGerencialPorLote: vi.fn(),
  materializarCustoGerencialPorVenda: vi.fn(),
}));

import * as repositorio from "../repositories/custosGerenciais";
import { custosGerenciaisRouter } from "./custosGerenciais";

function contexto(papel: string, role = "user") {
  return {
    user: {
      id: 41,
      openId: "teste-custos",
      name: "Utilizador de Custos",
      email: "custos@exemplo.com",
      loginMethod: "manus",
      role,
      papel,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    configuracaoEmpresa: { id: 1, nome: "FK Madeiras", ativa: true },
  } as unknown as TrpcContext;
}

describe("custosGerenciaisRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permite consulta financeira e converte competência em data local estável", async () => {
    vi.mocked(repositorio.listarCalculosCustosGerenciais).mockResolvedValue([] as any);
    const caller = custosGerenciaisRouter.createCaller(contexto("financeiro"));

    await caller.calculos.listar({ entidadeTipo: "venda", competencia: "2026-08-01" });

    expect(repositorio.listarCalculosCustosGerenciais).toHaveBeenCalledWith(expect.objectContaining({
      entidadeTipo: "venda",
      competencia: expect.any(Date),
    }));
    const chamada = vi.mocked(repositorio.listarCalculosCustosGerenciais).mock.calls[0][0]!;
    expect(chamada.competencia?.getHours()).toBe(12);
  });

  it("restringe o acesso do módulo aos perfis financeiros", async () => {
    const caller = custosGerenciaisRouter.createCaller(contexto("vendas"));

    await expect(caller.calculos.listar()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repositorio.listarCalculosCustosGerenciais).not.toHaveBeenCalled();
  });

  it("restringe a materialização a administradores e preserva o responsável", async () => {
    vi.mocked(repositorio.materializarCustoGerencialPorVenda).mockResolvedValue({ id: 77, versao: 1 } as any);
    const financeiro = custosGerenciaisRouter.createCaller(contexto("financeiro"));
    await expect(financeiro.calculos.materializarVenda({ vendaId: 9 })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const administrador = custosGerenciaisRouter.createCaller(contexto("administrador"));
    await administrador.calculos.materializarVenda({ vendaId: 9 });

    expect(repositorio.materializarCustoGerencialPorVenda).toHaveBeenCalledWith({ vendaId: 9, criadoPor: 41 });
  });

  it("mantém markup e margem como métodos distintos de formação de preço", async () => {
    const caller = custosGerenciaisRouter.createCaller(contexto("financeiro"));

    const markup = await caller.simulacao.preco({ custoPorM3: "100", markupPercentual: "25" });
    const margem = await caller.simulacao.preco({ custoPorM3: "100", margemPercentual: "25" });

    expect(markup.precoPorM3).toBe(125);
    expect(margem.precoPorM3).toBe(133.33);
  });
});
