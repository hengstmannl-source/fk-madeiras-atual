import { beforeEach, describe, expect, it, vi } from "vitest";
import * as db from "./db";
import { registerPdfRoutes } from "./pdfRouter";
import { COOKIE_SESSAO_LOCAL } from "./autenticacao-local";

const localAuthMocks = vi.hoisted(() => ({
  lerSessaoLocal: vi.fn(),
}));

const pdfCanvas = vi.hoisted(() => ({
  drawText: vi.fn(),
  pages: [] as any[],
}));

vi.mock("pdf-lib", async (importOriginal) => {
  const original = await importOriginal<typeof import("pdf-lib")>();
  const page = () => {
    const target = {
      getSize: () => ({ width: 595, height: 842 }),
      drawText: (texto: string, options: Record<string, unknown> = {}) =>
        pdfCanvas.drawText(texto, options, target),
      drawRectangle: vi.fn(),
      drawLine: vi.fn(),
      drawImage: vi.fn(),
    };
    pdfCanvas.pages.push(target);
    return target;
  };

  return {
    ...original,
    PDFDocument: {
      create: vi.fn(async () => ({
        addPage: vi.fn(page),
        getPageCount: () => pdfCanvas.pages.length,
        embedFont: vi.fn(async () => ({})),
        save: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
      })),
    },
  };
});

vi.mock("./autenticacao-local", async (importOriginal) => {
  const original = await importOriginal<typeof import("./autenticacao-local")>();

  return {
    ...original,
    COOKIE_SESSAO_LOCAL: "fk_sessao_local",
    lerSessaoLocal: localAuthMocks.lerSessaoLocal,
  };
});

type Handler = (req: Record<string, unknown>, res: ReturnType<typeof createResponse>) => Promise<void>;

function createResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    setHeader: vi.fn(),
    send: vi.fn(),
  };
}

function textosDoPdf() {
  return pdfCanvas.drawText.mock.calls.map(([texto]) => texto).join(" ");
}

function textosDaPagina(indicePagina: number) {
  const pagina = pdfCanvas.pages[indicePagina];
  return pdfCanvas.drawText.mock.calls
    .filter(([, , paginaDesenhada]) => paginaDesenhada === pagina)
    .map(([texto]) => texto)
    .join(" ");
}

function validarAreaSeguraDoRodape() {
  const textosForaDaArea = pdfCanvas.drawText.mock.calls
    .filter(([, options]) => typeof options?.y === "number" && options.y < 50 && options.y !== 35)
    .map(([texto]) => texto);
  expect(textosForaDaArea).toEqual([]);
}

