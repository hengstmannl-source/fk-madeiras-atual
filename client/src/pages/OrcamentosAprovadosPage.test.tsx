import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  venda: {} as Record<string, unknown>,
  entregar: vi.fn(),
  receber: vi.fn(),
  configurar: vi.fn(),
  estornar: vi.fn(),
  invalidar: vi.fn(),
  localizacao: "/vendas/aprovadas",
  navegar: vi.fn(),
  perfil: { role: "user", papel: "proprietario" },
  estoque: [] as Array<{ madeiraNome: string; volumeDisponivel: string }>,
  resumoFinanceiroVenda: { vendaId: 25, totalVenda: "900.00", totalRecebido: 0, saldoEmAberto: 900, titulos: [{ id: 81, descricao: "Venda 25 · Parcela 1/2", numeroParcela: 1, totalParcelas: 2, valorOriginal: "450.00", valorDevido: 450, valorRecebido: 0, saldoAberto: 450, dataVencimento: "2026-10-10T12:00:00.000Z", estado: "aberto", baixas: [] }, { id: 82, descricao: "Venda 25 · Parcela 2/2", numeroParcela: 2, totalParcelas: 2, valorOriginal: "450.00", valorDevido: 450, valorRecebido: 0, saldoAberto: 450, dataVencimento: "2026-11-10T12:00:00.000Z", estado: "aberto", baixas: [] }] } as {
    vendaId: number; totalVenda: string; totalRecebido: number; saldoEmAberto: number;
    titulos: Array<{ id: number; descricao: string; numeroParcela: number | null; totalParcelas: number | null; valorOriginal: string; valorDevido: number; valorRecebido: number; saldoAberto: number; dataVencimento: string; estado: string; baixas: Array<{ id: number; valor: string; dataBaixa: string; formaPagamento: string; estornada: boolean; contaFinanceiraId: number; cheques: Array<Record<string, unknown>> }> }>;
  },
  contasFinanceiras: [{ id: 5, nome: "Banco", tipo: "banco", ativa: true }, { id: 7, nome: "Caixa Cheque", tipo: "caixa_cheque", ativa: true }],
}));

