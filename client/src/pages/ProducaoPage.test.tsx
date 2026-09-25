import React from "react";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const criarSerragemMock = vi.hoisted(() => vi.fn());
const atualizarSerragemMock = vi.hoisted(() => vi.fn());
const definirLocalizacaoMock = vi.hoisted(() => vi.fn());
const confirmarVariacoesMock = vi.hoisted(() => vi.fn());
const resumoPlaquetasMock = vi.hoisted(() => ({
  totalDisponiveis: 300,
  totalVolumeDisponivel: 178.246,
  volumeMedioPorTora: 0.594,
  essenciasDisponiveis: [
    { essencia: "CEDRINHO", quantidade: 158, volume: 174.451, volumeMedio: 1.104 },
    { essencia: "MISTA", quantidade: 86, volume: 88.171, volumeMedio: 1.025 },
  ],
  alertaVariacaoAtipica: false,
  essenciasAtipicas: [] as string[],
  variacoesAtipicas: [] as Array<{ essencia: string; assinatura: string }>,
  proximoDeslocamento: null,
}));

vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

vi.mock("wouter", () => ({ useSearch: () => "", useLocation: () => ["/producao", definirLocalizacaoMock] }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const queryVazia = { useQuery: () => ({ data: [], isLoading: false }) };
  const plaquetas = [
    { id: 8, codigo: "TOR-0008", madeiraNome: "Cedrinho", diametro: "30.00", comprimento: "4.20", volumeInicial: "0.380000", volumeDisponivel: "0.380000", dataEntrada: "2026-08-12T12:00:00.000Z", estado: "disponivel" },
    { id: 9, codigo: "INT-009", codigoFisico: "TOR-DUP", situacaoIdentificacao: "duplicada", madeiraNome: "Piqui", diametro: "45.00", comprimento: "5.00", volumeInicial: "0.795000", volumeDisponivel: "0.795000", dataEntrada: "2026-08-12T12:00:00.000Z", estado: "disponivel" },
  ];
  const plaquetaForaDaLista = { id: 1012, codigo: "1012", codigoFisico: "1012", madeiraNome: "Cedrinho", diametro: "37.00", comprimento: "7.00", volumeInicial: "0.752647", volumeDisponivel: "0.752647", dataEntrada: "2026-07-24T12:00:00.000Z", estado: "disponivel" };
  const buscarPlaqueta = vi.fn(async ({ codigo }: { codigo: string }) => [...plaquetas, plaquetaForaDaLista].find((item) => item.codigo === codigo || item.codigoFisico === codigo) ?? null);
  const romaneios = [{ id: 14, numero: "ROM-000014", dataProducao: "2026-08-12T12:00:00.000Z", plaquetaCodigo: "TOR-0008", madeiraTora: "Cedrinho", volumeTora: "0.380000", totalPecas: 12, volumeProduzido: "0.210000", aproveitamento: "55.26", fita: "Fita 1" }];
  const detalheRomaneio = { romaneio: { dataProducao: "2026-08-12T12:00:00.000Z", fita: "Fita 1", responsavel: "João", observacoes: "Ajuste de produção" }, toras: [{ plaquetaId: 8, codigo: "TOR-0008", madeiraNome: "Cedrinho", diametro: "30", comprimento: "4.2", volume: "0.38" }], itens: [{ madeiraNome: "Cedrinho", espessura: "3", largura: "5", comprimento: "2", quantidade: 11 }] };
  const serragens = [{ id: 31, numero: "SER-000031", clienteNome: "Marcenaria Silva", dataProducao: "2026-08-14T12:00:00.000Z", volumeToras: "0.750000", volumeProduzido: "0.390000", valorServico: "450.00" }];
  const detalheSerragem = { servico: { clienteId: 1, dataProducao: "2026-08-14T12:00:00.000Z", dataVencimento: "2026-08-20T12:00:00.000Z", responsavel: "João", observacoes: "Sem observações", valorMetroCubico: "600.00" }, toras: [{ referencia: "CLI-01", madeiraNome: "Cedrinho", diametro: "50", comprimento: "4", volume: "0.785398" }], itens: [{ madeiraNome: "Cedrinho", espessura: "2.5", largura: "15", comprimento: "3", quantidade: 10 }], lotes: [{ id: 71, madeiraNome: "Cedrinho", espessura: "3", largura: "5", comprimento: "2", quantidadeDisponivel: 12 }] };
  const mutationInerte = { useMutation: () => ({ mutate: vi.fn(), isPending: false }) };
  const invalidar = { invalidate: vi.fn() };
  return {
    trpc: {
      useUtils: () => ({ producao: { plaquetas: { list: invalidar, buscar: { fetch: buscarPlaqueta } }, romaneios: { list: invalidar, detalhe: { fetch: vi.fn().mockResolvedValue(detalheRomaneio) } }, estoque: { resumo: invalidar }, serragemTerceiros: { list: invalidar, detalhe: { fetch: vi.fn().mockResolvedValue(detalheSerragem) } } }, cliente: { list: invalidar } }),
      producao: {
        plaquetas: { list: { useQuery: () => ({ data: { itens: plaquetas, total: 2, ...resumoPlaquetasMock }, isLoading: false }) }, buscar: { useQuery: ({ codigo }: { codigo: string }) => ({ data: [...plaquetas, plaquetaForaDaLista].find((item) => item.codigo === codigo || item.codigoFisico === codigo) ?? null, isLoading: false }) }, semIdentificacaoDisponiveis: { useQuery: () => ({ data: [{ id: 77, codigo: "SEM-000077", madeiraNome: "Cedrinho", diametro: "32.00", comprimento: "4.50", volumeInicial: "0.452390", volumeDisponivel: "0.452390", dataEntrada: "2026-08-15T12:00:00.000Z" }], isLoading: false }) }, confirmarVariacoesAtipicas: { useMutation: () => ({ isPending: false, mutate: (input: { variacoes: Array<{ essencia: string; assinatura: string }> }, callbacks: { onSuccess?: () => void }) => { confirmarVariacoesMock(input); callbacks.onSuccess?.(); } }) }, create: mutationInerte },
        romaneios: { list: { useQuery: () => ({ data: romaneios, isLoading: false }) }, itens: queryVazia, confirmar: mutationInerte, update: mutationInerte, atualizarCabecalhoEmLote: mutationInerte, excluir: mutationInerte, modeloTorasCsv: { useQuery: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }) }, importarTorasCsv: mutationInerte, modeloPecasCsv: { useQuery: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }) }, importarPecasCsv: mutationInerte },
        estoque: { resumo: queryVazia },
        serragemTerceiros: { list: { useQuery: () => ({ data: serragens, isLoading: false }) }, criar: { useMutation: () => ({ mutate: criarSerragemMock, isPending: false }) }, update: { useMutation: () => ({ mutate: atualizarSerragemMock, isPending: false }) }, atualizarCabecalhoEmLote: mutationInerte, registrarRetirada: mutationInerte, modeloTorasCsv: { useQuery: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }) }, importarTorasCsv: mutationInerte, modeloPecasCsv: { useQuery: () => ({ data: undefined, isLoading: false, refetch: vi.fn() }) }, importarPecasCsv: mutationInerte },
      },
      cliente: { list: { useQuery: () => ({ data: [{ id: 1, nome: "Marcenaria Silva", telefone: "(67) 99999-0000" }], isLoading: false }) }, create: mutationInerte },
    },
  };
});

