import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  search: "",
  ultimaConsultaOperacional: undefined as Record<string, unknown> | undefined,
  ultimaConsultaTitulos: undefined as Record<string, unknown> | undefined,
  titulos: [] as Array<Record<string, unknown>>,
  clientes: [] as Array<Record<string, unknown>>,
  categorias: [] as Array<Record<string, unknown>>,
  centrosCusto: [] as Array<Record<string, unknown>>,
  baixas: [] as Array<Record<string, unknown>>,
  anexos: [] as Array<Record<string, unknown>>,
  cancelar: vi.fn(),
  atualizar: vi.fn(),
  atualizarLote: vi.fn(),
  criarCentroCusto: vi.fn(),
  atualizarAgendamento: vi.fn(),
  estornar: vi.fn(),
  importar: vi.fn(),
  invalidar: vi.fn(),
  exportarPdf: vi.fn().mockResolvedValue({ url: "blob:relatorio-financeiro", nomeArquivo: "contas-a-pagar-2026-08-18.pdf" }),
  fluxo: {
    saldoAbertura: 100,
    entradas: 50,
    saidas: 20,
    saldoLiquido: 30,
    saldoFinal: 130,
    quantidadeMovimentos: 2,
    dias: [{ data: "2026-08-11", entradas: 50, saidas: 20, saldoLiquido: 30, saldoAcumulado: 130 }],
    movimentos: [{ id: 1, tipo: "receber", origem: "manual", descricao: "Recebimento demonstrativo", valor: "50.00", dataBaixa: "2026-08-11T12:00:00.000Z", formaPagamento: "pix", contaNome: "Caixa geral" }],
  },
  previsao: [{ inicioSemana: "2026-08-10", fimSemana: "2026-08-16", entradas: 300, saidas: 120, saldoLiquido: 180, saldoProjetado: -20, quantidadeTitulos: 2 }],
  fluxoGerencial: {
    saldoAtual: 130,
    saldoInicialPeriodo: 100,
    entradasRealizadas: 50,
    saidasRealizadas: 20,
    entradasPrevistas: 90,
    saidasPrevistas: 140,
    saldoProjetado: 80,
    menorSaldoProjetado: 80,
    dataMenorSaldoProjetado: "2026-08-13T12:00:00.000Z",
    possuiAlertaSaldoNegativo: false,
    movimentosBancariosNaoConciliados: 1,
    dias: [{ data: "2026-08-11T12:00:00.000Z", entradasRealizadas: 50, saidasRealizadas: 20, entradasPrevistas: 90, saidasPrevistas: 140, transferenciasEntrada: 0, transferenciasSaida: 0, saldoProjetado: 80, itens: [] }],
    itensRealizados: [], itensPrevistos: [], itensTransferencias: [],
    porCategoria: [{ nome: "Vendas", entradas: 140, saidas: 0, saldo: 140, quantidade: 2 }],
  },
  contasOperacionais: {
    itens: [] as Array<Record<string, unknown>>,
    resumo: { quantidade: 0, saldoAberto: 0, vencido: 0, venceHoje: 0, proximosSeteDias: 0, aging: { a_vencer: 0, vence_hoje: 0, "1_7": 0, "8_30": 0, "31_60": 0, "61_90": 0, mais_90: 0, encerrado: 0 } },
    agrupamentos: [] as Array<Record<string, unknown>>,
    top5Contrapartes: [] as Array<Record<string, unknown>>,
    convencaoContaFinanceira: "O filtro por conta retorna somente títulos que já possuem baixa válida nessa conta; títulos em aberto não recebem conta prevista.",
  },
}));

vi.mock("wouter", () => ({ useSearch: () => state.search }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));
vi.mock("@/lib/financeiroPdf", () => ({ exportarListaFinanceiraPdf: state.exportarPdf }));

