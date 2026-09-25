import { describe, expect, it, vi } from "vitest";
import { cancelarTituloFinanceiro, listTitulosFinanceiros } from "./db";

describe("cancelamento manual de títulos financeiros", () => {
  it("cancela uma conta sem baixas e não a mantém nas listas ativas", async () => {
    const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) }));
    const database = {
      select: vi.fn(() => ({ from: () => ({ where: vi.fn().mockResolvedValue([]) }) })),
      update: vi.fn(() => ({ set })),
    };
    const tituloCancelado = { id: 10, estado: "aberto", valorBaixado: "0.00", valorOriginal: "100.00", desconto: "0", juros: "0", dataVencimento: new Date(2030, 0, 1), tipo: "receber" };
    const tituloAtivo = { id: 11, estado: "aberto", valorBaixado: "0.00", tipo: "pagar" };

    await cancelarTituloFinanceiro(10, 7, {
      database,
      buscarTitulo: async () => tituloCancelado,
    });

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ estado: "cancelado" }));
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ canceladoPor: 7 }));
    tituloCancelado.estado = "cancelado";

    const receber = await listTitulosFinanceiros({ tipo: "receber" }, {
      database,
      titulos: [tituloCancelado, tituloAtivo],
      atualizarEstado: async (titulo) => titulo,
    });
    const pagar = await listTitulosFinanceiros({ tipo: "pagar" }, {
      database,
      titulos: [tituloCancelado, tituloAtivo],
      atualizarEstado: async (titulo) => titulo,
    });

    expect(receber).toEqual([]);
    expect(pagar).toEqual([tituloAtivo]);
  });

  it("bloqueia o cancelamento de contas com baixa registrada", async () => {
    await expect(cancelarTituloFinanceiro(10, 7, {
      database: {
        select: vi.fn(() => ({ from: () => ({ where: vi.fn().mockResolvedValue([{ valor: "25.00", estornada: false }]) }) })),
        update: vi.fn(() => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) })),
      },
      buscarTitulo: async () => ({ id: 10, estado: "parcial", valorOriginal: "100.00", desconto: "0", juros: "0", valorBaixado: "25.00", dataVencimento: new Date(2030, 0, 1) }),
    })).rejects.toThrow("estorno");
  });
});
