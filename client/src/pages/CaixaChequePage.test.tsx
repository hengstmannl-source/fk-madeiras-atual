import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  setLocation: vi.fn(),
  devolverCheque: vi.fn(),
  depositarCheque: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("wouter", () => ({ useLocation: () => ["/financeiro/caixa-cheque", state.setLocation] }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      financeiro: {
        cheques: { list: { invalidate: state.invalidate }, resumo: { invalidate: state.invalidate }, historicoDepositos: { invalidate: state.invalidate } },
        titulos: { list: { invalidate: state.invalidate } },
      },
    }),
    financeiro: {
      cheques: {
        resumo: { useQuery: () => ({ data: { totalDisponivel: 750, quantidadeDisponivel: 2, totalUtilizado: 250, quantidadeUtilizada: 1, totalDepositado: 500, quantidadeDepositada: 1, contas: [{ id: 9, nome: "Caixa Cheque" }] }, isLoading: false }) },
        list: { useQuery: () => ({ data: [{ id: 3, referencia: "CHQ-001", clienteNome: "Madeireira Norte", contaNome: "Caixa Cheque", dataRecebimento: "2026-08-11T12:00:00.000Z", dataCompensacao: new Date().toISOString(), alertaCompensacao: "hoje", utilizadoEm: null, depositadoEm: null, contaDestinoNome: null, estado: "disponivel", valor: "750.00" }], isLoading: false }) },
        depositar: { useMutation: () => ({ mutate: state.depositarCheque, isPending: false, error: null }) },
        historicoDepositos: { useQuery: () => ({ data: [{ id: 8, referencia: "CHQ-DEP", clienteNome: "Madeireira Sul", contaNome: "Caixa Cheque", contaDestinoNome: "Banco Principal", depositadoEm: "2026-08-12T12:00:00.000Z", valor: "500.00" }], isLoading: false }) },
      },
      contas: { list: { useQuery: () => ({ data: [{ id: 12, nome: "Banco Principal", tipo: "banco", ativa: true }], isLoading: false }) } },
      titulos: {
        devolverCheque: { useMutation: () => ({ mutate: state.devolverCheque, isPending: false, error: null }) },
      },
    },
  },
}));

import CaixaChequePage from "./CaixaChequePage";

describe("CaixaChequePage", () => {
  afterEach(() => {
    cleanup();
    state.setLocation.mockReset();
    state.devolverCheque.mockReset();
    state.depositarCheque.mockReset();
    state.invalidate.mockReset();
  });

  it("exibe o saldo, os totais e a rastreabilidade do cheque disponível", () => {
    render(<CaixaChequePage />);

    expect(screen.getByRole("heading", { name: "Caixa Cheque" })).toBeInTheDocument();
    expect(screen.getAllByText("R$ 750,00")).toHaveLength(2);
    expect(screen.getByText("R$ 250,00")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 500,00")).toHaveLength(2);
    expect(screen.getByText("1 conta(s) de cheque cadastrada(s) para o controle.")).toBeInTheDocument();
    expect(screen.getByText("CHQ-001")).toBeInTheDocument();
    expect(screen.getByText("Madeireira Norte")).toBeInTheDocument();
    expect(screen.getByText("Disponível")).toBeInTheDocument();
    expect(screen.getByText("Atenção à compensação de cheques")).toBeInTheDocument();
    expect(screen.getByText(/compensa hoje/i)).toBeInTheDocument();
    expect(screen.getByText("CHQ-DEP")).toBeInTheDocument();
    expect(screen.getByText("Banco Principal")).toBeInTheDocument();
  });

  it("leva aos fluxos financeiros de recebimento e pagamento", () => {
    render(<CaixaChequePage />);

    fireEvent.click(screen.getByRole("button", { name: "Registrar recebimento" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar em pagamento" }));

    expect(state.setLocation).toHaveBeenNthCalledWith(1, "/financeiro?tipo=receber");
    expect(state.setLocation).toHaveBeenNthCalledWith(2, "/financeiro?tipo=pagar");
  });

  it("permite registrar a devolução de um cheque disponível com rastreabilidade", () => {
    render(<CaixaChequePage />);

    fireEvent.click(screen.getByRole("button", { name: "Devolver" }));
    fireEvent.change(screen.getByLabelText("Motivo da devolução"), { target: { value: "Insuficiência de fundos" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar devolução" }));

    expect(state.devolverCheque).toHaveBeenCalledWith(expect.objectContaining({
      id: 3,
      motivo: "Insuficiência de fundos",
      dataDevolucao: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    }));
  });

  it("registra o depósito em uma conta bancária sem criar um novo recebimento", () => {
    render(<CaixaChequePage />);

    fireEvent.click(screen.getByRole("button", { name: "Depositar" }));
    fireEvent.click(screen.getByLabelText("Conta bancária de destino"));
    fireEvent.click(screen.getByRole("option", { name: "Banco Principal" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar depósito" }));

    expect(state.depositarCheque).toHaveBeenCalledWith(expect.objectContaining({
      id: 3,
      contaDestinoId: 12,
      dataDeposito: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    }));
  });
});