vi.mock("@/lib/trpc", () => {
  const mutationInerte = { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }) };
  const queryVazia = { useQuery: () => ({ data: [], isLoading: false }) };
  const invalidar = { invalidate: state.invalidar };

  return {
    trpc: {
      useUtils: () => ({
        financeiro: {
          titulos: { list: invalidar, baixas: invalidar },
          contasOperacionais: { list: invalidar },
          categorias: { list: invalidar },
          centrosCusto: { list: invalidar },
          fornecedores: { list: invalidar, modeloCsv: invalidar },
          contas: { list: invalidar },
          transferencias: { list: invalidar, movimentosPorConta: invalidar },
          cheques: { list: invalidar, resumo: invalidar },
          recorrencias: { list: invalidar },
          alertas: { list: invalidar },
          anexos: { list: invalidar },
          relatorios: { fluxoCaixa: invalidar, fluxoGerencial: invalidar, previsaoSemanal: invalidar },
          intercambios: { modeloLancamentosCsv: invalidar, exportarLancamentosCsv: invalidar },
        },
      }),
      cliente: { list: { useQuery: () => ({ data: state.clientes, isLoading: false }) }, create: mutationInerte },
      financeiro: {
        titulos: {
          list: { useQuery: (filtros?: { descricao?: string; clienteId?: number; categoriaId?: number; dataInicio?: Date; dataFim?: Date; origem?: string; criterioData?: "vencimento" | "baixa" }) => {
            state.ultimaConsultaTitulos = filtros;
            return {
            data: !filtros ? state.titulos : state.titulos.filter((titulo) => {
              if (filtros.descricao && !`${titulo.descricao ?? ""}`.toLocaleLowerCase("pt-BR").includes(filtros.descricao.toLocaleLowerCase("pt-BR"))) return false;
              if (filtros.categoriaId && titulo.categoriaId !== filtros.categoriaId) return false;
              if (filtros.clienteId && titulo.clienteId !== filtros.clienteId) return false;
              if (filtros.origem && titulo.origem !== filtros.origem) return false;
              const dataFiltro = filtros.criterioData === "baixa" ? titulo.dataUltimaBaixa : titulo.dataVencimento;
              if (filtros.dataInicio && (!dataFiltro || new Date(dataFiltro as string).getTime() < filtros.dataInicio.getTime())) return false;
              if (filtros.dataFim && (!dataFiltro || new Date(dataFiltro as string).getTime() > filtros.dataFim.getTime())) return false;
              return true;
            }),
            isLoading: false,
            isFetching: false,
          };
          } },
          baixas: { useQuery: () => ({ data: state.baixas, isLoading: false, refetch: vi.fn() }) },
          createManual: mutationInerte,
          createParcelado: mutationInerte,
          update: {
            useMutation: () => ({
              isPending: false,
              mutate: (input: Record<string, unknown>, callbacks: { onSuccess?: () => void }) => {
                state.atualizar(input);
                callbacks.onSuccess?.();
              },
            }),
          },
          updateEmLote: {
            useMutation: () => ({
              isPending: false,
              mutate: (input: Record<string, unknown>, callbacks: { onSuccess?: (resultado: { atualizados: number }) => void }) => {
                state.atualizarLote(input);
                callbacks.onSuccess?.({ atualizados: (input.ids as number[]).length });
              },
            }),
          },
          updateAgendamento: {
            useMutation: () => ({
              isPending: false,
              mutate: (input: { id: number; dataVencimento: string }, callbacks: { onSuccess?: () => void }) => {
                state.atualizarAgendamento(input);
                callbacks.onSuccess?.();
              },
            }),
          },
          baixar: mutationInerte,
          conciliarBaixa: mutationInerte,
          estornarBaixa: {
            useMutation: () => ({
              isPending: false,
              mutate: (input: { id: number; motivo: string }, callbacks: { onSuccess?: () => void }) => {
                state.estornar(input);
                state.baixas = state.baixas.map((baixa) => baixa.id === input.id ? {
                  ...baixa, estornada: true, estornadaEm: "2026-08-11T12:00:00.000Z", motivoEstorno: input.motivo,
                } : baixa);
                callbacks.onSuccess?.();
              },
            }),
          },
          delete: {
            useMutation: () => ({
              isPending: false,
              mutate: (input: { id: number }, callbacks: { onSuccess?: () => void }) => {
                state.cancelar(input);
                state.titulos = state.titulos.filter((titulo) => titulo.id !== input.id);
                callbacks.onSuccess?.();
              },
            }),
          },
        },
        centrosCusto: {
          list: { useQuery: () => ({ data: state.centrosCusto, isLoading: false }) },
          create: {
            useMutation: () => ({
              isPending: false,
              mutate: (input: Record<string, unknown>, callbacks: { onSuccess?: (resultado: { id: number }) => void }) => {
                state.criarCentroCusto(input);
                callbacks.onSuccess?.({ id: 22 });
              },
            }),
          },
        },
        contasOperacionais: { list: { useQuery: (filtros?: Record<string, unknown>) => {
          state.ultimaConsultaOperacional = filtros;
          const itens = state.contasOperacionais.itens.filter((titulo) => {
            if (filtros?.tipo && titulo.tipo !== filtros.tipo) return false;
            if (filtros?.situacao === "vencido" && !["vencido", "vencido_8_30", "vencido_31_60", "vencido_61_90", "vencido_mais_90"].includes(String(titulo.prioridade))) return false;
            if (filtros?.situacao === "vence_hoje" && titulo.prioridade !== "vence_hoje") return false;
            if (filtros?.situacao === "proximos_7_dias" && titulo.prioridade !== "vence_em_breve") return false;
            if (filtros?.situacao === "proximos_30_dias" && !(Number(titulo.diasParaVencimento) >= 1 && Number(titulo.diasParaVencimento) <= 30)) return false;
            if (filtros?.situacao === "a_vencer" && !["vence_hoje", "vence_em_breve", "normal"].includes(String(titulo.prioridade))) return false;
            if (filtros?.aging && titulo.faixaAging !== filtros.aging) return false;
            if (filtros?.estado && titulo.estado !== filtros.estado) return false;
            if (filtros?.origem && titulo.origem !== filtros.origem) return false;
            if (filtros?.clienteId && Number(titulo.clienteId) !== Number(filtros.clienteId)) return false;
            if (filtros?.fornecedorId && Number(titulo.fornecedorId) !== Number(filtros.fornecedorId)) return false;
            if (filtros?.descricao && !`${titulo.descricao ?? ""} ${titulo.contraparte ?? ""}`.toLocaleLowerCase("pt-BR").includes(String(filtros.descricao).toLocaleLowerCase("pt-BR"))) return false;
            return true;
          });
          const aging = { a_vencer: 0, vence_hoje: 0, "1_7": 0, "8_30": 0, "31_60": 0, "61_90": 0, mais_90: 0, encerrado: 0 } as Record<string, number>;
          itens.forEach((titulo) => { aging[String(titulo.faixaAging)] += Number(titulo.saldoAberto); });
          const resumo = { quantidade: itens.length, saldoAberto: itens.reduce((total, titulo) => total + Number(titulo.saldoAberto), 0), vencido: itens.filter((titulo) => Number(titulo.diasParaVencimento) < 0).reduce((total, titulo) => total + Number(titulo.saldoAberto), 0), aVencer: itens.filter((titulo) => Number(titulo.diasParaVencimento) > 0).reduce((total, titulo) => total + Number(titulo.saldoAberto), 0), venceHoje: itens.filter((titulo) => titulo.prioridade === "vence_hoje").reduce((total, titulo) => total + Number(titulo.saldoAberto), 0), proximosSeteDias: itens.filter((titulo) => titulo.prioridade === "vence_em_breve").reduce((total, titulo) => total + Number(titulo.saldoAberto), 0), proximosTrintaDias: itens.filter((titulo) => Number(titulo.diasParaVencimento) >= 1 && Number(titulo.diasParaVencimento) <= 30).reduce((total, titulo) => total + Number(titulo.saldoAberto), 0), percentualVencido: 0, aging };
          return { data: { ...state.contasOperacionais, itens, resumo }, isLoading: false, isFetching: false };
        } } },
        categorias: { list: { useQuery: () => ({ data: state.categorias, isLoading: false }) }, create: mutationInerte },
        fornecedores: { list: queryVazia, create: mutationInerte, update: mutationInerte, modeloCsv: { useQuery: () => ({ isFetching: false, refetch: vi.fn().mockResolvedValue({ data: "nome;contacto;email;documento;endereco;observacoes" }) }) }, prepararImportacaoCsv: mutationInerte, importarCsv: mutationInerte },
        anexos: {
          upload: mutationInerte,
          atualizarBoleto: mutationInerte,
          list: { useQuery: () => ({ data: state.anexos, isLoading: false, refetch: vi.fn() }) },
          remove: mutationInerte,
        },
        contas: { list: queryVazia, create: mutationInerte, update: mutationInerte, delete: mutationInerte },
        transferencias: { list: queryVazia, movimentosPorConta: queryVazia, create: mutationInerte, estornar: mutationInerte },
        cheques: { list: queryVazia, resumo: { useQuery: () => ({ data: { totalDisponivel: 0, quantidadeDisponivel: 0, totalUtilizado: 0, quantidadeUtilizada: 0, contas: [] }, isLoading: false }) } },
        recorrencias: { list: queryVazia, create: mutationInerte },
        alertas: { list: queryVazia },
        relatorios: {
          fluxoCaixa: { useQuery: () => ({ data: state.fluxo, isLoading: false, isFetching: false, refetch: vi.fn() }) },
          fluxoGerencial: { useQuery: () => ({ data: state.fluxoGerencial, isLoading: false, isFetching: false, refetch: vi.fn() }) },
          previsaoSemanal: { useQuery: () => ({ data: state.previsao, isLoading: false }) },
        },
        intercambios: {
          modeloLancamentosCsv: { useQuery: () => ({ isFetching: false, refetch: vi.fn().mockResolvedValue({ data: "referencia;tipo" }) }) },
          exportarLancamentosCsv: { useQuery: () => ({ isFetching: false, refetch: vi.fn().mockResolvedValue({ data: "referencia;tipo" }) }) },
          importarLancamentosCsv: { useMutation: () => ({ isPending: false, mutate: (input: { conteudo: string }, callbacks: { onSuccess?: (resultado: { importados: number; erros: string[] }) => void }) => { state.importar(input); callbacks.onSuccess?.({ importados: 0, erros: ["Linha 2: categoria não encontrada"] }); } }) },
        },
      },
    },
  };
});

