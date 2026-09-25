import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportarListaFinanceiraPdf } from "./financeiroPdf";

const pdfCanvas = vi.hoisted(() => ({
  pages: [] as any[],
  texts: [] as Array<{ texto: string; options: Record<string, unknown> }>,
}));

vi.mock("pdf-lib", () => {
  const page = () => {
    const target = {
      drawText: (texto: string, options: Record<string, unknown> = {}) => pdfCanvas.texts.push({ texto, options }),
      drawRectangle: vi.fn(),
      drawLine: vi.fn(),
    };
    pdfCanvas.pages.push(target);
    return target;
  };
  return {
    PDFDocument: {
      create: vi.fn(async () => ({
        addPage: vi.fn(page),
        getPageCount: () => pdfCanvas.pages.length,
        embedFont: vi.fn(async () => ({
          widthOfTextAtSize: (texto: string, tamanho: number) => texto.length * tamanho * 0.5,
        })),
        save: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
      })),
    },
    StandardFonts: { Helvetica: "Helvetica", HelveticaBold: "HelveticaBold" },
    rgb: (red: number, green: number, blue: number) => ({ red, green, blue }),
  };
});

describe("exportação de relatório financeiro em PDF", () => {
  beforeEach(() => {
    pdfCanvas.pages.splice(0, pdfCanvas.pages.length);
    pdfCanvas.texts.splice(0, pdfCanvas.texts.length);
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:relatorio"), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  it("repete o cabeçalho em páginas posteriores e preserva a área do rodapé", async () => {
    const resultado = await exportarListaFinanceiraPdf({
      titulo: "Contas a receber filtradas",
      filtros: {
        descricao: "Venda de madeira para cliente com descrição longa",
        valorMinimo: "100,00",
        valorMaximo: "9.000,00",
        dataInicio: "2026-08-01",
        dataFim: "2026-08-31",
      },
      titulos: Array.from({ length: 90 }, (_, indice) => ({
        descricao: `Venda de madeira serrada com descrição extensa ${indice + 1}`,
        contraparteNome: `Cliente comercial de nome longo ${indice + 1}`,
        dataVencimento: "2026-08-20",
        valorOriginal: "1000",
        estado: "aberto",
      })),
    });

    expect(pdfCanvas.pages.length).toBeGreaterThan(2);
    expect(pdfCanvas.texts.some(({ texto }) => texto === "Contas a receber filtradas — continuação")).toBe(true);
    expect(pdfCanvas.texts.filter(({ texto }) => texto === "Descrição").length).toBeGreaterThan(1);
    const textosAbaixoDoConteudo = pdfCanvas.texts.filter(({ texto, options }) => typeof options.y === "number" && options.y < 42 && !texto.startsWith("FK Madeiras") && !texto.startsWith("Página"));
    expect(textosAbaixoDoConteudo).toEqual([]);
    expect(resultado).toEqual(expect.objectContaining({ url: "blob:relatorio" }));
    expect(resultado.nomeArquivo).toMatch(/^contas-a-receber-filtradas-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});
