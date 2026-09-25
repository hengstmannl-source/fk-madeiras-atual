import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./identidade", () => ({
  getEmpresaUnica: vi.fn(async () => ({ id: 1 })),
}));

vi.mock("./core", () => ({
  getDb: vi.fn(),
}));

import { garantirTituloFinanceiroAutomatico, garantirTituloFinanceiroComChave } from "./financeiro";

describe("motor financeiro automático", () => {
  const titulos: Array<Record<string, unknown>> = [];

  const database = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [...titulos],
        }),
      }),
    }),
    insert: () => ({
      values: async (dados: Record<string, unknown>) => {
        const titulo = { id: titulos.length + 1, ...dados };
        titulos.push(titulo);
        return [{ insertId: titulo.id }, undefined] as const;
      },
    }),
  };

  const entrada = {
    tipo: "receber" as const,
    origem: "orcamento" as const,
    chaveIdempotencia: "FIN-ORCAMENTO-42-PARCELA-1",
    descricao: "Venda VEN-000042",
    clienteId: 9,
    orcamentoId: 42,
    categoriaId: 3,
    valorOriginal: "1250.00",
    dataEmissao: new Date("2026-08-25T12:00:00.000Z"),
    dataVencimento: new Date("2026-09-25T12:00:00.000Z"),
    criadoPor: 1,
    database,
  };

  beforeEach(() => {
    titulos.splice(0, titulos.length);
  });

  it("reutiliza o mesmo título quando recebe a mesma chave de origem", async () => {
    const primeiro = await garantirTituloFinanceiroAutomatico(entrada);
    const repetido = await garantirTituloFinanceiroAutomatico(entrada);

    expect(primeiro).toMatchObject({ id: 1, criado: true });
    expect(repetido).toMatchObject({ id: 1, criado: false });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toMatchObject({
      chaveImportacao: "FIN-ORCAMENTO-42-PARCELA-1",
      origem: "orcamento",
      empresaId: 1,
    });
  });

  it("recusa reutilizar uma chave de outra origem financeira", async () => {
    await garantirTituloFinanceiroAutomatico(entrada);

    await expect(garantirTituloFinanceiroAutomatico({
      ...entrada,
      origem: "nota_diesel",
    })).rejects.toThrow("outra origem financeira");
  });

  it("preserva a idempotência para lançamentos manuais assistidos", async () => {
    const manual = {
      ...entrada,
      tipo: "pagar" as const,
      origem: "manual" as const,
      chaveIdempotencia: "RH-FICHA-77",
      descricao: "Pagamento de colaborador — teste",
    };

    const primeiro = await garantirTituloFinanceiroComChave(manual);
    const repetido = await garantirTituloFinanceiroComChave(manual);

    expect(primeiro).toMatchObject({ id: 1, criado: true });
    expect(repetido).toMatchObject({ id: 1, criado: false });
    expect(titulos).toHaveLength(1);
    expect(titulos[0]).toMatchObject({ origem: "manual", chaveImportacao: "RH-FICHA-77" });
  });

  it("recupera o título já criado quando uma corrida encontra a chave única", async () => {
    const titulosConcorrentes: Array<Record<string, unknown>> = [];
    const databaseConcorrente = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [...titulosConcorrentes],
          }),
        }),
      }),
      insert: () => ({
        values: async (dados: Record<string, unknown>) => {
          if (titulosConcorrentes.some((titulo) => titulo.chaveImportacao === dados.chaveImportacao)) {
            throw new Error("Duplicate entry for chaveImportacao");
          }
          const titulo = { id: titulosConcorrentes.length + 1, ...dados };
          titulosConcorrentes.push(titulo);
          return [{ insertId: titulo.id }, undefined] as const;
        },
      }),
    };

    const resultados = await Promise.all([
      garantirTituloFinanceiroAutomatico({ ...entrada, database: databaseConcorrente }),
      garantirTituloFinanceiroAutomatico({ ...entrada, database: databaseConcorrente }),
    ]);

    expect(resultados.map((resultado) => resultado.id)).toEqual([1, 1]);
    expect(resultados.map((resultado) => resultado.criado).sort()).toEqual([false, true]);
    expect(titulosConcorrentes).toHaveLength(1);
  });
});