import FinanceiroPage, { abaFinanceiraDaUrl } from "./FinanceiroPage";

if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => undefined;
  HTMLElement.prototype.releasePointerCapture = () => undefined;
}

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => undefined;
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

describe("FinanceiroPage — cancelamento manual", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    state.search = "";
    state.ultimaConsultaOperacional = undefined;
    state.ultimaConsultaTitulos = undefined;
    state.cancelar.mockReset();
    state.atualizarLote.mockReset();
    state.atualizarAgendamento.mockReset();
    state.estornar.mockReset();
    state.importar.mockReset();
    state.invalidar.mockReset();
    state.exportarPdf.mockReset();
    state.exportarPdf.mockResolvedValue({ url: "blob:relatorio-financeiro", nomeArquivo: "contas-a-pagar-2026-08-18.pdf" });
    state.anexos = [{
      id: 91,
      tituloId: 13,
      nomeArquivo: "boleto-agosto.pdf",
      mimeType: "application/pdf",
      tamanhoBytes: 1024,
      url: "https://documentos.exemplo/boleto-agosto.pdf",
    }];
    state.clientes = [{ id: 7, nome: "Cliente operacional" }, { id: 8, nome: "Outro cliente" }];
    state.categorias = [{ id: 1, nome: "Receitas de vendas", tipo: "receita" }];
    state.baixas = [{
      id: 40,
      tituloId: 12,
      valor: "50.00",
      formaPagamento: "pix",
      contaNome: "Caixa geral",
      dataBaixa: "2026-08-11T12:00:00.000Z",
      conciliada: false,
      estornada: false,
    }];
    state.titulos = [
      {
        id: 10,
        descricao: "Recebimento para cancelar",
        tipo: "receber",
        estado: "aberto",
        valorOriginal: "540.00",
        valorBaixado: "0.00",
        desconto: "0.00",
        juros: "0.00",
        categoriaId: 1,
        dataVencimento: "2026-08-11T00:00:00.000Z",
      },
      {
        id: 11,
        descricao: "Recebimento preservado",
        tipo: "receber",
        estado: "aberto",
        valorOriginal: "300.00",
        valorBaixado: "0.00",
        desconto: "0.00",
        juros: "0.00",
        dataVencimento: "2026-08-12T00:00:00.000Z",
      },
      {
        id: 12,
        descricao: "Recebimento com baixa",
        tipo: "receber",
        estado: "parcial",
        valorOriginal: "100.00",
        valorBaixado: "50.00",
        desconto: "0.00",
        juros: "0.00",
        dataVencimento: "2026-08-13T00:00:00.000Z",
      },
      {
        id: 13,
        descricao: "Carga de toras RC-001",
        origem: "romaneio_carga",
        tipo: "pagar",
        estado: "aberto",
        valorOriginal: "1200.00",
        valorBaixado: "0.00",
        categoriaId: 1,
        desconto: "0.00",
        juros: "0.00",
        dataEmissao: "2026-08-01T00:00:00.000Z",
        dataVencimento: "2026-08-12T00:00:00.000Z",
        linhaDigitavelBoleto: "00190500954014481606906809350314337370000000100",
      },
    ];
    state.contasOperacionais = {
      itens: [
        { id: 13, tipo: "pagar", estado: "parcial", descricao: "Carga de toras RC-001", origem: "romaneio_carga", competencia: "2026-08-01T00:00:00.000Z", categoriaId: 1, categoriaNome: "Receitas de vendas", clienteId: null, fornecedorId: 9, contraparte: "Fornecedor parcial", numeroParcela: 1, totalParcelas: 2, valorOriginal: "1200.00", desconto: "0.00", juros: "0.00", valorDevido: 1200, valorBaixado: 950, saldoAberto: 250, dataVencimento: "2026-08-26T00:00:00.000Z", diasParaVencimento: 0, prioridade: "vence_hoje", faixaAging: "vence_hoje", temBaixaConciliada: false, baixas: [{ id: 40, valor: "950.00", dataBaixa: "2026-08-20T00:00:00.000Z", contaNome: "Caixa geral", conciliada: false, estornada: false }] },
        { id: 91, tipo: "pagar", estado: "aberto", descricao: "Frete vencido", origem: "manual", competencia: null, categoriaId: 1, categoriaNome: "Receitas de vendas", clienteId: null, fornecedorId: 12, contraparte: "Fornecedor atrasado", numeroParcela: null, totalParcelas: null, valorOriginal: "700.00", desconto: "0.00", juros: "0.00", valorDevido: 700, valorBaixado: 0, saldoAberto: 700, dataVencimento: "2026-08-10T00:00:00.000Z", diasParaVencimento: -16, prioridade: "vencido", faixaAging: "8_30", temBaixaConciliada: false, baixas: [] },
        { id: 92, tipo: "pagar", estado: "aberto", descricao: "Serviço próximo", origem: "manual", competencia: null, categoriaId: 1, categoriaNome: "Receitas de vendas", clienteId: null, fornecedorId: 13, contraparte: "Fornecedor próximo", numeroParcela: null, totalParcelas: null, valorOriginal: "300.00", desconto: "0.00", juros: "0.00", valorDevido: 300, valorBaixado: 0, saldoAberto: 300, dataVencimento: "2026-08-30T00:00:00.000Z", diasParaVencimento: 4, prioridade: "vence_em_breve", faixaAging: "a_vencer", temBaixaConciliada: false, baixas: [] },
        { id: 93, tipo: "receber", estado: "aberto", descricao: "Venda em aberto", origem: "orcamento", competencia: null, categoriaId: 1, categoriaNome: "Receitas de vendas", clienteId: 7, fornecedorId: null, contraparte: "Cliente operacional", numeroParcela: 1, totalParcelas: 1, valorOriginal: "990.00", desconto: "0.00", juros: "0.00", valorDevido: 990, valorBaixado: 0, saldoAberto: 990, dataVencimento: "2026-09-10T00:00:00.000Z", diasParaVencimento: 15, prioridade: "normal", faixaAging: "a_vencer", temBaixaConciliada: false, baixas: [] },
      ],
      resumo: { quantidade: 4, saldoAberto: 2240, vencido: 700, venceHoje: 250, proximosSeteDias: 300, aging: { a_vencer: 1290, vence_hoje: 250, "1_7": 0, "8_30": 700, "31_60": 0, "61_90": 0, mais_90: 0, encerrado: 0 } },
      agrupamentos: [], top5Contrapartes: [],
      convencaoContaFinanceira: "O filtro por conta retorna somente títulos que já possuem baixa válida nessa conta; títulos em aberto não recebem conta prevista.",
    };
  });

  it("pede confirmação e remove o título da listagem após confirmar a exclusão", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    await user.click(screen.getAllByRole("button", { name: /contas a receber/i }).at(-1)!);
    await user.type(screen.getByLabelText("Descrição ou contraparte"), "Recebimento para cancelar");
    await user.click(screen.getByRole("button", { name: "Pesquisar" }));

    const linha = screen.getByText("Recebimento para cancelar").closest("tr");
    expect(linha).not.toBeNull();
    await user.click(within(linha!).getByRole("button", { name: "Excluir" }));

    expect(screen.getByRole("heading", { name: "Excluir lançamento financeiro" })).toBeInTheDocument();
    expect(screen.getByText(/desconcilie o movimento bancário correspondente/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar exclusão" }));

    await waitFor(() => {
      expect(state.cancelar).toHaveBeenCalledWith({ id: 10 });
      expect(state.invalidar).toHaveBeenCalled();
      expect(screen.queryByText("Recebimento para cancelar")).not.toBeInTheDocument();
    });
  });

  it("apresenta o fluxo de caixa com filtros de período e indicadores de saldo", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    await user.click(screen.getAllByRole("button", { name: "Fluxo de caixa" })[0]);

    expect(screen.getByRole("heading", { name: "Relatório de fluxo de caixa" })).toBeInTheDocument();
    expect(screen.getByLabelText("Data inicial do fluxo de caixa")).toHaveAttribute("type", "date");
    expect(screen.getByLabelText("Data final do fluxo de caixa")).toHaveAttribute("type", "date");
    expect(screen.getByText("Saldo final")).toBeInTheDocument();
    expect(screen.getByText("Recebimento demonstrativo")).toBeInTheDocument();
    expect(screen.getByText("Previsão semanal de caixa")).toBeInTheDocument();
    expect(screen.getByText("Títulos projetados")).toBeInTheDocument();
    expect(screen.getByText("Previsão semanal de caixa").closest("section")).toHaveTextContent(/-R\$\s*20,00/);
    expect(screen.getByRole("heading", { name: "Fluxo de caixa gerencial" })).toBeInTheDocument();
    expect(screen.getByText("1 movimento(s) bancário(s) aguardam conciliação.")).toBeInTheDocument();
    expect(screen.getByText("Vendas")).toBeInTheDocument();
  });

  it("distingue a compra de diesel para o tanque do custo de abastecimento", async () => {
    const user = userEvent.setup();
    state.fluxo = {
      saldoAbertura: -64700,
      entradas: 0,
      saidas: 64700,
      saldoLiquido: -64700,
      saldoFinal: -64700,
      quantidadeMovimentos: 1,
      dias: [{ data: "2026-07-20", entradas: 0, saidas: 64700, saldoLiquido: -64700, saldoAcumulado: -64700 }],
      movimentos: [{ id: 90, tipo: "pagar", origem: "nota_diesel", descricao: "Pagamento de diesel — Nota 0001", valor: "64700.00", dataBaixa: "2026-07-20T12:00:00.000Z", formaPagamento: "outro", contaNome: "Numerário em trânsito" }],
    };
    const { container } = render(<FinanceiroPage />);
    const tela = within(container);

    await user.click(tela.getByRole("button", { name: "Fluxo de caixa" }));

    expect(tela.getByText(/saldo de abertura incorpora o saldo inicial/i)).toBeInTheDocument();
    expect(tela.getByText(/Antes do período, com histórico anterior/i)).toBeInTheDocument();
    expect(tela.getByText(/Compra para estoque do tanque/i)).toHaveTextContent(/custo é apropriado nos abastecimentos/i);
  });

  it("identifica a abertura direta do relatório pelo parâmetro de URL", () => {
    expect(abaFinanceiraDaUrl("?aba=fluxo")).toBe("fluxo");
    expect(abaFinanceiraDaUrl("?tipo=receber")).toBe("lancamentos");
    expect(abaFinanceiraDaUrl("?tipo=pagas")).toBe("lancamentos");
    expect(abaFinanceiraDaUrl("?tipo=recebidas")).toBe("lancamentos");
  });

  it("abre a lista solicitada pela lateral sem repetir o resumo financeiro", () => {
    state.search = "?tipo=receber";
    const { container } = render(<FinanceiroPage />);
    const tela = within(container);

    expect(tela.getByText("Gestão de títulos")).toBeInTheDocument();
    expect(tela.getAllByText("Contas a receber").length).toBeGreaterThan(1);
    expect(tela.queryByText("Títulos vencidos")).not.toBeInTheDocument();
    expect(tela.queryByRole("heading", { name: "Próximos 30 dias" })).not.toBeInTheDocument();
  });

  it("abre os históricos financeiros diretamente pelos novos atalhos laterais", () => {
    state.search = "?tipo=pagas";
    const { container } = render(<FinanceiroPage />);
    const tela = within(container);

    expect(tela.getAllByText("Contas pagas").length).toBeGreaterThan(1);
    expect(tela.queryByText("Títulos vencidos")).not.toBeInTheDocument();
  });

  it("mantém a lista vazia até pesquisar, filtra títulos e destaca os compromissos do dia", async () => {
    const user = userEvent.setup();
    const hoje = new Date().toISOString();
    state.titulos.push(
      { id: 14, descricao: "Fornecedor vence hoje", tipo: "pagar", estado: "aberto", valorOriginal: "850.00", valorBaixado: "0.00", desconto: "0.00", juros: "0.00", dataVencimento: hoje },
      { id: 15, descricao: "Conta paga arquivada", tipo: "pagar", estado: "quitado", valorOriginal: "200.00", valorBaixado: "200.00", desconto: "0.00", juros: "0.00", dataVencimento: hoje },
      { id: 16, descricao: "Receita recebida arquivada", tipo: "receber", estado: "quitado", valorOriginal: "300.00", valorBaixado: "300.00", desconto: "0.00", juros: "0.00", dataVencimento: hoje },
    );
    render(<FinanceiroPage />);

    expect(screen.queryByText("Fornecedor vence hoje")).not.toBeInTheDocument();
    expect(screen.getByText(/use os filtros acima para consultar lançamentos/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Descrição ou contraparte")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor mínimo")).toHaveAttribute("inputmode", "decimal");
    expect(screen.getAllByLabelText("Data inicial")[0]).toHaveAttribute("type", "date");
    expect(screen.getAllByLabelText("Data final")[0]).toHaveAttribute("type", "date");

    await user.type(screen.getByLabelText("Descrição ou contraparte"), "fornecedor vence");
    await user.click(screen.getByRole("button", { name: "Pesquisar" }));
    expect(screen.getAllByText("Fornecedor vence hoje").length).toBeGreaterThan(0);
    expect(screen.getByText(/1 vencem hoje/i)).toBeInTheDocument();
    const tabelaPagar = screen.getAllByRole("table").find((tabela) => within(tabela).queryByText("Fornecedor vence hoje"));
    expect(tabelaPagar).toBeDefined();
    expect(within(tabelaPagar!).queryByText("Carga de toras RC-001")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByText(/use os filtros acima para consultar lançamentos/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Descrição ou contraparte"), "arquivada");
    await user.click(screen.getByRole("button", { name: "Pesquisar" }));
    await user.click(screen.getAllByRole("button", { name: "Visão financeira: Contas pagas" }).at(-1)!);
    expect(screen.getByText("Conta paga arquivada")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Visão financeira: Contas recebidas" }).at(-1)!);
    expect(screen.getByText("Receita recebida arquivada")).toBeInTheDocument();
  }, 10_000);

  it("aplica períodos rápidos e apresenta totais a pagar e receber do resultado pesquisado", async () => {
    const user = userEvent.setup();
    const agora = new Date();
    const vencimentoHoje = agora.toISOString();
    const vencimentoAntigo = new Date(agora.getTime() - 12 * 24 * 60 * 60 * 1000).toISOString();
    state.titulos.push(
      { id: 81, descricao: "Fornecedor do período", tipo: "pagar", estado: "aberto", valorOriginal: "500.00", valorBaixado: "0.00", desconto: "0.00", juros: "0.00", dataVencimento: vencimentoHoje },
      { id: 82, descricao: "Cliente do período", tipo: "receber", estado: "aberto", valorOriginal: "1200.00", valorBaixado: "0.00", desconto: "0.00", juros: "0.00", dataVencimento: vencimentoHoje },
      { id: 83, descricao: "Fornecedor fora do período", tipo: "pagar", estado: "aberto", valorOriginal: "900.00", valorBaixado: "0.00", desconto: "0.00", juros: "0.00", dataVencimento: vencimentoAntigo },
    );
    render(<FinanceiroPage />);

    expect(screen.getByText("Atalhos:")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hoje" }));

    expect(screen.getByText("Fornecedor do período")).toBeInTheDocument();
    expect(screen.queryByText("Fornecedor fora do período")).not.toBeInTheDocument();
    expect(screen.getAllByText("No resultado pesquisado")).toHaveLength(2);
    expect(screen.getAllByText(/R\$\s*500,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s*1\.200,00/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Últimos 7 dias" }));
    expect(screen.getByText("Fornecedor do período")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Este mês" }));
    await user.click(screen.getAllByRole("button", { name: "Visão financeira: Contas a receber" }).at(-1)!);
    expect(screen.getByText("Cliente do período")).toBeInTheDocument();
  });

  it("pesquisa recebimentos de serragem pela origem e pela data efetiva", async () => {
    const user = userEvent.setup();
    state.titulos.push({
      id: 84,
      descricao: "Serviço de serragem — Cliente teste",
      origem: "serragem_terceiros",
      tipo: "receber",
      estado: "quitado",
      valorOriginal: "2055.78",
      valorBaixado: "2055.78",
      desconto: "0.00",
      juros: "0.00",
      dataVencimento: "2026-08-10T00:00:00.000Z",
      dataUltimaBaixa: "2026-08-19T00:00:00.000Z",
    });
    render(<FinanceiroPage />);

    await user.click(screen.getAllByRole("button", { name: "Visão financeira: Contas recebidas" }).at(-1)!);
    expect(screen.getByText("Recebimentos efetivados")).toBeInTheDocument();
    expect(screen.getByText(/data efetiva da baixa/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Serviços de serragem" }));
    await user.click(screen.getByRole("button", { name: "Pesquisar" }));

    expect(state.ultimaConsultaTitulos).toEqual(expect.objectContaining({ origem: "serragem_terceiros", criterioData: "baixa" }));
    expect(screen.getByText("Serviço de serragem — Cliente teste")).toBeInTheDocument();
  });

  it("permite reagendar o vencimento de uma conta vinculada ao romaneio de carga", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);
    await user.type(screen.getByLabelText("Descrição ou contraparte"), "Carga de toras");
    await user.click(screen.getByRole("button", { name: "Pesquisar" }));

    const linha = screen.getAllByText("Carga de toras RC-001").map((elemento) => elemento.closest("tr")).find(Boolean);
    expect(linha).not.toBeNull();
    await user.click(within(linha!).getByRole("button", { name: "Editar Carga de toras RC-001" }));

    expect(screen.getByRole("heading", { name: "Editar lançamento" })).toBeInTheDocument();
    expect(screen.getByText(/alterações de vencimento também atualizam o romaneio de carga vinculado/i)).toBeInTheDocument();
    const dialogoEdicao = screen.getByRole("dialog");
    const vencimento = within(dialogoEdicao).getByLabelText("Vencimento *");
    await user.clear(vencimento);
    await user.type(vencimento, "2026-09-11");
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => {
      expect(state.atualizar).toHaveBeenCalledWith(expect.objectContaining({ id: 13, dataVencimento: "2026-09-11" }));
      expect(state.invalidar).toHaveBeenCalled();
    });
  });

  it("confirma o estorno com motivo e sinaliza a baixa preservada como estornada", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    await user.click(screen.getAllByRole("button", { name: "Visão financeira: Contas a receber" }).at(-1)!);
    await user.type(screen.getByLabelText("Descrição ou contraparte"), "Recebimento com baixa");
    await user.click(screen.getByRole("button", { name: "Pesquisar" }));

    const linha = screen.getAllByText("Recebimento com baixa").map((elemento) => elemento.closest("tr")).find(Boolean);
    expect(linha).not.toBeNull();
    await user.click(within(linha!).getByRole("button", { name: "Baixas" }));
    await user.click(screen.getByRole("button", { name: "Estornar" }));

    expect(screen.getByRole("heading", { name: "Estornar baixa financeira" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Motivo do estorno *"), "Pagamento duplicado");
    await user.click(screen.getByRole("button", { name: "Confirmar estorno" }));

    await waitFor(() => {
      expect(state.estornar).toHaveBeenCalledWith({ id: 40, motivo: "Pagamento duplicado" });
      expect(screen.getByText("Estornada")).toBeInTheDocument();
      expect(screen.getByText(/Pagamento duplicado/)).toBeInTheDocument();
    });
  }, 10_000);

  it("abre a edição pela descrição e mantém a categoria de receita da venda", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    await user.click(screen.getAllByRole("button", { name: /contas a receber/i }).at(-1)!);
    await user.type(screen.getByLabelText("Descrição ou contraparte"), "Recebimento para cancelar");
    await user.click(screen.getByRole("button", { name: "Pesquisar" }));
    await user.click(screen.getByRole("button", { name: "Editar Recebimento para cancelar" }));

    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByRole("heading", { name: "Editar lançamento" })).toBeInTheDocument();
    expect(within(dialogo).getByText("Receitas de vendas")).toBeInTheDocument();
  });

  it("oferece modelo, exportação e importação CSV com orientação de validação", async () => {
    render(<FinanceiroPage />);

    expect(screen.getAllByRole("button", { name: "Modelo CSV" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Exportar CSV" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Exportar PDF" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Importar CSV" }).at(-1)!);
    expect(screen.getByRole("heading", { name: "Importar lançamentos financeiros" })).toBeInTheDocument();
    expect(screen.getByText(/se houver alguma linha inválida/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Arquivo CSV para importação")).toHaveAttribute("accept", ".csv,text/csv");
  });

  it("permite preparar documentos e conferir a linha digitável em um lançamento a pagar", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    fireEvent.click(screen.getByRole("button", { name: /novo lançamento/i }));

    expect(screen.getByText("Documentos do lançamento")).toBeInTheDocument();
    const seletorTipo = screen.getByText("Conta a receber", { exact: true }).closest('[role="combobox"]');
    fireEvent.click(seletorTipo!);
    fireEvent.click(screen.getByRole("option", { name: "Conta a pagar" }));
    const anexo = screen.getByLabelText("Anexar documentos do lançamento");
    expect(anexo).toHaveAttribute("accept", "application/pdf,image/jpeg,image/png,image/webp");
    fireEvent.change(anexo, { target: { files: [new File(["boleto"], "boleto-agosto.pdf", { type: "application/pdf" })] } });
    expect(screen.getAllByText("boleto-agosto.pdf").length).toBeGreaterThan(0);

    const codigo = screen.getByLabelText("Código de barras ou linha digitável");
    await user.type(codigo, "00190500954014481606906809350314337370000000100");
    expect(codigo).toHaveValue("00190500954014481606906809350314337370000000100");
  });

  it("copia o código do boleto e pré-visualiza o PDF anexado ao agendamento", async () => {
    const copiar = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copiar } });
    render(<FinanceiroPage />);
    await user.type(screen.getByLabelText("Descrição ou contraparte"), "Carga de toras");
    await user.click(screen.getByRole("button", { name: "Pesquisar" }));

    const tabelaPagar = screen.getAllByRole("table").find((tabela) => within(tabela).queryByText("Carga de toras RC-001"));
    expect(tabelaPagar).toBeDefined();
    fireEvent.click(within(tabelaPagar!).getByRole("button", { name: "Editar Carga de toras RC-001" }));

    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Copiar" }));
    await waitFor(() => expect(copiar).toHaveBeenCalledWith("00190500954014481606906809350314337370000000100"));

    await user.click(within(dialogo).getByRole("button", { name: "Visualizar boleto-agosto.pdf" }));
    expect(screen.getByTitle("Pré-visualização de boleto-agosto.pdf")).toHaveAttribute("src", "https://documentos.exemplo/boleto-agosto.pdf");
  });

  it("exporta somente os títulos visíveis após aplicar os filtros", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    await user.click(screen.getByRole("button", { name: "Visão financeira: Contas a pagar" }));
    await user.type(screen.getByLabelText("Descrição ou contraparte"), "carga de toras");
    await user.click(screen.getByRole("button", { name: "Pesquisar" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Exportar PDF" }).at(-1)!);

    await waitFor(() => {
      expect(state.exportarPdf).toHaveBeenCalledWith(expect.objectContaining({
        titulo: "Contas a pagar",
        titulos: [expect.objectContaining({ descricao: "Carga de toras RC-001" })],
      }));
    });
    expect(await screen.findByLabelText("Pré-visualização: Relatório financeiro")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar download" })).toBeInTheDocument();
  });

  it("seleciona títulos e envia uma alteração parcial em lote", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);
    await user.click(screen.getByRole("button", { name: "Visão financeira: Contas a receber" }));
    await user.type(screen.getByLabelText("Descrição ou contraparte"), "Recebimento");
    await user.click(screen.getByRole("button", { name: "Pesquisar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Recebimento para cancelar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Recebimento preservado" }));
    fireEvent.click(screen.getByRole("button", { name: /editar 2 em lote/i }));
    fireEvent.change(screen.getByLabelText("Descrição"), { target: { value: "Recebimento revisado" } });
    fireEvent.click(screen.getByRole("button", { name: /salvar alterações em lote/i }));
    expect(state.atualizarLote).toHaveBeenCalledWith(expect.objectContaining({ ids: [10, 11], descricao: "Recebimento revisado" }));
  });

  it("permite criar um Centro de Custo no contexto e aplicá-lo em lote sem duplicar a rentabilidade", async () => {
    state.centrosCusto = [{ id: 21, nome: "Produção", tipo: "industrial", ativo: true }];
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    await user.click(screen.getByRole("button", { name: "Visão financeira: Contas a receber" }));
    await user.type(screen.getByLabelText("Descrição ou contraparte"), "Recebimento");
    await user.click(screen.getByRole("button", { name: "Pesquisar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Recebimento para cancelar" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Selecionar Recebimento preservado" }));
    await user.click(screen.getByRole("button", { name: /editar 2 em lote/i }));

    expect(screen.getByText(/não duplica o custo na Rentabilidade da Madeira/i)).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: "Centro de Custo para edição em lote" }));
    await user.click(screen.getByText("Criar novo Centro de Custo"));
    await user.type(screen.getByLabelText("Nome *"), "Matéria-prima");
    await user.click(screen.getByRole("button", { name: "Criar Centro de Custo" }));

    expect(state.criarCentroCusto).toHaveBeenCalledWith({ nome: "Matéria-prima", tipo: "industrial", observacoes: null });
    await user.click(screen.getByRole("button", { name: /salvar alterações em lote/i }));
    expect(state.atualizarLote).toHaveBeenCalledWith(expect.objectContaining({ ids: [10, 11], centroCustoId: 22 }));
  });

  it("exibe cards rastreáveis e aging usando o mesmo conjunto de títulos operacionais", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    expect(screen.getByText("Aging por vencimento")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /vencido/i }).some((botao) => botao.textContent?.startsWith("Vencido"))).toBe(true);
    expect(screen.getByRole("button", { name: /total a vencer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /próximos 30 dias/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /% vencido/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /atraso 8–30/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /atraso 8–30/i }));
    const tabela = screen.getAllByRole("table").find((elemento) => within(elemento).queryByText("Fornecedor atrasado"));
    expect(tabela).toBeDefined();
    expect(within(tabela!).queryByText("Fornecedor parcial")).not.toBeInTheDocument();
    expect(within(tabela!).getByText("Frete vencido")).toBeInTheDocument();
  });

  it("filtra a fila de recebimentos pelo cliente selecionado", async () => {
    state.contasOperacionais.itens.push({ id: 94, tipo: "receber", estado: "aberto", descricao: "Venda de outro cliente", origem: "manual", competencia: null, categoriaId: 1, categoriaNome: "Receitas de vendas", clienteId: 8, fornecedorId: null, contraparte: "Outro cliente", numeroParcela: 1, totalParcelas: 1, valorOriginal: "350.00", desconto: "0.00", juros: "0.00", valorDevido: 350, valorBaixado: 0, saldoAberto: 350, dataVencimento: "2026-09-12T00:00:00.000Z", diasParaVencimento: 17, prioridade: "normal", faixaAging: "a_vencer", temBaixaConciliada: false, baixas: [] });
    state.contasOperacionais.top5Contrapartes = [{ contraparte: "Cliente operacional", clienteId: 7, fornecedorId: null, saldoAberto: 540, quantidade: 1, vencido: 0 }];
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    await user.click(screen.getAllByRole("button", { name: "Visão financeira: Contas a receber" }).at(-1)!);
    await user.click(screen.getByRole("button", { name: /Cliente operacional/i }));

    await waitFor(() => expect(state.ultimaConsultaOperacional?.clienteId).toBe(7));
  });

  it("apresenta saldo residual, baixas e ações do detalhe para um título parcial", async () => {
    const user = userEvent.setup();
    render(<FinanceiroPage />);

    await user.click(screen.getByText("Fornecedor parcial"));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Saldo em aberto")).toBeInTheDocument();
    expect(within(dialogo).getByText((_, elemento) => elemento?.textContent === "R$ 250,00")).toBeInTheDocument();
    expect(within(dialogo).getByText(/já pago/i)).toBeInTheDocument();
    expect(within(dialogo).getByText((_, elemento) => elemento?.textContent === "R$ 950,00")).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Pagar" })).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: "Baixas" })).toBeInTheDocument();
  });
});
