import { describe, expect, it } from "vitest";
import { getInsertedId, ordenarPlaquetasPorEntradaMaisRecente } from "./db";

describe("getInsertedId", () => {
  it("lê o insertId do primeiro elemento da resposta mysql2", () => {
    expect(getInsertedId([{ insertId: 42 }, []])).toBe(42);
  });

  it("rejeita uma resposta sem identificador válido", () => {
    expect(() => getInsertedId([{ insertId: 0 }, []])).toThrow("identificador válido");
  });

  it("prioriza as dez plaquetas mais recentes antes da paginação", () => {
    const plaquetas = Array.from({ length: 12 }, (_, indice) => ({
      id: indice + 1,
      createdAt: new Date(`2026-08-${String(indice + 1).padStart(2, "0")}T12:00:00.000Z`),
    })).reverse();

    const primeirasDez = ordenarPlaquetasPorEntradaMaisRecente(plaquetas).slice(0, 10);

    expect(primeirasDez.map((plaqueta) => plaqueta.id)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  });
});