import ProducaoPage from "./ProducaoPage";

Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => false });
Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: () => undefined });
Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: () => undefined });
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: () => undefined });

afterEach(() => { cleanup(); criarSerragemMock.mockReset(); atualizarSerragemMock.mockReset(); confirmarVariacoesMock.mockReset(); definirLocalizacaoMock.mockReset(); Object.assign(resumoPlaquetasMock, { totalDisponiveis: 300, totalVolumeDisponivel: 178.246, volumeMedioPorTora: 0.594, essenciasDisponiveis: [{ essencia: "CEDRINHO", quantidade: 158, volume: 174.451, volumeMedio: 1.104 }, { essencia: "MISTA", quantidade: 86, volume: 88.171, volumeMedio: 1.025 }], alertaVariacaoAtipica: false, essenciasAtipicas: [], variacoesAtipicas: [], proximoDeslocamento: null }); });

describe("ProducaoPage", () => {
  it("apresenta somente a produção diária e orienta o uso prévio do Estoque", () => {
    render(<ProducaoPage />);

    expect(screen.getByRole("heading", { name: "Produção diária" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova produção diária" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Nova produção/i })).toHaveLength(1);
    expect(screen.queryByRole("tab", { name: "Estoque de toras" })).not.toBeInTheDocument();
    expect(screen.getByText(/Registre todas as plaquetas serradas no dia/i)).toBeInTheDocument();
    expect(screen.getByText("Toras disponíveis").closest(".rounded-xl")).toHaveTextContent("300");
    expect(screen.getByText("Toras disponíveis").closest(".rounded-xl")).toHaveTextContent("178,246 m³");
    expect(screen.getByText("Toras disponíveis").closest(".rounded-xl")).toHaveTextContent("Média: 0,594 m³/tora");
    expect(screen.getByRole("button", { name: "Filtrar toras de CEDRINHO" })).toHaveTextContent("158 toras · 174,451 m³");
    expect(screen.queryByText(/Variação de volume identificada/i)).not.toBeInTheDocument();
  });

  it("direciona o indicador de toras disponíveis para o Estoque já filtrado", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Ver toras disponíveis" }));
    expect(definirLocalizacaoMock).toHaveBeenCalledWith("/estoque?estado=disponivel");

    await user.click(screen.getByRole("button", { name: "Filtrar toras de CEDRINHO" }));
    expect(definirLocalizacaoMock).toHaveBeenCalledWith("/estoque?estado=disponivel&busca=CEDRINHO");
  });

  it("explica em âmbar as essências que têm toras atipicamente maiores que a média", () => {
    Object.assign(resumoPlaquetasMock, { alertaVariacaoAtipica: true, essenciasAtipicas: ["GARAPEIRA", "CUMARU"], variacoesAtipicas: [{ essencia: "GARAPEIRA", assinatura: "garapeira-atual" }, { essencia: "CUMARU", assinatura: "cumaru-atual" }] });
    render(<ProducaoPage />);

    expect(screen.getByTestId("alerta-variacao-volume")).toHaveClass("border-amber-200");
    expect(screen.getByText(/Há essências com toras muito maiores que a média/i)).toHaveTextContent("GARAPEIRA, CUMARU");
  });

  it("permite confirmar a variação para ocultar o aviso até uma nova alteração de volumes", async () => {
    const user = userEvent.setup();
    Object.assign(resumoPlaquetasMock, { alertaVariacaoAtipica: true, essenciasAtipicas: ["GARAPEIRA"], variacoesAtipicas: [{ essencia: "GARAPEIRA", assinatura: "garapeira-atual" }] });
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Marcar como conferida" }));

    expect(confirmarVariacoesMock).toHaveBeenCalledWith({ variacoes: [{ essencia: "GARAPEIRA", assinatura: "garapeira-atual" }] });
  });

  it("oferece a serragem de terceiros no mesmo fluxo em duas etapas da produção diária", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    expect(screen.getByText(/Toras recebidas de clientes não entram no estoque próprio/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Serragem de terceiros" }));

    expect(screen.getByRole("dialog")).toHaveTextContent(/O mesmo processo da produção diária/i);
    expect(screen.getByRole("tab", { name: "1. Toras serradas" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "2. Peças produzidas" })).toBeDisabled();
    expect(screen.getByText("Toras do cliente")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar para peças" })).toBeDisabled();
  });

  it("calcula o volume das toras de terceiros, mostra a cobrança por m³ e repete a última essência", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Serragem de terceiros" }));
    await user.type(screen.getByLabelText("Referência da tora 1"), "CLI-02");
    await user.type(screen.getByLabelText("Essência da tora 1"), "Cedrinho");
    await user.type(screen.getByLabelText("Diâmetro da tora 1"), "50");
    await user.type(screen.getByLabelText("Comprimento da tora 1"), "4");
    await user.type(screen.getByLabelText("Tarifa por m³ (R$) *"), "50");

    expect(screen.getByDisplayValue("0,785")).toBeInTheDocument();
    expect(screen.getByText(/Cobrança calculada:/)).toHaveTextContent("R$ 39,27");

    await user.click(screen.getByRole("button", { name: "Adicionar tora" }));
    expect(screen.getByLabelText("Referência da tora 1")).toHaveValue("");
    expect(screen.getByLabelText("Essência da tora 1")).toHaveValue("Cedrinho");
    expect(screen.getByLabelText("Referência da tora 2")).toHaveValue("CLI-02");
  });

  it("usa a mesma grade padrão de comprimentos editáveis da produção diária", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Serragem de terceiros" }));
    await user.click(screen.getByRole("combobox", { name: "Cliente proprietário" }));
    await user.click(screen.getAllByRole("option")[1]);
    await user.type(screen.getByLabelText("Referência da tora 1"), "CLI-03");
    await user.type(screen.getByLabelText("Essência da tora 1"), "Cedrinho");
    await user.type(screen.getByLabelText("Diâmetro da tora 1"), "50");
    await user.type(screen.getByLabelText("Comprimento da tora 1"), "4");
    await user.type(screen.getByLabelText("Tarifa por m³ (R$) *"), "50");
    await user.click(screen.getByRole("button", { name: "Continuar para peças" }));
    expect(screen.getByText("Romaneio de madeira serrada")).toBeInTheDocument();
    expect(screen.getByLabelText("Essência da medida de terceiros")).toHaveValue("Cedrinho");
    expect(screen.getByLabelText("Comprimento da peça de terceiros 1")).toHaveValue("2");
    expect(screen.getByLabelText("Comprimento da peça de terceiros 15")).toHaveValue("9");
    await user.type(screen.getByLabelText("Espessura da medida de terceiros"), "2.5");
    await user.type(screen.getByLabelText("Largura da medida de terceiros"), "15");
    await user.clear(screen.getByLabelText("Comprimento da peça de terceiros 1"));
    await user.type(screen.getByLabelText("Comprimento da peça de terceiros 1"), "3");
    await user.type(screen.getByLabelText("Quantidade da peça de terceiros 1"), "10");
    await user.click(screen.getByRole("button", { name: "Adicionar comprimentos ao romaneio" }));
    await user.click(screen.getByRole("button", { name: "Registrar serviço" }));

    expect(criarSerragemMock).toHaveBeenCalledOnce();
    const [dados] = criarSerragemMock.mock.calls[0];
    expect(dados.toras).toHaveLength(1);
    expect(dados.itens).toHaveLength(1);
    expect(dados.toras[0]).toMatchObject({ referencia: "CLI-03", madeiraNome: "Cedrinho", volume: "0.785398" });
    expect(dados.itens[0]).toMatchObject({ madeiraNome: "Cedrinho", quantidade: 10 });
  });

  it("permite avançar ao romaneio de peças sem informar a plaqueta da tora de terceiro", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Serragem de terceiros" }));
    await user.click(screen.getByRole("combobox", { name: "Cliente proprietário" }));
    await user.click(screen.getAllByRole("option")[1]);
    await user.type(screen.getByLabelText("Essência da tora 1"), "Cedrinho");
    await user.type(screen.getByLabelText("Diâmetro da tora 1"), "50");
    await user.type(screen.getByLabelText("Comprimento da tora 1"), "4");
    await user.type(screen.getByLabelText("Tarifa por m³ (R$) *"), "50");

    const continuar = screen.getByRole("button", { name: "Continuar para peças" });
    expect(continuar).toBeEnabled();
    await user.click(continuar);

    expect(screen.getByText("Romaneio de madeira serrada")).toBeInTheDocument();
  });

  it("permite criar um cliente diretamente no seletor de serragem", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Serragem de terceiros" }));
    await user.click(screen.getByRole("combobox", { name: "Cliente proprietário" }));
    await user.click(screen.getByRole("option", { name: "Criar novo cliente" }));

    expect(screen.getByRole("heading", { name: "Novo cliente" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Nome do cliente")).toBeInTheDocument();
  });

  it("abre a retirada das peças de terceiros com o saldo disponível", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Registrar retirada" }));

    expect(await screen.findByRole("heading", { name: "Registrar retirada de peças" })).toBeInTheDocument();
    expect(screen.getByText(/Disponível para retirada/i)).toHaveTextContent("12 peça(s)");
    expect(screen.getByLabelText("Retirar agora — Cedrinho")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar retirada" })).toBeInTheDocument();
  });

  it("abre a serragem de terceiros para edição e envia a atualização do preço e das peças", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Editar serviço" }));
    expect(await screen.findByLabelText("Tarifa por m³ (R$) *")).toHaveValue("600.00");
    await user.clear(screen.getByLabelText("Tarifa por m³ (R$) *"));
    await user.type(screen.getByLabelText("Tarifa por m³ (R$) *"), "650");
    await user.click(screen.getByRole("button", { name: "Continuar para peças" }));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(atualizarSerragemMock).toHaveBeenCalledWith(expect.objectContaining({ id: 31, valorMetroCubico: "650" }), expect.any(Object));
  });

  it("oferece modelos e importação CSV de toras no serviço de serragem", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Serragem de terceiros" }));

    expect(screen.getByText("Importar toras por planilha")).toBeInTheDocument();
    expect(screen.getByText(/referência “-” pode repetir/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Baixar modelo" })).toHaveLength(1);
    expect(screen.getByLabelText("Importar CSV")).toHaveAttribute("accept", ".csv,text/csv");
  });

  it("adiciona a tora por digitação da plaqueta, permite conferir o resultado consolidado e disponibiliza o PDF", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção diária" }));
    await user.type(screen.getByLabelText("Código da plaqueta"), "TOR-0008");
    await user.keyboard("{Enter}");

    expect(screen.getByDisplayValue("Cedrinho")).toBeInTheDocument();
    expect(screen.getByDisplayValue("30.00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0.380000")).toBeInTheDocument();
    expect(screen.getByText("Resultado das toras serradas")).toBeInTheDocument();
    expect(screen.getByText(/0,38 m³ de Cedrinho/)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.click(screen.getAllByRole("button", { name: "PDF" })[0]);
    expect(screen.getByRole("heading", { name: "Romaneio de Produção ROM-000014" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar download" })).toBeInTheDocument();
  });

  it("localiza por consulta direta a plaqueta existente que não está na lista limitada", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção diária" }));
    await user.type(screen.getByLabelText("Código da plaqueta"), "1012");
    expect(screen.getByText("Plaqueta disponível encontrada. Pressione Enter para adicionar.")).toHaveClass("text-emerald-800");
    await user.keyboard("{Enter}");

    expect(await screen.findByDisplayValue("Cedrinho")).toBeInTheDocument();
    expect(screen.getByDisplayValue("37.00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("0.752647")).toBeInTheDocument();
  });

  it("abre um romaneio confirmado para editar as peças e os dados operacionais", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getAllByRole("button", { name: "Editar" })[0]);

    expect(await screen.findByDisplayValue("Ajuste de produção")).toBeInTheDocument();
    expect(screen.getByText(/Cedrinho · 3 × 5 cm · 2 m/)).toBeInTheDocument();
    expect(screen.getByLabelText("Essência da medida")).toHaveValue("Cedrinho");
    expect(screen.getByLabelText("Comprimento da linha 1")).toHaveValue("2");
  });

  it("permite preparar uma nova plaqueta digitada para entrada e consumo imediato", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção diária" }));
    await user.type(screen.getByLabelText("Código da plaqueta"), "AVU-001");
    await user.keyboard("{Enter}");

    expect(screen.getByText("AVU-001")).toBeInTheDocument();
    expect(screen.getAllByText(/Ajuste as medidas/i)).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Continuar para peças" })).toBeDisabled();
  });

  it("seleciona uma tora sem plaqueta física já existente no estoque sem criar nova identificação", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção diária" }));
    await user.click(screen.getByRole("checkbox", { name: /Aceitar tora sem plaqueta/i }));
    const seletor = screen.getByRole("combobox", { name: "Tora sem plaqueta disponível no estoque" });
    expect(screen.getByText(/A seleção preenche as medidas e preserva a identificação interna já cadastrada/i)).toBeInTheDocument();
    await user.selectOptions(seletor, "77");

    expect(screen.getByText("SEM-000077")).toBeInTheDocument();
    expect(screen.getByDisplayValue("32.00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("4.50")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar para peças" })).toBeEnabled();
  });

  it("não preenche automaticamente as medidas quando a plaqueta física está duplicada", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção diária" }));
    await user.type(screen.getByLabelText("Código da plaqueta"), "TOR-DUP");
    await user.keyboard("{Enter}");

    expect(screen.getByText("TOR-DUP")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Piqui")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar para peças" })).toBeDisabled();
  });

  it("oferece a importação de plaquetas por planilha dentro do romaneio", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção diária" }));
    await user.click(screen.getByRole("button", { name: "Importar planilha" }));

    expect(screen.getByRole("heading", { name: "Importar plaquetas para produção" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Baixar modelo CSV" })).toBeInTheDocument();
    expect(screen.getByLabelText("Planilha CSV de produção")).toBeInTheDocument();
  });

  it("adiciona múltiplos comprimentos em uma grade e mantém a medida para o próximo lançamento", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção diária" }));
    await user.type(screen.getByLabelText("Código da plaqueta"), "TOR-0008");
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Continuar para peças" }));

    expect(screen.getByText(/Nenhum comprimento adicionado/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Essência da medida")).toHaveValue("Cedrinho");
    expect(screen.getByLabelText("Comprimento da linha 1")).toHaveValue("2");
    expect(screen.getByLabelText("Comprimento da linha 15")).toHaveValue("9");

    await user.type(screen.getByLabelText("Espessura da medida"), "3");
    await user.type(screen.getByLabelText("Largura da medida"), "5");
    await user.clear(screen.getByLabelText("Comprimento da linha 1"));
    await user.type(screen.getByLabelText("Comprimento da linha 1"), "2");
    await user.type(screen.getByLabelText("Quantidade da linha 1"), "11");
    await user.clear(screen.getByLabelText("Comprimento da linha 2"));
    await user.type(screen.getByLabelText("Comprimento da linha 2"), "3");
    await user.type(screen.getByLabelText("Quantidade da linha 2"), "7");
    await user.click(screen.getByRole("button", { name: "Adicionar comprimentos ao romaneio" }));

    expect(screen.getByText(/Cedrinho · 3 × 5 cm · 2 m/)).toBeInTheDocument();
    expect(screen.getByText(/11 peças/i)).toBeInTheDocument();
    expect(screen.getByText(/Cedrinho · 3 × 5 cm · 3 m/)).toBeInTheDocument();
    expect(screen.getByText(/7 peças/i)).toBeInTheDocument();
    expect(screen.getByTestId("pecas-por-bitola")).toHaveTextContent("3 × 5 cm");
    expect(screen.getByTestId("pecas-por-bitola")).toHaveTextContent("18 peças");
    expect(screen.getByLabelText("Essência da medida")).toHaveValue("Cedrinho");
    expect(screen.getByLabelText("Espessura da medida")).toHaveValue("3");
    expect(screen.getByLabelText("Largura da medida")).toHaveValue("5");
    expect(screen.getByLabelText("Comprimento da linha 1")).toHaveValue("2");
  });

  it("oferece a importação de peças serradas por planilha na etapa de bitolas", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getByRole("button", { name: "Nova produção diária" }));
    await user.type(screen.getByLabelText("Código da plaqueta"), "TOR-0008");
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Continuar para peças" }));
    await user.click(screen.getByRole("button", { name: "Importar planilha" }));

    expect(screen.getByRole("heading", { name: "Importar peças serradas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Baixar modelo CSV" })).toBeInTheDocument();
    expect(screen.getByLabelText("Planilha CSV de peças")).toBeInTheDocument();
  });

  it("pede confirmação antes de remover uma produção e explica a proteção do estoque", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getAllByRole("button", { name: "Excluir" })[0]);

    expect(screen.getByRole("heading", { name: "Remover produção diária?" })).toBeInTheDocument();
    expect(screen.getByText(/devolve as plaquetas ao estoque/i)).toBeInTheDocument();
    expect(screen.getByText(/já tiver sido entregue, inventariada ou ajustada/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover produção" })).toBeInTheDocument();
  });

  it("permite selecionar romaneios e abrir a alteração coletiva somente de cabeçalho", async () => {
    const user = userEvent.setup();
    render(<ProducaoPage />);

    await user.click(screen.getAllByLabelText("Selecionar romaneio ROM-000014")[0]);
    await user.click(screen.getAllByRole("button", { name: "Alterar cabeçalho em lote" })[0]);

    expect(screen.getByRole("heading", { name: "Alterar cabeçalho de Produções" })).toBeInTheDocument();
    expect(screen.getByText(/itens, toras, peças e totais não serão modificados/i)).toBeInTheDocument();
    expect(screen.getByText("Data da produção")).toBeInTheDocument();
    expect(screen.getByText("Responsável")).toBeInTheDocument();
  });
});
