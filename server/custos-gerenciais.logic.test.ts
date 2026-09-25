import { describe, expect, it } from "vitest";
import {
  calcularCustoMateriaPrimaRastreavel,
  calcularPrecoSugerido,
  calcularRateiosPorCategoria,
  calcularValorLancamentoCusto,
} from "./custos-gerenciais.logic";

describe("custos-gerenciais.logic", () => {
  it("rastreia compra e frete de entrada da tora pelo volume efetivamente consumido", () => {
    const resultado = calcularCustoMateriaPrimaRastreavel([
      {
        identificador: "plaqueta-101",
        volumeConsumidoM3: "2.500",
        custoTora: "500.00",
        freteEntrada: "75.00",
      },
      {
        identificador: "plaqueta-102",
        volumeConsumidoM3: "1.500",
        custoTora: "315.00",
        freteEntrada: "45.00",
      },
    ]);

    expect(resultado).toMatchObject({
      volumeConsumidoM3: 4,
      volumeCobertoM3: 4,
      volumeSemCustoM3: 0,
      custoRastreavel: 935,
      custoPorM3Coberto: 233.75,
      coberturaPercentual: 100,
    });
  });

  it("mantém a cobertura parcial e não inventa custo para tora sem origem ou frete", () => {
    const resultado = calcularCustoMateriaPrimaRastreavel([
      {
        identificador: "plaqueta-com-origem",
        volumeConsumidoM3: 3,
        custoTora: 600,
        freteEntrada: 90,
      },
      {
        identificador: "plaqueta-sem-origem",
        volumeConsumidoM3: 1,
        custoTora: null,
        freteEntrada: null,
      },
    ]);

    expect(resultado).toMatchObject({
      volumeConsumidoM3: 4,
      volumeCobertoM3: 3,
      volumeSemCustoM3: 1,
      custoRastreavel: 690,
      custoPorM3Coberto: 230,
      coberturaPercentual: 75,
      itensSemCusto: ["plaqueta-sem-origem"],
    });
  });

  it("calcula custo percentual somente sobre a receita da competência explicitamente informada", () => {
    expect(calcularValorLancamentoCusto({ unidadeValor: "percentual", valor: "2.5" }, 24_000)).toBe(600);

    const [rateio] = calcularRateiosPorCategoria([
      {
        id: 11,
        categoriaCustoId: 7,
        baseApropriacao: "percentual_receita",
        unidadeValor: "percentual",
        valor: "2.5",
      },
    ], { percentual_receita: 24_000 });

    expect(rateio).toMatchObject({
      categoriaCustoId: 7,
      baseTotal: 24_000,
      valorRateado: 600,
      fatorUnitario: 0.025,
      coberturaPercentual: 100,
    });
  });

  it("marca cobertura zero quando uma categoria exige base ausente", () => {
    const [rateio] = calcularRateiosPorCategoria([
      {
        id: 12,
        categoriaCustoId: 8,
        baseApropriacao: "m3_produzido",
        unidadeValor: "monetario",
        valor: 1_200,
      },
    ], { m3_produzido: 0 });

    expect(rateio).toMatchObject({
      baseTotal: 0,
      valorRateado: 1_200,
      fatorUnitario: 0,
      coberturaPercentual: 0,
    });
  });

  it("não mistura bases configuradas na mesma categoria e mantém o rateio manual sem fator implícito", () => {
    expect(() => calcularRateiosPorCategoria([
      { id: 21, categoriaCustoId: 14, baseApropriacao: "m3_vendido", unidadeValor: "monetario", valor: 400 },
      { id: 22, categoriaCustoId: 14, baseApropriacao: "valor_vendido", unidadeValor: "monetario", valor: 200 },
    ], { m3_vendido: 8, valor_vendido: 20_000 })).toThrow("não pode misturar bases");

    const [manual] = calcularRateiosPorCategoria([
      { id: 23, categoriaCustoId: 15, baseApropriacao: "manual", unidadeValor: "monetario", valor: 320 },
    ], {});

    expect(manual).toMatchObject({
      baseTotal: 0,
      valorRateado: 320,
      fatorUnitario: 0,
      coberturaPercentual: 100,
    });
  });

  it("distingue markup de margem sobre o preço e impede margem impossível", () => {
    expect(calcularPrecoSugerido({ custoPorM3: 100, markupPercentual: 25 })).toMatchObject({
      precoPorM3: 125,
      margemPercentual: 0,
      markupPercentual: 25,
    });
    expect(calcularPrecoSugerido({ custoPorM3: 100, margemPercentual: 25 })).toMatchObject({
      precoPorM3: 133.33,
      margemPercentual: 25,
    });
    expect(() => calcularPrecoSugerido({ custoPorM3: 100, margemPercentual: 100 })).toThrow("inferior a 100%");
  });

  it("rejeita custos e bases negativos", () => {
    expect(() => calcularValorLancamentoCusto({ unidadeValor: "monetario", valor: -1 }, 1)).toThrow("não podem ser negativos");
  });
});
