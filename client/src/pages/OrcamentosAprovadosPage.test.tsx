import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  venda: {} as Record<string, unknown>,
  entregar: vi.fn(),
  configurar: vi.fn(),
  estornar: vi.fn(),
  invalidar: vi.fn(),
  localizacao: "/vendas/aprovadas",
  navegar: vi.fn(),
  estoque: [] as Array<{ madeiraNome: string; volumeDisponivel: string }>,
}));

vi.mock("wouter", () => ({ useLocation: () => [state.localizacao, state.navegar] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      orcamento: { list: { invalidate: state.invalidar }, resumoFilas: { invalidate: state.invalidar }, get: { invalidate: state.invalidar }, condicaoPagamento: { invalidate: state.invalidar } },
      producao: { estoque: { resumo: { invalidate: state.invalidar } } },
    }),
    cliente: { list: { useQuery: () => ({ data: [{ id: 1, nome: "Cliente de teste" }] }) } },
      orcamento: {
        list: { useQuery: () => ({ data: [state.venda], isLoading: false }) },
        resumoFilas: { useQuery: () => ({ data: { aprovadas: 3, pagas: 2, entregues: 1, concluidas: 4 }, isLoading: false }) },
      registrarPagamento: { useMutation: () => ({ isPending: false, mutate: vi.fn() }) },
      condicaoPagamento: { useQuery: () => ({ data: { possuiParcelamento: false, parcelas: [] }, isLoading: false }) },
      configurarCondicaoPagamento: { useMutation: () => ({ isPending: false, mutate: (input: { id: number; parcelas: Array<{ dataVencimento: string }> }, callbacks: { onSuccess?: (resultado: { parcelas: Array<{ id: number }> }) => void }) => { state.configurar(input); callbacks.onSuccess?.({ parcelas: input.parcelas.map((_, indice) => ({ id: indice + 1 })) }); } }) },
      entregarFisicamente: { useMutation: () => ({ isPending: false, mutate: (input: { id: number; entregueEm: string; modalidadeEntrega: "retirada" | "entrega"; responsavelEntrega: string; observacoesEntrega?: string; aproveitamentos?: Array<{ madeiraNome: string; volume: string }> }, callbacks: { onSuccess?: (resultado: { pecasEntregues: number; pecasSemEstoque?: number; aproveitamentoEntregue?: number; aproveitamentoSemEstoque?: number }) => void }) => { state.entregar(input); callbacks.onSuccess?.({ pecasEntregues: 4, pecasSemEstoque: 2, aproveitamentoEntregue: 0, aproveitamentoSemEstoque: 0 }); } }) },
      estornarEntrega: { useMutation: () => ({ isPending: false, mutate: (input: { id: number; motivo: string }, callbacks: { onSuccess?: (resultado: { pecasDevolvidas: number }) => void }) => { state.estornar(input); callbacks.onSuccess?.({ pecasDevolvidas: 4 }); } }) },
    },
    producao: { estoque: { resumo: { useQuery: () => ({ data: state.estoque }) } } },
  },
}));

import OrcamentosAprovadosPage from "./OrcamentosAprovadosPage";

