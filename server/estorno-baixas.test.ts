import { describe, expect, it, vi } from "vitest";
import { estornarBaixaFinanceira } from "./db";

describe("estorno de baixas financeiras", () => {
  it("preserva a baixa, registra a auditoria e reabre parcialmente o título", async () => {
    const where = vi.fn().mockResolvedValue(undefined);
    const set = vi.fn(() => ({ where }));
    const database = {
      select: vi.fn(() => ({ from: () => ({ where: vi.fn().mockResolvedValue([
        { valor: "60.00", estornada: false },
        { valor: "40.00", estornada: true },
      ]) }) })),
      update: vi.fn(() => ({ set })),
    };
    const agora = new Date(2026, 7, 11, 12);

    const resultado = await estornarBaixaFinanceira(8, 4, "Recebimento duplicado", {
      database,
      agora,
      buscarBaixa: async () => ({ id: 8, tituloId: 3, valor: "40.00", estornada: false }),
      buscarTitulo: async () => ({
        id: 3, estado: "quitado", valorOriginal: "100.00", desconto: "0", juros: "0",
        valorBaixado: "100.00", dataVencimento: new Date(2026, 7, 20),
      }),
    });

    expect(resultado).toEqual({ success: true, tituloId: 3, estado: "parcial", valorBaixado: "60.00" });
    expect(set).toHaveBeenNthCalledWith(1, expect.objectContaining({
      estornada: true, estornadaEm: agora, estornadaPor: 4, motivoEstorno: "Recebimento duplicado", conciliada: false,
    }));
    expect(set).toHaveBeenNthCalledWith(2, { valorBaixado: "60.00", estado: "parcial" });
  });

  it("impede o estorno duplicado da mesma baixa", async () => {
    await expect(estornarBaixaFinanceira(8, 4, "Operação repetida", {
      database: {},
      buscarBaixa: async () => ({ id: 8, tituloId: 3, valor: "40.00", estornada: true }),
    })).rejects.toThrow("já foi estornada");
  });
});
