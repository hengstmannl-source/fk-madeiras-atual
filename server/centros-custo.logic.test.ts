import { describe, expect, it } from "vitest";
import { normalizarCodigoCentroCusto, validarNomeCentroCusto, validarTipoCentroCusto } from "./centros-custo.logic";

describe("Centros de Custo", () => {
  it("normaliza um código técnico estável sem usar o tipo como código", () => {
    expect(normalizarCodigoCentroCusto("Produção / Serraria")).toBe("PRODUCAO_SERRARIA");
    expect(normalizarCodigoCentroCusto("   ")).toBe("CENTRO");
  });

  it("aceita apenas os tipos de centro aprovados", () => {
    expect(() => validarTipoCentroCusto("industrial")).not.toThrow();
    expect(() => validarTipoCentroCusto("nao_apropriavel")).not.toThrow();
    expect(() => validarTipoCentroCusto("vendas")).toThrow("Tipo de centro de custo inválido.");
  });

  it("impede centro sem nome ou com nome excessivo", () => {
    expect(() => validarNomeCentroCusto(" ")).toThrow("Nome do centro de custo é obrigatório.");
    expect(validarNomeCentroCusto("Frota de Produção")).toBe("Frota de Produção");
    expect(() => validarNomeCentroCusto("x".repeat(151))).toThrow("excede o tamanho permitido");
  });
});