vi.mock("wouter", () => ({ useLocation: () => [state.localizacao, state.navegar] }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: state.perfil }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      orcamento: { list: { invalidate: state.invalidar }, resumoFilas: { invalidate: state.invalidar }, get: { invalidate: state.invalidar }, condicaoPagamento: { invalidate: state.invalidar } },
      financeiro: { titulos: { list: { invalidate: state.invalidar }, recebimentosVenda: { invalidate: state.invalidar } }, cheques: { list: { invalidate: state.invalidar } } },
      producao: { estoque: { resumo: { invalidate: state.invalidar } } },
    }),
    cliente: { list: { useQuery: () => ({ data: [{ id: 1, nome: "Cliente de teste" }] }) } },
    financeiro: {
      titulos: {
        recebimentosVenda: { useQuery: () => ({ data: state.resumoFinanceiroVenda, isLoading: false, isFetching: false }) },
        baixar: { useMutation: () => ({ isPending: false, mutate: (input: unknown, callbacks: { onSuccess?: () => void }) => { state.receber(input); callbacks.onSuccess?.(); } }) },
      },
      contas: { list: { useQuery: () => ({ data: state.contasFinanceiras }) } },
    },
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
    state.receber.mockReset();
    state.invalidar.mockReset();
    state.navegar.mockReset();
    state.localizacao = "/vendas/aprovadas";
    state.perfil = { role: "user", papel: "proprietario" };
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

  it("registra a baixa física de uma venda paga com os dados operacionais da entrega", () => {
    render(<OrcamentosAprovadosPage />);

    expect(screen.getByText("Aguardando baixa física")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar entrega" }));
    expect(screen.getByRole("heading", { name: "Registrar entrega física" })).toBeInTheDocument();
    expect(screen.getByText(/mesmo que o pagamento ainda esteja em aberto/i)).toBeInTheDocument();
    expect(screen.getByText(/saldo negativo para regularização/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Responsável pela entrega *"), { target: { value: "João da Silva" } });

    fireEvent.click(screen.getByRole("button", { name: "Confirmar entrega e baixa" }));
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
    expect(screen.getByRole("button", { name: "Quitar integralmente" })).toBeInTheDocument();
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

  it("mostra ações financeiras somente conforme o perfil das respectivas procedures", () => {
    state.venda = { ...state.venda, pago: false, pagoEm: null, formaPagamento: null };
    state.perfil = { role: "user", papel: "vendas" };
    const view = render(<OrcamentosAprovadosPage />);

    expect(screen.queryByRole("button", { name: "Registrar recebimento" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar integralmente" })).toBeInTheDocument();

    state.perfil = { role: "user", papel: "financeiro" };
    view.rerender(<OrcamentosAprovadosPage />);
    expect(screen.getByRole("button", { name: "Registrar recebimento" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar integralmente" })).not.toBeInTheDocument();

    state.perfil = { role: "user", papel: "administrador" };
    view.rerender(<OrcamentosAprovadosPage />);
    expect(screen.getByRole("button", { name: "Registrar recebimento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quitar integralmente" })).toBeInTheDocument();
  });

  it("registra recebimento parcial na parcela selecionada pelo fluxo do Financeiro", async () => {
    const user = userEvent.setup();
    render(<OrcamentosAprovadosPage />);

    await user.click(screen.getByRole("button", { name: "Registrar recebimento" }));
    fireEvent.change(screen.getByLabelText("Título / parcela *"), { target: { value: "82" } });
    fireEvent.change(screen.getByLabelText("Forma de pagamento *"), { target: { value: "transferencia" } });
    fireEvent.change(screen.getByLabelText("Valor recebido *"), { target: { value: "200,00" } });
    fireEvent.change(screen.getByLabelText("Data *"), { target: { value: "2026-10-07" } });
    await user.click(screen.getByRole("button", { name: "Registrar recebimento" }));

    expect(state.receber).toHaveBeenCalledWith(expect.objectContaining({
      tituloId: 82,
      contaFinanceiraId: 5,
      valor: "200.00",
      formaPagamento: "transferencia",
      dataBaixa: "2026-10-07",
    }));
  });

  it("registra recebimento parcial em múltiplos cheques com valores conciliados", async () => {
    const user = userEvent.setup();
    state.resumoFinanceiroVenda = { ...state.resumoFinanceiroVenda, titulos: [{ ...state.resumoFinanceiroVenda.titulos[0], numeroParcela: null, totalParcelas: null, saldoAberto: 900, valorOriginal: "900.00" }] };
    render(<OrcamentosAprovadosPage />);

    await user.click(screen.getByRole("button", { name: "Registrar recebimento" }));
    fireEvent.change(screen.getByLabelText("Forma de pagamento *"), { target: { value: "cheque" } });
    fireEvent.change(screen.getByLabelText("Valor recebido *"), { target: { value: "500,00" } });
    const cheques = [["CH-1", "100,00"], ["CH-2", "150,00"], ["CH-3", "250,00"]];
    for (let index = 0; index < cheques.length; index++) {
      const [referencia, valor] = cheques[index];
      await user.click(screen.getByRole("button", { name: "Adicionar cheque" }));
      fireEvent.change(document.getElementById(`referencia-cheque-${index}`)!, { target: { value: referencia } });
      fireEvent.change(document.getElementById(`valor-cheque-${index}`)!, { target: { value: valor } });
    }
    fireEvent.change(screen.getByLabelText("Data *"), { target: { value: "2026-10-07" } });
    await user.click(screen.getByRole("button", { name: "Registrar recebimento" }));

    expect(state.receber).toHaveBeenCalledWith(expect.objectContaining({
      tituloId: 81,
      contaFinanceiraId: 7,
      valor: "500.00",
      formaPagamento: "cheque",
      chequesRecebidos: [
        { referencia: "CH-1", valor: "100.00", dataCompensacao: undefined },
        { referencia: "CH-2", valor: "150.00", dataCompensacao: undefined },
        { referencia: "CH-3", valor: "250.00", dataCompensacao: undefined },
      ],
    }));
  });

  it("identifica baixas estornadas no histórico sem contá-las como recebidas", async () => {
    state.resumoFinanceiroVenda = {
      vendaId: 25, totalVenda: "900.00", totalRecebido: 200, saldoEmAberto: 700,
      titulos: [{
        ...state.resumoFinanceiroVenda.titulos[0], numeroParcela: null, totalParcelas: null,
        valorOriginal: "900.00", valorDevido: 900, valorRecebido: 200, saldoAberto: 700,
        baixas: [
          { id: 1, valor: "500.00", dataBaixa: "2026-10-01T12:00:00.000Z", formaPagamento: "pix", estornada: true, contaFinanceiraId: 5, cheques: [] },
          { id: 2, valor: "200.00", dataBaixa: "2026-10-02T12:00:00.000Z", formaPagamento: "transferencia", estornada: false, contaFinanceiraId: 5, cheques: [] },
        ],
      }],
    };
    render(<OrcamentosAprovadosPage />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Registrar recebimento" }));

    expect(screen.getByText("PIX · Estornada")).toBeInTheDocument();
    expect(screen.getAllByText(/200,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Transferência bancária").length).toBeGreaterThan(1);
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