describe("OrcamentosAprovadosPage — entrega física independente", () => {
  beforeEach(() => {
    cleanup();
    state.entregar.mockReset();
    state.configurar.mockReset();
    state.estornar.mockReset();
    state.invalidar.mockReset();
    state.navegar.mockReset();
    state.localizacao = "/vendas/aprovadas";
    state.estoque = [];
    state.venda = {
      id: 25,
      numero: "VND-000025",
      clienteId: 1,
      total: "320.00",
      pago: true,
      pagoEm: "2026-08-11T12:00:00.000Z",
      formaPagamento: "pix",
      entregue: false,
      entregueEm: null,
      createdAt: "2026-08-11T12:00:00.000Z",
    };
  });

  it("registra a baixa física de uma venda paga com os dados operacionais da entrega", async () => {
    const user = userEvent.setup();
    render(<OrcamentosAprovadosPage />);

    expect(screen.getByText("Aguardando baixa física")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Registrar entrega" }));
    expect(screen.getByRole("heading", { name: "Registrar entrega física" })).toBeInTheDocument();
    expect(screen.getByText(/mesmo que o pagamento ainda esteja em aberto/i)).toBeInTheDocument();
    expect(screen.getByText(/saldo negativo para regularização/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Responsável pela entrega *"), "João da Silva");

    await user.click(screen.getByRole("button", { name: "Confirmar entrega e baixa" }));
    expect(state.entregar).toHaveBeenCalledWith(expect.objectContaining({
      id: 25,
      modalidadeEntrega: "retirada",
      responsavelEntrega: "João da Silva",
    }));
    expect(state.invalidar).toHaveBeenCalled();
  });

  it("oferece a entrega antes do pagamento para venda a prazo", () => {
    state.venda = { ...state.venda, pago: false, pagoEm: null, formaPagamento: null };
    render(<OrcamentosAprovadosPage />);

    expect(screen.getByText("Em aberto")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar entrega" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar pagamento" })).toBeInTheDocument();
  });

  it("permite baixar aproveitamento por essência junto à entrega física", async () => {
    const user = userEvent.setup();
    state.estoque = [{ madeiraNome: "Aproveitamento de Cedrinho", volumeDisponivel: "1.250" }];
    render(<OrcamentosAprovadosPage />);

    await user.click(screen.getByRole("button", { name: "Registrar entrega" }));
    expect(screen.getByText("Baixar aproveitamento (m³)")).toBeInTheDocument();
    expect(screen.getByText("Disponível: 1,250 m³")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Aproveitamento de Cedrinho em m³"), "0,250");
    await user.type(screen.getByLabelText("Responsável pela entrega *"), "João da Silva");
    await user.click(screen.getByRole("button", { name: "Confirmar entrega e baixa" }));

    expect(state.entregar).toHaveBeenCalledWith(expect.objectContaining({
      aproveitamentos: [{ madeiraNome: "Cedrinho", volume: "0.250" }],
    }));
  });

  it("retorna de Pagas para Aprovadas pela rota da fila, sem interpretar a categoria como uma venda", async () => {
    const user = userEvent.setup();
    state.localizacao = "/orcamentos/pagas";
    render(<OrcamentosAprovadosPage />);

    await user.click(screen.getByRole("button", { name: /Aprovadas/i }));

    expect(state.navegar).toHaveBeenCalledWith("/orcamentos/aprovados");
  });

  it("exibe o total consolidado em cada fila operacional de Vendas", () => {
    render(<OrcamentosAprovadosPage />);

    expect(screen.getByLabelText("Total de vendas Aprovadas")).toHaveTextContent("3");
    expect(screen.getByLabelText("Total de vendas Pagas")).toHaveTextContent("2");
    expect(screen.getByLabelText("Total de vendas Entregues")).toHaveTextContent("1");
    expect(screen.getByLabelText("Total de vendas Concluídas")).toHaveTextContent("4");
  });

  it("configura vencimentos parcelados por prazo ao clicar no cliente da venda aprovada", async () => {
    const user = userEvent.setup();
    state.venda = { ...state.venda, pago: false, pagoEm: null, formaPagamento: null };
    render(<OrcamentosAprovadosPage />);

    await user.click(screen.getByRole("button", { name: "Cliente de teste" }));
    expect(screen.getByRole("heading", { name: "Condição de pagamento" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Parcelado/i }));
    await user.click(screen.getByRole("button", { name: "Dias a partir de hoje" }));
    await user.clear(screen.getByLabelText("Prazo da parcela 1 em dias"));
    await user.type(screen.getByLabelText("Prazo da parcela 1 em dias"), "30");
    await user.clear(screen.getByLabelText("Prazo da parcela 2 em dias"));
    await user.type(screen.getByLabelText("Prazo da parcela 2 em dias"), "60");
    await user.click(screen.getByRole("button", { name: "Confirmar condição" }));

    expect(state.configurar).toHaveBeenCalledWith({
      id: 25,
      parcelas: [expect.objectContaining({ dataVencimento: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }), expect.objectContaining({ dataVencimento: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) })],
    });
    expect(state.invalidar).toHaveBeenCalled();
  });
});
