import { describe, expect, it } from "vitest";
import { linhasMargemParaPlanilha } from "./relatorioMargemExport";

describe("linhasMargemParaPlanilha", () => {
  it("preserva vendedor, acréscimos de taxas e valor final para a exportação", () => {
    const [linha] = linhasMargemParaPlanilha([{
      numero: "VND-000123",
      clienteNome: "Cliente Exemplo",
      vendedor: "Marina",
      createdAt: "2026-08-21T12:00:00.000Z",
      subtotal: 20_000,
      abatimentoFrete: 1_500,
      comissao: 370,
      totalTaxas: 250,
      valorLiquido: 18_380,
      margemPercentual: 91.9,
      taxas: [{ descricao: "ICMS do frete", tipo: "fixo", valor: "250", calculado: "250" }],
    }]);

    expect(linha["Vendedor"]).toBe("Marina");
    expect(linha["Taxas adicionadas (R$)"]).toBe(250);
    expect(linha["Valor final (R$)"]).toBe(18_380);
    expect(linha["Taxas aplicadas"]).toContain("ICMS do frete");
  });

  it("identifica corretamente uma venda sem taxa adicional", () => {
    const [linha] = linhasMargemParaPlanilha([{
      numero: null,
      clienteNome: null,
      vendedor: null,
      createdAt: "2026-08-21T12:00:00.000Z",
      subtotal: 0,
      abatimentoFrete: 0,
      comissao: 0,
      totalTaxas: 0,
      valorLiquido: 0,
      margemPercentual: 0,
      taxas: [],
    }]);

    expect(linha["Vendedor"]).toBe("Não informado");
    expect(linha["Taxas aplicadas"]).toBe("Sem taxa adicional");
  });
});
