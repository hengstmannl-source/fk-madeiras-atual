import { describe, expect, it } from "vitest";
import { calcularComercial, type EntradaCalculoComercial } from "./comercial.calculator";
import { calculatePrecoLinear, calculateValorPeca, calculateVolume } from "../client/src/lib/utils";
import { criarItemVendaComercial } from "../client/src/lib/vendaItemGroup";
import { calcularAcertoComercial } from "../client/src/lib/acertoComercial";

const ajusteZero = { tipo: "fixo" as const, valor: "0" };

function entrada(overrides: Partial<EntradaCalculoComercial> = {}): EntradaCalculoComercial {
  return {
    itens: [{
      tipoComercializacao: "metro_cubico",
      madeiraNome: "Cedrinho",
      espessuraMm: "20",
      larguraMm: "50",
      comprimentoMetros: "3",
      quantidade: 2,
      preco: "2400",
    }],
    desconto: "0",
    fretePorTonelada: "0",
    pesoCargaToneladas: "0",
    comissao: ajusteZero,
    ...overrides,
  };
}

describe("calcularComercial", () => {
  it("calcula uma peça por m³ com arredondamento comercial para centavos", () => {
    const result = calcularComercial(entrada({ itens: [{ ...entrada().itens[0], quantidade: 1 }] }));
    expect(result.itens[0]).toMatchObject({ precoLinear: "2.4000", valorPeca: "7.20", valorTotal: "7.20" });
    expect(result.subtotal).toBe("7.20");
    expect(result.totalVolume).toBe("0.003000");
  });

  it("soma itens de bitolas distintas, peças, metragem e volume", () => {
    const result = calcularComercial(entrada({ itens: [
      { ...entrada().itens[0], quantidade: 2 },
      { tipoComercializacao: "metro_cubico", madeiraNome: "Garapeira", espessuraMm: "30", larguraMm: "80", comprimentoMetros: "2.5", quantidade: 3, preco: "3100" },
    ] }));
    expect(result.subtotal).toBe("70.20");
    expect(result.totalPecas).toBe(5);
    expect(result.totalMetroLinear).toBe("13.5000");
    expect(result.totalVolume).toBe("0.024000");
  });

  it("calcula unidade e pacote pelo preço comercial, preservando os componentes", () => {
    const result = calcularComercial(entrada({ itens: [
      { tipoComercializacao: "unidade", madeiraNome: "Portal", espessuraMm: "0", larguraMm: "0", comprimentoMetros: "0", quantidade: 3, preco: "180.50" },
      { tipoComercializacao: "pacote", madeiraNome: "Pacote", espessuraMm: "0", larguraMm: "0", comprimentoMetros: "0", quantidade: 2, preco: "750", componentesPacote: [
        { descricao: "Tábua", quantidade: 6 }, { descricao: "Ripa", quantidade: 2 },
      ] },
    ] }));
    expect(result.subtotal).toBe("2041.50");
    expect(result.totalPecas).toBe(5);
    expect(result.itens[1].componentesPacote).toHaveLength(2);
    expect(result.itens[1].componentesPacote.map((item) => item.quantidade)).toEqual([6, 2]);
  });

  it("calcula desconto, frete, comissão percentual e taxas percentual/fixa na ordem legada", () => {
    const result = calcularComercial(entrada({
      itens: [{ ...entrada().itens[0], quantidade: 1, comprimentoMetros: "10" }],
      desconto: "200",
      fretePorTonelada: "100",
      pesoCargaToneladas: "10",
      comissao: { tipo: "percentual", valor: "2" },
      taxas: [{ descricao: "Taxa percentual", tipo: "percentual", valor: "1" }, { descricao: "Taxa fixa", tipo: "fixo", valor: "150" }],
    }));
    expect(result.subtotal).toBe("24.00");
    expect(result.abatimentoFrete).toBe("1000.00");
    expect(result.baseAposFrete).toBe("0.00");
    expect(result.comissaoCalculada).toBe("0.00");
    expect(result.taxasCalculadas.map((taxa) => taxa.calculado)).toEqual(["0.00", "150.00"]);
    expect(result.total).toBe("150.00");
  });

  it("calcula aproveitamentos no subtotal e volume, sem contar peças ou metros", () => {
    const result = calcularComercial(entrada({ itens: [], aproveitamentos: [{ madeiraNome: "Aproveitamento", volume: "0.125", precoM3: "200.00" }] }));
    expect(result.subtotal).toBe("25.00");
    expect(result.totalVolume).toBe("0.125000");
    expect(result.totalPecas).toBe(0);
    expect(result.totalMetroLinear).toBe("0.0000");
  });

  it("compara desconto, frete, comissão e taxas com o acerto legado em uma base positiva", () => {
    const item = { ...entrada().itens[0], quantidade: 1, comprimentoMetros: "10" };
    const result = calcularComercial(entrada({
      itens: [item], desconto: "1.00", fretePorTonelada: "0.10", pesoCargaToneladas: "1.500",
      comissao: { tipo: "percentual", valor: "2.00" },
      taxas: [{ descricao: "Percentual", tipo: "percentual", valor: "1.0000" }, { descricao: "Fixa", tipo: "fixo", valor: "0.15" }],
    }));
    const subtotalLegado = Number((calculatePrecoLinear(20, 50, 2400) * 10).toFixed(2));
    const legado = calcularAcertoComercial({
      subtotal: subtotalLegado, desconto: "1.00", fretePorTonelada: "0.10", pesoCargaToneladas: "1.500",
      comissaoTipo: "percentual", comissaoValor: "2.00",
      taxas: [{ descricao: "Percentual", tipo: "percentual", valor: "1.0000" }, { descricao: "Fixa", tipo: "fixo", valor: "0.15" }],
    });
    expect({ base: result.baseAposFrete, commission: result.comissaoCalculada, fees: result.taxasCalculadas.map((fee) => fee.calculado), total: result.total }).toEqual({
      base: legado.baseAposFrete.toFixed(2), commission: legado.comissaoCalculada.toFixed(2),
      fees: legado.taxasCalculadas.map((fee) => fee.calculado.toFixed(2)), total: legado.total.toFixed(2),
    });
  });

  it("compara preço de unidade/pacote e aproveitamento com as regras atuais", () => {
    const packageInput = { tipoComercializacao: "pacote" as const, madeiraNome: "Pacote", espessuraMm: "0", larguraMm: "0", comprimentoMetros: "0", quantidade: 2, preco: "750", componentesPacote: [{ descricao: "Tábua", quantidade: 6 }, { descricao: "Ripa", quantidade: 2 }] };
    const legacyPackage = criarItemVendaComercial({ madeiraNome: "Pacote", tipoComercializacao: "pacote", quantidade: "2", precoComercial: "750", componentesPacote: packageInput.componentesPacote });
    const resultPackage = calcularComercial(entrada({ itens: [packageInput] }));
    expect(Number(resultPackage.itens[0].valorTotal)).toBe(Number(legacyPackage.item?.valorTotal));
    expect(resultPackage.subtotal).toBe("1500.00");

    const legacyVolume = 0.125;
    const legacyPrice = 200;
    const resultUse = calcularComercial(entrada({ itens: [], aproveitamentos: [{ madeiraNome: "Aproveitamento", volume: "0.125", precoM3: "200" }] }));
    expect(resultUse.subtotal).toBe((legacyVolume * legacyPrice).toFixed(2));
    expect(resultUse.aproveitamentos[0].valorTotal).toBe((legacyVolume * legacyPrice).toFixed(2));
  });

  it("é determinístico e não altera a entrada nem componentes", () => {
    const input = entrada({ itens: [{
      tipoComercializacao: "pacote", madeiraNome: "Pacote", espessuraMm: "0", larguraMm: "0", comprimentoMetros: "0", quantidade: 1, preco: "40.00",
      componentesPacote: [{ descricao: "Componente", quantidade: 2 }],
    }] });
    const before = structuredClone(input);
    expect(calcularComercial(input)).toEqual(calcularComercial(input));
    expect(input).toEqual(before);
  });

  it("ignora campos derivados extras em vez de tratá-los como fonte de verdade", () => {
    const input = { ...entrada(), subtotal: "999999", total: "999999", totalPecas: -1 };
    expect(calcularComercial(input).subtotal).toBe("14.40");
    expect(calcularComercial(input).totalPecas).toBe(2);
  });

  it("compara caso representativo com as funções atuais do formulário", () => {
    const legacyLinear = calculatePrecoLinear(20, 50, 2400);
    const legacyPiece = calculateValorPeca(legacyLinear, 3);
    const legacySubtotal = Number(legacyPiece.toFixed(2)) * 2;
    const legacyVolume = calculateVolume(20, 50, 3, 2);
    const legacySettlement = calcularAcertoComercial({
      subtotal: legacySubtotal, desconto: "0", fretePorTonelada: "0", pesoCargaToneladas: "0",
      comissaoTipo: "fixo", comissaoValor: "0", taxas: [],
    });
    const current = calcularComercial(entrada());
    expect({ subtotal: current.subtotal, total: current.total, totalVolume: current.totalVolume }).toEqual({
      subtotal: legacySubtotal.toFixed(2), total: legacySettlement.total.toFixed(2), totalVolume: legacyVolume.toFixed(6),
    });
  });

  it("rejeita preço acima da precisão comercial aprovada", () => {
    const legacy = criarItemVendaComercial({ madeiraNome: "Portal", tipoComercializacao: "unidade", quantidade: "1", precoComercial: "1.005" });
    expect(legacy.item?.valorPeca).toBe("1");
    expect(() => calcularComercial(entrada({ itens: [{
      tipoComercializacao: "unidade", madeiraNome: "Portal", espessuraMm: "0", larguraMm: "0", comprimentoMetros: "0", quantidade: 1, preco: "1.005",
    }] }))).toThrow(/precisão máxima/);
  });

  it("registra diferença de centavo entre decimal exato e o arredondamento binário legado em dados dentro da escala", () => {
    const input = entrada({ itens: [{
      tipoComercializacao: "metro_cubico", madeiraNome: "Teste de fronteira", espessuraMm: "36", larguraMm: "43.75", comprimentoMetros: "5.02", quantidade: 1, preco: "10000",
    }] });
    const legacyRaw = calculatePrecoLinear(36, 43.75, 10000) * 5.02;
    const legacyRounded = legacyRaw.toFixed(2);
    const exact = calcularComercial(input);
    expect(legacyRaw).toBeLessThan(79.065);
    expect(legacyRounded).toBe("79.06");
    expect(exact.itens[0].valorPeca).toBe("79.07");
    // Type B: kept explicit so this experimental module cannot hide the cent difference.
    expect(Number(exact.itens[0].valorPeca) - Number(legacyRounded)).toBeCloseTo(0.01);
  });

  it("calculates the 79.065 half-cent as 79.07 per piece and multiplies rounded piece value", () => {
    const result = calcularComercial(entrada({ itens: [{
      tipoComercializacao: "metro_cubico", madeiraNome: "Boundary", espessuraMm: "36", larguraMm: "43.75", comprimentoMetros: "5.02", quantidade: 2, preco: "10000",
    }] }));
    expect(result.itens[0]).toMatchObject({ precoLinear: "15.7500", valorPeca: "79.07", valorTotal: "158.14" });
    expect(result.subtotal).toBe("158.14");
  });

  it.each([
    ["below midpoint", "0.249", "0.02", "0.00"],
    ["exact midpoint", "0.250", "0.02", "0.01"],
    ["above midpoint", "0.251", "0.02", "0.01"],
  ])("uses ROUND_HALF_UP for an aproveitamento %s", (_label, volume, precoM3, expected) => {
    const result = calcularComercial(entrada({ itens: [], aproveitamentos: [{ madeiraNome: "Aproveitamento", volume, precoM3 }] }));
    expect(result.aproveitamentos[0].valorTotal).toBe(expected);
    expect(result.subtotal).toBe(expected);
  });

  it("makes subtotal equal the sum of rounded commercial line totals", () => {
    const result = calcularComercial(entrada({
      itens: [
        { tipoComercializacao: "unidade", madeiraNome: "Unit", espessuraMm: "0", larguraMm: "0", comprimentoMetros: "0", quantidade: 3, preco: "1.11" },
        { tipoComercializacao: "pacote", madeiraNome: "Package", espessuraMm: "0", larguraMm: "0", comprimentoMetros: "0", quantidade: 2, preco: "2.22", componentesPacote: [{ descricao: "Part", quantidade: 4 }] },
      ],
      aproveitamentos: [{ madeiraNome: "Aproveitamento", volume: "0.125", precoM3: "0.20" }],
    }));
    const lineTotals = result.itens.reduce((sum, item) => sum + BigInt(item.valorTotal.replace(".", "")), BigInt(0))
      + result.aproveitamentos.reduce((sum, item) => sum + BigInt(item.valorTotal.replace(".", "")), BigInt(0));
    expect(result.subtotal).toBe("7.80");
    expect(lineTotals).toBe(BigInt(780));
  });

  it("uses the validated three-decimal volume for both calculation and output", () => {
    const result = calcularComercial(entrada({ itens: [], aproveitamentos: [{ madeiraNome: "Aproveitamento", volume: "0.123", precoM3: "19.99" }] }));
    expect(result.aproveitamentos[0]).toMatchObject({ volume: "0.123", precoM3: "19.99", valorTotal: "2.46" });
  });

  it("rounds freight, commission and each fee to cents before forming total", () => {
    const result = calcularComercial(entrada({
      itens: [{ tipoComercializacao: "unidade", madeiraNome: "Unit", espessuraMm: "0", larguraMm: "0", comprimentoMetros: "0", quantidade: 1, preco: "1.00" }],
      fretePorTonelada: "0.01", pesoCargaToneladas: "0.500",
      comissao: { tipo: "percentual", valor: "0.50" },
      taxas: [{ descricao: "Percent fee", tipo: "percentual", valor: "0.50" }, { descricao: "Fixed fee", tipo: "fixo", valor: "0.01" }],
    }));
    expect(result.abatimentoFrete).toBe("0.01");
    expect(result.baseAposFrete).toBe("0.99");
    expect(result.comissaoCalculada).toBe("0.00");
    expect(result.taxasCalculadas.map((taxa) => taxa.calculado)).toEqual(["0.00", "0.01"]);
    expect(result.total).toBe("1.00");
  });

  it("accepts 0% and 100% and rejects percentages over 100%", () => {
    const zeroPercent = calcularComercial(entrada({
      itens: [{ tipoComercializacao: "unidade", madeiraNome: "Unit", espessuraMm: "0", larguraMm: "0", comprimentoMetros: "0", quantidade: 1, preco: "10.00" }],
      comissao: { tipo: "percentual", valor: "0" }, taxas: [{ descricao: "Fee", tipo: "percentual", valor: "0" }],
    }));
    const hundredPercent = calcularComercial(entrada({
      itens: [{ tipoComercializacao: "unidade", madeiraNome: "Unit", espessuraMm: "0", larguraMm: "0", comprimentoMetros: "0", quantidade: 1, preco: "10.00" }],
      comissao: { tipo: "percentual", valor: "100" },
    }));
    expect(zeroPercent.total).toBe("10.00");
    expect(hundredPercent.comissaoCalculada).toBe("10.00");
    expect(hundredPercent.total).toBe("0.00");
  });

  it.each([
    ["quantidade zero", { itens: [{ ...entrada().itens[0], quantidade: 0 }] }],
    ["quantidade negativa", { itens: [{ ...entrada().itens[0], quantidade: -1 }] }],
    ["preço negativo", { itens: [{ ...entrada().itens[0], preco: "-1" }] }],
    ["desconto negativo", { desconto: "-0.01" }],
    ["frete negativo", { fretePorTonelada: "-1" }],
    ["peso negativo", { pesoCargaToneladas: "-1" }],
    ["comissão negativa", { comissao: { tipo: "fixo", valor: "-1" } }],
    ["taxa negativa", { taxas: [{ descricao: "Taxa", tipo: "fixo", valor: "-1" }] }],
    ["percentual acima de 100", { comissao: { tipo: "percentual", valor: "100.01" } }],
    ["percentual negativo", { taxas: [{ descricao: "Taxa", tipo: "percentual", valor: "-0.01" }] }],
    ["NaN", { desconto: "NaN" }],
    ["Infinity", { pesoCargaToneladas: "Infinity" }],
    ["decimal malformado", { desconto: "1abc" }],
    ["escala monetária excedida", { desconto: "1.001" }],
  ] as const)("rejeita %s", (_label, overrides) => {
    expect(() => calcularComercial(entrada(overrides))).toThrow();
  });

  it("rejeita aproveitamento com volume zero e pacote sem componentes", () => {
    expect(() => calcularComercial(entrada({ itens: [], aproveitamentos: [{ madeiraNome: "Aproveitamento", volume: "0", precoM3: "1" }] }))).toThrow(/volume/);
    expect(() => calcularComercial(entrada({ itens: [{
      tipoComercializacao: "pacote", madeiraNome: "Pacote", espessuraMm: "0", larguraMm: "0", comprimentoMetros: "0", quantidade: 1, preco: "10",
    }] }))).toThrow(/componentes/);
  });

  it("rejeita aproveitamento além da escala persistida, embora o formulário legado aceitasse mais casas", () => {
    const volumeLegado = 0.1236;
    const totalLegado = volumeLegado * 19.99;
    expect(totalLegado.toFixed(2)).toBe("2.47");
    expect(() => calcularComercial(entrada({ itens: [], aproveitamentos: [{ madeiraNome: "Aproveitamento", volume: "0.1236", precoM3: "19.99" }] }))).toThrow(/precisão máxima/);
  });
});
