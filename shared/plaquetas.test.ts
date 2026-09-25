import { describe, expect, it } from "vitest";
import { etiquetaPlaqueta, numerarDuplicidadesPlaquetas } from "./plaquetas";

describe("numeração visual de plaquetas duplicadas", () => {
  it("mantém a primeira ocorrência e adiciona sobrescrito às seguintes", () => {
    const itens = numerarDuplicidadesPlaquetas([
      { id: 1, codigo: "PLQ-001", codigoFisico: "22", createdAt: "2026-08-01T12:00:00Z" },
      { id: 2, codigo: "PLQ-002", codigoFisico: "22", createdAt: "2026-08-02T12:00:00Z" },
      { id: 3, codigo: "PLQ-003", codigoFisico: "22", createdAt: "2026-08-03T12:00:00Z" },
    ]);

    expect(itens.map(etiquetaPlaqueta)).toEqual(["22", "22²", "22³"]);
    expect(itens.map((item) => item.situacaoIdentificacao)).toEqual(["duplicada", "duplicada", "duplicada"]);
  });

  it("preserva o identificador interno quando não há plaqueta física", () => {
    const [item] = numerarDuplicidadesPlaquetas([{ id: 1, codigo: "SEM-PLQ-001", codigoFisico: null }]);
    expect(etiquetaPlaqueta(item)).toBe("SEM-PLQ-001");
    expect(item.situacaoIdentificacao).toBe("sem_plaqueta");
  });
});
