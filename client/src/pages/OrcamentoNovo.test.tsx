import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  create: vi.fn(),
  setLocation: vi.fn(),
  origem: {
    orcamento: {
      clienteId: 3, desconto: "0", fretePorTonelada: "0", pesoCargaToneladas: "0",
      comissaoTipo: "percentual", comissaoValor: "0", taxaDescricao: null, taxaTipo: "percentual",
      taxaValor: "0", observacoes: "Observação de origem", vendedor: "Vendedor",
      dataValidade: new Date(2026, 10, 1, 12),
      dataVencimento: new Date(2026, 9, 20, 12), competencia: new Date(2026, 9, 1, 12),
    },
    itens: [{
      madeiraId: 4, bitolaId: null, produtoComercialId: null, madeiraNome: "Cedrinho",
      bitolaDescricao: "2×5 cm", espessura: "20", largura: "50", comprimento: "3", quantidade: 2,
      tipoComercializacao: "metro_cubico", unidadesPorComercializacao: 1, precoM3: "2400",
      precoLinear: "2.4", valorPeca: "7.2", valorTotal: "14.4", componentesPacote: [],
    }],
    aproveitamentos: [],
    taxasAdicionais: [],
  },
}));

vi.mock("wouter", () => ({ useLocation: () => ["/orcamentos/novo", state.setLocation] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const queryVazia = { useQuery: () => ({ data: [], isLoading: false, isError: false, isSuccess: true }) };
  const mutation = { useMutation: () => ({ mutate: state.create, isPending: false }) };
  const invalidate = { invalidate: vi.fn() };
  const queryOrigem = { useQuery: (input: { id: number }) => input.id === 42 ? { data: state.origem, isLoading: false, isError: false } : { data: undefined, isLoading: false, isError: true } };
  return {
    trpc: {
      useUtils: () => ({ cliente: { list: invalidate }, orcamento: { list: invalidate, produtosComerciais: { list: invalidate }, modelosMedida: { list: invalidate } } }),
      cliente: { list: { useQuery: () => ({ data: [{ id: 3, nome: "Cliente original", contacto: null }], isLoading: false, isError: false, isSuccess: true }) }, create: mutation },
      madeira: { list: { useQuery: () => ({ data: [{ id: 4, nome: "Cedrinho", precoM3: "2400" }], isLoading: false, isError: false, isSuccess: true }) }, create: mutation },
      producao: { estoque: { resumo: queryVazia } },
      orcamento: {
        get: queryOrigem, create: mutation,
        produtosComerciais: { list: queryVazia, create: mutation },
        modelosMedida: { list: queryVazia, create: mutation, delete: mutation },
      },
    },
  };
});

import OrcamentoNovo from "./OrcamentoNovo";

describe("formulário de duplicação de orçamento", () => {
  beforeEach(() => {
    state.create.mockReset();
    state.setLocation.mockReset();
    window.history.replaceState({}, "", "/orcamentos/novo?duplicar=42");
  });
  afterEach(cleanup);

  it("carrega a origem sem gravar e salva um rascunho editável somente após confirmação", async () => {
    render(<OrcamentoNovo />);
    expect(await screen.findByText(/nenhum orçamento foi criado ainda/i)).toBeInTheDocument();
    expect(state.create).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Produto / madeira"), { target: { value: "Cedrinho selecionado para a cópia" } });
    fireEvent.change(screen.getByLabelText("Espessura (mm)"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Peças"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Preço por m³ (R$)"), { target: { value: "3000" } });
    expect(screen.getAllByText(/R\$\s*40,50/).length).toBeGreaterThan(0);

    const save = screen.getByRole("button", { name: /salvar cópia como rascunho/i });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(state.create).toHaveBeenCalledTimes(1);
    expect(state.create).toHaveBeenCalledWith(expect.objectContaining({
      clienteId: 3,
      duplicadoDeId: 42,
      estado: "rascunho",
      itens: [expect.objectContaining({ madeiraId: null, madeiraNome: "Cedrinho selecionado para a cópia", espessura: "30", quantidade: 3, precoM3: "3000", valorTotal: "40.5" })],
    }), expect.any(Object));
  });
});
