import { describe, expect, it } from "vitest";
import {
  calculatePrecoLinear,
  calculateValorPeca,
  calculateValorTotal,
  calculateVolume,
  calculateMetroLinear,
  formatCurrency,
  formatMeasurement,
  formatNumber,
  formatReceivableSaleReference,
  parseDecimalInput,
} from "../client/src/lib/utils";
import {
  centimetersToMillimeters,
  millimetersToCentimeters,
  formatDimensionCm,
} from "../client/src/lib/utils";

describe("Cálculos de Orçamento FK Madeiras", () => {
  it("calcula preço linear corretamente", () => {
    // O utilizador introduz 2,5 cm × 15 cm → internamente 25 mm × 150 mm, preço 800 R$/m³
    const espMm = centimetersToMillimeters(2.5); // 25 mm
    const largMm = centimetersToMillimeters(15);  // 150 mm
    const precoLinear = calculatePrecoLinear(espMm, largMm, 800);
    // 0.025 * 0.150 * 800 = 3.00 R$/m
    expect(precoLinear).toBeCloseTo(3.0, 2);
  });

  it("calcula valor por peça", () => {
    const valorPeca = calculateValorPeca(3.0, 3); // 3 R$/m × 3 m = 9 R$
    expect(valorPeca).toBeCloseTo(9.0, 2);
  });

  it("calcula valor total", () => {
    const total = calculateValorTotal(9.0, 10); // 9 R$ × 10 = 90 R$
    expect(total).toBeCloseTo(90.0, 2);
  });

  it("calcula volume corretamente", () => {
    // Utilizador introduz 2,5 cm × 15 cm → 25 mm × 150 mm × 3 m × 10 peças
    const volume = calculateVolume(centimetersToMillimeters(2.5), centimetersToMillimeters(15), 3, 10);
    expect(volume).toBeCloseTo(0.1125, 4);
  });

  it("calcula metro linear total", () => {
    const ml = calculateMetroLinear(3, 10); // 3m × 10 = 30m
    expect(ml).toBe(30);
  });

  it("formata moeda em Reais (BRL)", () => {
    const formatted = formatCurrency("1234.56");
    expect(formatted).toContain("1.234,56");
    expect(formatted).toContain("R$");
    expect(formatCurrency("0")).toContain("0,00");
    expect(formatCurrency("100")).toContain("100,00");
  });

  it("formata números com separadores", () => {
    expect(formatNumber("1234.5")).toContain("1234,5");
    expect(formatNumber("0.5")).toContain("0,5");
    expect(formatNumber("100")).toContain("100");
  });

  it("limita a apresentação de medidas a três casas decimais", () => {
    expect(formatMeasurement("204.5000")).toBe("204,5");
    expect(formatMeasurement("0.2352")).toBe("0,235");
    expect(formatMeasurement("0.2349")).toBe("0,235");
  });

  it("exibe explicitamente o número da venda no recebível vinculado", () => {
    expect(formatReceivableSaleReference("orcamento", "Venda VND-000001")).toBe("Venda vinculada · VND-000001");
    expect(formatReceivableSaleReference("manual", "Frete emergencial")).toBe("Lançamento não programado");
  });

  it("calcula com dimensões variadas", () => {
    // Utilizador introduz 5 cm × 10 cm → 50 mm × 100 mm × 4 m × 5 peças @ 600 R$/m³
    const precoLinear = calculatePrecoLinear(centimetersToMillimeters(5), centimetersToMillimeters(10), 600);
    // 0.050 * 0.100 * 600 = 3.00 R$/m
    expect(precoLinear).toBeCloseTo(3.0, 2);

    const valorPeca = calculateValorPeca(precoLinear, 4);
    expect(valorPeca).toBeCloseTo(12.0, 2);

    const total = calculateValorTotal(valorPeca, 5);
    expect(total).toBeCloseTo(60.0, 2);
  });

  it("lida com valores zero", () => {
    expect(calculatePrecoLinear(0, 0, 0)).toBe(0);
    expect(calculateValorPeca(0, 0)).toBe(0);
    expect(calculateValorTotal(0, 0)).toBe(0);
    expect(calculateVolume(0, 0, 0, 0)).toBe(0);
    expect(calculateMetroLinear(0, 0)).toBe(0);
  });

  describe("Conversão de unidades (cm ↔ mm)", () => {
    it("converte centímetros para milímetros", () => {
      expect(centimetersToMillimeters(2.5)).toBe(25);
      expect(centimetersToMillimeters(15)).toBe(150);
      expect(centimetersToMillimeters(0)).toBe(0);
    });

    it("converte milímetros para centímetros", () => {
      expect(millimetersToCentimeters(25)).toBe(2.5);
      expect(millimetersToCentimeters(150)).toBe(15);
      expect(millimetersToCentimeters("25")).toBe(2.5);
      expect(millimetersToCentimeters(0)).toBe(0);
    });

    it("formata dimensão em centímetros a partir de milímetros", () => {
      expect(formatDimensionCm(25)).toBe("2,5");
      expect(formatDimensionCm("150")).toBe("15");
      expect(formatDimensionCm(0)).toBe("0");
    });

    it("aceita vírgula ou ponto em entradas decimais", () => {
      expect(parseDecimalInput("2,5")).toBe(2.5);
      expect(parseDecimalInput("2.5")).toBe(2.5);
      expect(parseDecimalInput(" 15 ")).toBe(15);
    });
  });
});
