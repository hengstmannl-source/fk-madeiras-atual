import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { ajustarMutate, perfilAtual, relatorioQuery, ajustesQuery } = vi.hoisted(() => ({
  ajustarMutate: vi.fn(),
  perfilAtual: { role: "admin" },
  relatorioQuery: vi.fn(() => ({
    data: {
      linhas: [
        { chave: "itauba", madeiraNome: "Itaúba", espessura: 3, largura: 5, comprimento: 2, saldoAtual: -2, volumeAtual: -0.003, entradas: 0, saidas: 2, estornos: 0, ajustes: 0, saldoInicialEstimado: 0, estoqueMedio: 0, rotacao: null, coberturaDias: 0, situacao: "rutura" },
        { chave: "cedrinho", madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, saldoAtual: 6, volumeAtual: 0.045, entradas: 10, saidas: 4, estornos: 0, ajustes: 0, saldoInicialEstimado: 0, estoqueMedio: 3, rotacao: 1.33, coberturaDias: 45, situacao: "adequado" },
      ],
      resumo: { itensAnalisados: 2, itensEmRutura: 1, itensCriticos: 0, pecasEmDeficit: 2, saidasNoPeriodo: 6 },
    },
    isLoading: false,
  })),
  ajustesQuery: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: perfilAtual }) }));
vi.mock("@/lib/trpc", () => {
  const invalidar = { invalidate: vi.fn() };
  return {
    trpc: {
      useUtils: () => ({ producao: { estoque: { relatorio: invalidar, resumo: invalidar, ajustes: invalidar } } }),
      producao: {
        estoque: {
          relatorio: { useQuery: relatorioQuery },
          ajustes: { useQuery: ajustesQuery },
          ajustar: { useMutation: () => ({ mutate: ajustarMutate, isPending: false }) },
        },
      },
    },
  };
});

import InventarioPage from "./InventarioPage";

afterEach(() => {
  cleanup();
  ajustarMutate.mockReset();
  relatorioQuery.mockClear();
  ajustesQuery.mockClear();
  perfilAtual.role = "admin";
});

describe("InventarioPage", () => {
  it("apresenta indicadores de rotação e prioriza a rutura por essência e medida", () => {
    render(<InventarioPage />);

    expect(screen.getByRole("heading", { name: "Rotação, rutura e regularização" })).toBeTruthy();
    expect(screen.getByText("Em rutura")).toBeTruthy();
    expect(screen.getAllByText("Itaúba").length).toBeGreaterThan(0);
    expect(screen.getByText("Rutura")).toBeTruthy();
    expect(screen.getByText("1,33×")).toBeTruthy();
    expect(screen.getByText("45,0 dias")).toBeTruthy();
  });

  it("regista a contagem física pelo fluxo de ajuste auditável", async () => {
    const user = userEvent.setup();
    render(<InventarioPage />);

    await user.click(screen.getByRole("button", { name: "Ajustar" }));
    expect(screen.getByRole("heading", { name: "Regularizar contagem de inventário" })).toBeTruthy();
    await user.clear(screen.getByLabelText("Contagem física"));
    await user.type(screen.getByLabelText("Contagem física"), "3");
    await user.type(screen.getByLabelText("Motivo da regularização"), "Conferência física");
    await user.click(screen.getByRole("button", { name: "Confirmar ajuste" }));

    expect(ajustarMutate).toHaveBeenCalledWith(expect.objectContaining({ madeiraNome: "Itaúba", espessura: "3", largura: "5", comprimento: "2", quantidadeContada: 3, motivo: "Conferência física" }), expect.any(Object));
  });
});