describe("rotas de PDF protegidas", () => {
  const routes: Record<string, Handler> = {};

beforeEach(async () => {
  Object.keys(routes).forEach((key) => delete routes[key]);
  vi.restoreAllMocks();

  localAuthMocks.lerSessaoLocal.mockReset();
  localAuthMocks.lerSessaoLocal.mockReturnValue({
    usuarioId: 1,
    expiraEm: Date.now() + 1000 * 60 * 60,
  });

  vi.spyOn(db, "getUserById").mockResolvedValue({ id: 1 } as any);
  vi.spyOn(db, "getEmpresaUnica").mockResolvedValue({ id: 1 } as any);

  pdfCanvas.drawText.mockClear();
  pdfCanvas.pages.splice(0, pdfCanvas.pages.length);

await registerPdfRoutes({
  get: (path: string, handler: Handler) => {
    routes[path] = (req, res) =>
      handler(
        {
          ...req,
          headers: {
            ...(req.headers as Record<string, string> | undefined),
            cookie: `${COOKIE_SESSAO_LOCAL}=teste`,
          },
        },
        res,
      );
  },
});
});

  it("rejeita PDF de romaneio quando não há utilizador autenticado", async () => {
    localAuthMocks.lerSessaoLocal.mockReturnValue(undefined);
    const res = createResponse();

    await routes["/api/pdf/romaneio/:id"]!({ params: { id: "1" } }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Autenticação") }));
  });

  it("rejeita PDF de romaneio de carga quando não há utilizador autenticado", async () => {
    localAuthMocks.lerSessaoLocal.mockReturnValue(undefined);
    const res = createResponse();

    await routes["/api/pdf/romaneio-carga/:id"]!({ params: { id: "1" } }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("Autenticação") }));
  });

  it("gera PDF autenticado de carga com toras, frete por metro cúbico e total", async () => {
    localAuthMocks.lerSessaoLocal.mockReturnValue({
      usuarioId: 1,
      expiraEm: Date.now() + 1000 * 60 * 60,
    });
    vi.spyOn(db, "getEmpresaConfiguracao").mockResolvedValue(undefined);
    vi.spyOn(db, "getRomaneioCargaComPlaquetas").mockResolvedValue({
      carga: { numero: "CARGA-000007", dataCarga: new Date("2026-08-12T12:00:00.000Z"), origem: "Fazenda Norte", responsavel: "João", volumeTotal: "1.500000", totalPlaquetas: 2, valorProdutos: "1350.00", fretePorMetroCubico: "100.00", frete: "150.00", valorTotal: "1500.00", observacoes: "Carga conferida" },
      plaquetas: [{ id: 1, codigo: "TOR-0100", codigoFisico: "TOR-0100", situacaoIdentificacao: "identificada", madeiraNome: "Cedrinho", diametro: "30.00", comprimento: "5.00", volumeInicial: "0.353000", valorMetroCubico: "900.00", valorTotal: "317.70" }],
    } as any);
    const res = createResponse();

    await routes["/api/pdf/romaneio-carga/:id"]!({ params: { id: "7" } }, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", expect.stringContaining("romaneio-carga-CARGA-000007.pdf"));
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
    const textos = textosDoPdf();
    expect(textos).toContain("CARGA-000007");
    expect(textos).toContain("Toras: R$ 1.350,00");
    expect(textos).toContain("Frete/m³: R$ 100,00");
    expect(textos).toContain("Frete total: R$ 150,00");
    expect(textos).toContain("VALOR TOTAL DA CARGA: R$ 1.500,00");
    validarAreaSeguraDoRodape();
  });

  it("resume o saldo total em m³ por essência no PDF de carga", async () => {
    vi.spyOn(db, "getEmpresaConfiguracao").mockResolvedValue(undefined);
    vi.spyOn(db, "getRomaneioCargaComPlaquetas").mockResolvedValue({
      carga: { numero: "CARGA-000009", dataCarga: new Date(), origem: "Origem", responsavel: "Responsável", volumeTotal: "5.500000", totalPlaquetas: 3, valorProdutos: "4950", fretePorMetroCubico: "0", frete: "0", valorTotal: "4950", observacoes: null },
      plaquetas: [
        { id: 10, codigo: "TOR-0100", situacaoIdentificacao: "identificada", madeiraNome: "Cedrinho", diametro: "30", comprimento: "5", volumeInicial: "3.000", valorMetroCubico: "900", valorTotal: "2700" },
        { id: 11, codigo: "TOR-0101", situacaoIdentificacao: "identificada", madeiraNome: "Cedrinho", diametro: "28", comprimento: "4", volumeInicial: "2.000", valorMetroCubico: "900", valorTotal: "1800" },
        { id: 12, codigo: "TOR-0102", situacaoIdentificacao: "identificada", madeiraNome: "Cambará", diametro: "25", comprimento: "2", volumeInicial: "0.500", valorMetroCubico: "900", valorTotal: "450" },
      ],
    } as any);
    const res = createResponse();

    await routes["/api/pdf/romaneio-carga/:id"]!({ params: { id: "9" } }, res);

    const textos = textosDoPdf();
    expect(textos).toContain("SALDO TOTAL POR ESSÊNCIA");
    expect(textos).toContain("Cedrinho: 5 m³");
    expect(textos).toContain("Cambará: 0,5 m³");
    validarAreaSeguraDoRodape();
  });

  it("mantém o código interno longo de plaqueta sem referência dentro da primeira coluna", async () => {
    const codigoInterno = "SEM-PLQ-OPERADOR-IDENTIFICADOR-MUITO-LONGO-0001";
    vi.spyOn(db, "getEmpresaConfiguracao").mockResolvedValue(undefined);
    vi.spyOn(db, "getRomaneioCargaComPlaquetas").mockResolvedValue({
      carga: { numero: "CARGA-000008", dataCarga: new Date(), origem: "Origem", responsavel: "Responsável", volumeTotal: "1", totalPlaquetas: 1, valorProdutos: "900", fretePorMetroCubico: "0", frete: "0", valorTotal: "900", observacoes: null },
      plaquetas: [{ id: 2, codigo: codigoInterno, codigoFisico: null, situacaoIdentificacao: "sem_plaqueta", madeiraNome: "Madeira de nome comprido", diametro: "30", comprimento: "5", volumeInicial: "0.353", valorMetroCubico: "900", valorTotal: "317.7" }],
    } as any);
    const res = createResponse();

    await routes["/api/pdf/romaneio-carga/:id"]!({ params: { id: "8" } }, res);

    const codigoDesenhado = pdfCanvas.drawText.mock.calls.map(([texto]) => texto).find((texto) => String(texto).startsWith("SEM-PLQ"));
    expect(codigoDesenhado).toMatch(/…$/);
    expect(String(codigoDesenhado).length).toBeLessThan(codigoInterno.length);
    const chamadaEssencia = pdfCanvas.drawText.mock.calls.find(([texto]) => String(texto).startsWith("Madeira de") && String(texto).endsWith("…"));
    expect(chamadaEssencia?.[1]).toEqual(expect.objectContaining({ x: 124 }));
    validarAreaSeguraDoRodape();
  });

  it("repete cabeçalhos da grade e cria páginas seguras para uma venda com muitos comprimentos", async () => {
    vi.spyOn(db, "getEmpresaConfiguracao").mockResolvedValue(undefined);
    vi.spyOn(db, "listClientes").mockResolvedValue([{ id: 5, nome: "Cliente de Teste", contacto: null, email: null, morada: null, nif: null }] as any);
    vi.spyOn(db, "getOrcamentoWithItems").mockResolvedValue({
      orcamento: { id: 1, numero: "VEN-000001", clienteId: 5, createdAt: new Date(), estado: "aprovado", subtotal: "1000", desconto: "0", frete: "0", total: "1000", totalPecas: 100, totalMetroLinear: "500", totalVolume: "10", observacoes: "Observação extensa mas dentro da área de impressão." },
      itens: Array.from({ length: 90 }, (_, indice) => ({ madeiraNome: "Cedrinho selecionado", espessura: "23", largura: "50", comprimento: String(2 + (indice / 2)), quantidade: 1, precoM3: "900", precoLinear: "90", valorPeca: "12", valorTotal: "12" })),
    } as any);
    const res = createResponse();

    await routes["/api/pdf/orcamento/:id"]!({ params: { id: "1" } }, res);

    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
    expect(pdfCanvas.pages.length).toBeGreaterThan(1);
    expect(textosDoPdf()).toContain("GRADE DE PEÇAS VENDIDAS — Cedrinho selecionado — CONTINUAÇÃO");
    validarAreaSeguraDoRodape();
  });

  it("apresenta produtos por unidade e pacote sem exigir dimensões no PDF de Venda", async () => {
    vi.spyOn(db, "getEmpresaConfiguracao").mockResolvedValue(undefined);
    vi.spyOn(db, "listClientes").mockResolvedValue([] as any);
    vi.spyOn(db, "getOrcamentoWithItems").mockResolvedValue({
      orcamento: { id: 2, numero: "VEN-000002", clienteId: 5, createdAt: new Date(), estado: "aprovado", subtotal: "930", desconto: "0", frete: "0", total: "930", totalPecas: 5, totalMetroLinear: "0", totalVolume: "0", observacoes: null },
      itens: [
        { madeiraNome: "Portal", espessura: "0", largura: "0", comprimento: "0", quantidade: 3, tipoComercializacao: "unidade", precoM3: "180", precoLinear: "0", valorPeca: "180", valorTotal: "540" },
        { madeiraNome: "Pacote de cedrinho", espessura: "0", largura: "0", comprimento: "0", quantidade: 2, tipoComercializacao: "pacote", precoM3: "195", precoLinear: "0", valorPeca: "195", valorTotal: "390" },
      ],
    } as any);
    const res = createResponse();

    await routes["/api/pdf/orcamento/:id"]!({ params: { id: "2" } }, res);

    const textos = textosDoPdf();
    expect(textos).toContain("Venda por unidade");
    expect(textos).toContain("Venda por pacote");
    expect(textos).toContain("Total de itens: 5");
    validarAreaSeguraDoRodape();
  });

  it("inclui no PDF da venda o resumo de peças e participação por bitola", async () => {
    vi.spyOn(db, "getEmpresaConfiguracao").mockResolvedValue(undefined);
    vi.spyOn(db, "listClientes").mockResolvedValue([{ id: 5, nome: "Cliente de Teste" }] as any);
    vi.spyOn(db, "getOrcamentoWithItems").mockResolvedValue({
      orcamento: { id: 3, numero: "VEN-000003", clienteId: 5, createdAt: new Date(), estado: "aprovado", subtotal: "1000", desconto: "0", frete: "0", total: "1000", totalPecas: 16, totalMetroLinear: "56", totalVolume: "0.06", observacoes: null },
      itens: [
        { madeiraNome: "Cedrinho", espessura: "20", largura: "50", comprimento: "4", quantidade: 12, tipoComercializacao: "metro_cubico", precoM3: "900", valorPeca: "36", valorTotal: "432" },
        { madeiraNome: "Cedrinho", espessura: "30", largura: "50", comprimento: "2", quantidade: 4, tipoComercializacao: "metro_cubico", precoM3: "900", valorPeca: "27", valorTotal: "108" },
      ],
      taxasAdicionais: [],
    } as any);
    const res = createResponse();

    await routes["/api/pdf/orcamento/:id"]!({ params: { id: "3" } }, res);

    const textos = textosDoPdf();
    expect(textos).toContain("GRADE DE PEÇAS VENDIDAS — Cedrinho");
    expect(textos).toContain("Comp.");
    expect(textos).toContain("RESUMO DE PEÇAS POR BITOLA");
    expect(textos).toContain("2 × 5 cm");
    expect(textos).toContain("3 × 5 cm");
    expect(textos).toContain("80%");
    expect(textos).toContain("20%");
    validarAreaSeguraDoRodape();
  });

  it("mantém o acerto e o resumo na primeira página e inicia o romaneio em grade na segunda", async () => {
    vi.spyOn(db, "getEmpresaConfiguracao").mockResolvedValue(undefined);
    vi.spyOn(db, "listClientes").mockResolvedValue([{ id: 5, nome: "Cliente de Teste" }] as any);
    vi.spyOn(db, "getOrcamentoWithItems").mockResolvedValue({
      orcamento: {
        id: 4,
        numero: "VEN-000004",
        clienteId: 5,
        createdAt: new Date(),
        estado: "aprovado",
        subtotal: "1000",
        desconto: "0",
        frete: "0",
        total: "960",
        totalPecas: 16,
        totalMetroLinear: "56",
        totalVolume: "0.06",
        fretePorTonelada: "40",
        pesoCargaToneladas: "1",
        abatimentoFrete: "40",
        baseAposFrete: "960",
        comissaoTipo: "percentual",
        comissaoValor: "0",
        comissaoCalculada: "0",
        observacoes: null,
      },
      itens: [
        { madeiraNome: "Cedrinho", espessura: "20", largura: "50", comprimento: "4", quantidade: 12, tipoComercializacao: "metro_cubico", precoM3: "900", valorPeca: "36", valorTotal: "432" },
        { madeiraNome: "Cedrinho", espessura: "30", largura: "50", comprimento: "2", quantidade: 4, tipoComercializacao: "metro_cubico", precoM3: "900", valorPeca: "27", valorTotal: "108" },
      ],
      taxasAdicionais: [],
    } as any);
    const res = createResponse();

    await routes["/api/pdf/orcamento/:id"]!({ params: { id: "4" } }, res);

    expect(pdfCanvas.pages).toHaveLength(2);
    expect(textosDaPagina(0)).toContain("RESUMO DE PEÇAS POR BITOLA");
    expect(textosDaPagina(0)).toContain("ACERTO COMERCIAL");
    expect(textosDaPagina(0)).not.toContain("GRADE DE PEÇAS VENDIDAS");
    expect(textosDaPagina(1)).toContain("GRADE DE PEÇAS VENDIDAS — Cedrinho");
    validarAreaSeguraDoRodape();
  });

  it("mantém todas as bitolas de cada essência em uma página própria do romaneio", async () => {
    vi.spyOn(db, "getEmpresaConfiguracao").mockResolvedValue(undefined);
    vi.spyOn(db, "listClientes").mockResolvedValue([{ id: 5, nome: "Cliente de Teste" }] as any);
    const montarItens = (madeiraNome: string) => Array.from({ length: 8 }, (_, indice) => ({
      madeiraNome,
      espessura: String(20 + indice),
      largura: "50",
      comprimento: "4",
      quantidade: 2,
      tipoComercializacao: "metro_cubico",
      precoM3: "900",
      valorPeca: "36",
      valorTotal: "72",
    }));
    vi.spyOn(db, "getOrcamentoWithItems").mockResolvedValue({
      orcamento: { id: 5, numero: "VEN-000005", clienteId: 5, createdAt: new Date(), estado: "aprovado", subtotal: "1152", desconto: "0", frete: "0", total: "1152", totalPecas: 32, totalMetroLinear: "128", totalVolume: "1.152", observacoes: null },
      itens: [...montarItens("Cedrinho"), ...montarItens("Garapeira")],
      taxasAdicionais: [],
    } as any);
    const res = createResponse();

    await routes["/api/pdf/orcamento/:id"]!({ params: { id: "5" } }, res);

    expect(pdfCanvas.pages).toHaveLength(3);
    expect(textosDaPagina(1)).toContain("GRADE DE PEÇAS VENDIDAS — Cedrinho");
    expect(textosDaPagina(1)).not.toContain("Garapeira");
    expect(textosDaPagina(2)).toContain("GRADE DE PEÇAS VENDIDAS — Garapeira");
    expect(textosDaPagina(2)).not.toContain("Cedrinho");
    validarAreaSeguraDoRodape();
  });

  it("pagina toras e peças no romaneio de produção sem desenhar linhas no rodapé", async () => {
    vi.spyOn(db, "getEmpresaConfiguracao").mockResolvedValue(undefined);
    vi.spyOn(db, "getRomaneioProducaoComItens").mockResolvedValue({
      romaneio: { numero: "ROM-000021", dataProducao: new Date("2026-08-12T12:00:00.000Z"), aproveitamento: "60.00", volumeTora: "20.000000", volumeAproveitamento: "0.200000", incluirAproveitamentoNoRendimento: true, fita: "1", responsavel: "Adilson", observacoes: "Registro de produção com muitas linhas para verificar a paginação.", plaquetaCodigo: "PLA-001", madeiraTora: "Cedrinho", comprimentoTora: "5.00" },
      toras: Array.from({ length: 30 }, (_, indice) => ({ codigo: `PLA-${String(indice + 1).padStart(3, "0")}`, madeiraNome: "Cedrinho de nome longo", diametro: "30.00", comprimento: "5.00", volume: "0.666667" })),
      itens: Array.from({ length: 72 }, (_, indice) => ({ madeiraNome: "Cedrinho de nome longo", espessura: "2.30", largura: "10.00", comprimento: String((indice % 8) + 2), quantidade: 11, metrosLineares: "33.0000", volume: "0.100000" })),
      aproveitamentos: [{ madeiraNome: "Cedrinho de nome longo", volume: "0.200000" }],
    } as any);
    const res = createResponse();

    await routes["/api/pdf/romaneio/:id"]!({ params: { id: "21" } }, res);

    const textos = textosDoPdf();
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
    expect(pdfCanvas.pages.length).toBeGreaterThan(1);
    expect(textos).toContain("TORAS SERRADAS (30) — CONTINUAÇÃO");
    expect(textos).toContain("GRADE DE PRODUÇÃO POR BITOLA");
    expect(textos).toContain("APROVEITAMENTO POR ESSÊNCIA");
    validarAreaSeguraDoRodape();
  });

  it("gera PDF de produção com várias toras e aproveitamento consolidado", async () => {
    vi.spyOn(db, "getEmpresaConfiguracao").mockResolvedValue(undefined);
    vi.spyOn(db, "getRomaneioProducaoComItens").mockResolvedValue({
      romaneio: { numero: "ROM-000021", dataProducao: new Date("2026-08-12T12:00:00.000Z"), aproveitamento: "60.00", volumeTora: "2.000000", volumeAproveitamento: "0.200000", incluirAproveitamentoNoRendimento: true, fita: "1", responsavel: "Adilson", observacoes: null, plaquetaCodigo: "PLA-001", madeiraTora: "Cedrinho", comprimentoTora: "5.00" },
      toras: [
        { codigo: "PLA-001", madeiraNome: "Cedrinho", diametro: "30.00", comprimento: "5.00", volume: "1.000000" },
        { codigo: "PLA-002", madeiraNome: "Cedrinho", diametro: "28.00", comprimento: "5.00", volume: "1.000000" },
      ],
      itens: [
        { madeiraNome: "Cedrinho", espessura: "2.00", largura: "10.00", comprimento: "3.00", quantidade: 116, metrosLineares: "348.0000", volume: "1.000000" },
        { madeiraNome: "Piqui", espessura: "2.00", largura: "10.00", comprimento: "4.00", quantidade: 50, metrosLineares: "200.0000", volume: "0.500000" },
        { madeiraNome: "Garapeira", espessura: "3.00", largura: "5.00", comprimento: "3.00", quantidade: 30, metrosLineares: "90.0000", volume: "0.500000" },
      ],
      aproveitamentos: [{ madeiraNome: "Cedrinho", volume: "0.200000" }],
    } as any);
    const res = createResponse();

    await routes["/api/pdf/romaneio/:id"]!({ params: { id: "21" } }, res);

    const textos = textosDoPdf();
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
    expect(textos).toContain("TORAS SERRADAS (2)");
    expect(textos).toContain("Plaqueta: PLA-001");
    expect(textos).toContain("Plaqueta: PLA-002");
    expect(textos).toContain("Volume de toras: 2 m³");
    expect(textos).toContain("Aproveitamento: 60%");
    expect(textos).toContain("Rendimento inclui aproveitamento");
    expect(textos).toContain("GRADE DE PRODUÇÃO POR BITOLA — Cedrinho");
    expect(textos).toContain("Comp.");
    expect(textos).toContain("Essência");
    expect(textos).toContain("2 × 10 cm");
    expect(textos).toContain("116");
    expect(textos).toContain("50");
    expect(textos).not.toContain("166 peças");
    expect(textos).toContain("100%");
    expect(textos).not.toContain("75%");
    expect(textos).toContain("Peças romaneadas: 2 m³");
    expect(textos).toContain("Aproveitamento manual: 0,2 m³");
    expect(textos).toContain("Produção total: 2,2 m³");

    const paginaDaGrade = pdfCanvas.drawText.mock.calls.find(([texto]) => String(texto).startsWith("GRADE DE PRODUÇÃO POR BITOLA — Cedrinho"))?.[2];
    const paginasDasToras = pdfCanvas.drawText.mock.calls
      .filter(([texto]) => String(texto).startsWith("Plaqueta:"))
      .map(([, , pagina]) => pdfCanvas.pages.indexOf(pagina));
    expect(pdfCanvas.pages.indexOf(paginaDaGrade)).toBeGreaterThan(Math.max(...paginasDasToras));
  });

  it("rejeita recibo de venda ainda não quitada", async () => {
    vi.spyOn(db, "getOrcamentoWithItems").mockResolvedValue({
      orcamento: { pago: false, pagoEm: null },
      itens: [],
    } as any);
    const res = createResponse();

    await routes["/api/pdf/recibo/:id"]!({ params: { id: "1" } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining("quitadas") }));
  });
});