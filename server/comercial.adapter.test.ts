import { describe, expect, it } from "vitest";
import { prepararNovaVendaComercial, type EntradaAdaptadorComercial } from "./comercial.adapter";

function entrada(overrides: Partial<EntradaAdaptadorComercial> = {}): EntradaAdaptadorComercial {
  return {
    clienteId: 7,
    desconto: "0.00",
    fretePorTonelada: "0.00",
    pesoCargaToneladas: "0.000",
    comissaoTipo: "fixo",
    comissaoValor: "0.00",
    itens: [{
      madeiraId: 2,
      bitolaId: null,
      madeiraNome: "Cedrinho",
      bitolaDescricao: "2×5 cm",
      espessura: "20.00",
      largura: "50.00",
      comprimento: "3.00",
      quantidade: 2,
      tipoComercializacao: "metro_cubico",
      unidadesPorComercializacao: 999,
      precoM3: "2400.00",
      precoLinear: "999999.00",
      valorPeca: "999999.00",
      valorTotal: "999999.00",
      componentesPacote: [],
    }],
    aproveitamentos: [],
    taxasAdicionais: [],
    ...overrides,
  };
}

describe("prepararNovaVendaComercial", () => {
  it.each(["externa", "interna"] as const)("prepara uma venda %s com valores persistíveis", (tipoVenda) => {
    const resultado = prepararNovaVendaComercial(tipoVenda, entrada());

    expect(resultado.cabecalho).toMatchObject({
      clienteId: 7,
      tipoVenda,
      versaoCalculoComercial: 1,
      subtotal: "14.40",
      total: "14.40",
      totalVolume: "0.006000",
    });
    expect(resultado.itens[0]).toMatchObject({
      madeiraId: 2,
      bitolaId: null,
      tipoComercializacao: "metro_cubico",
      unidadesPorComercializacao: 0,
      precoM3: "2400.00",
      precoLinear: "2.4000",
      valorPeca: "7.20",
      valorTotal: "14.40",
    });
  });

  it("ignora totais e valores por linha forjados, inclusive a versão enviada", () => {
    const baseline = prepararNovaVendaComercial("externa", entrada());
    const forjado = prepararNovaVendaComercial("externa", entrada({
      subtotal: "999999999.99",
      total: "999999999.99",
      totalPecas: -100,
      totalVolume: "999999",
      versaoCalculoComercial: 999,
      itens: [{
        ...entrada().itens[0],
        precoLinear: "0.0000",
        valorPeca: "0.00",
        valorTotal: "0.00",
        unidadesPorComercializacao: -1,
      }],
    }));

    expect(forjado).toEqual(baseline);
  });

  it("converte vírgula decimal e preserva dimensões em milímetros e comprimento em metros", () => {
    const resultado = prepararNovaVendaComercial("externa", entrada({
      itens: [{
        ...entrada().itens[0],
        espessura: "20,00",
        largura: "50,00",
        comprimento: "3,00",
        precoM3: "2400,00",
      }],
    }));

    expect(resultado.itens[0]).toMatchObject({
      espessura: "20.00",
      largura: "50.00",
      comprimento: "3.00",
      precoM3: "2400.00",
      valorPeca: "7.20",
    });
  });

  it("calcula pacote pelo preço comercial e normaliza componentes opcionais em branco", () => {
    const resultado = prepararNovaVendaComercial("interna", entrada({
      itens: [{
        ...entrada().itens[0],
        produtoComercialId: 12,
        madeiraNome: "Kit de peças",
        bitolaDescricao: "Venda por pacote",
        espessura: "0",
        largura: "0",
        comprimento: "0",
        quantidade: 2,
        tipoComercializacao: "pacote",
        precoM3: "750.00",
        componentesPacote: [{ descricao: "Ripa", madeiraNome: "", espessura: "", largura: "", comprimento: "", quantidade: 4 }],
      }],
    }));

    expect(resultado.cabecalho.subtotal).toBe("1500.00");
    expect(resultado.itens[0]).toMatchObject({ unidadesPorComercializacao: 4, valorTotal: "1500.00" });
    expect(resultado.itens[0].componentesPacote[0]).toMatchObject({
      madeiraNome: null,
      espessura: null,
      largura: null,
      comprimento: null,
    });
  });

  it("inclui aproveitamento e prepara a linha persistida na escala do schema", () => {
    const resultado = prepararNovaVendaComercial("externa", entrada({
      itens: [],
      aproveitamentos: [{ madeiraNome: "Aproveitamento", volume: "0,125", precoM3: "200,00" }],
    }));

    expect(resultado.aproveitamentos).toEqual([{
      madeiraNome: "Aproveitamento",
      volume: "0.125",
      precoM3: "200.00",
      valorTotal: "25.00",
    }]);
    expect(resultado.cabecalho).toMatchObject({ totalPecas: 0, totalMetroLinear: "0.0000", totalVolume: "0.125000" });
  });

  it("calcula desconto, frete, comissão e taxas no servidor e prepara cada taxa", () => {
    const resultado = prepararNovaVendaComercial("externa", entrada({
      itens: [{ ...entrada().itens[0], quantidade: 1, comprimento: "10.00" }],
      desconto: "1.00",
      fretePorTonelada: "0.10",
      pesoCargaToneladas: "1.500",
      comissaoTipo: "percentual",
      comissaoValor: "2.00",
      taxasAdicionais: [
        { descricao: "Taxa percentual", tipo: "percentual", valor: "1.0000", calculado: "999999" },
        { descricao: "Taxa fixa", tipo: "fixo", valor: "0.15" },
      ],
    }));

    expect(resultado.cabecalho).toMatchObject({
      subtotal: "24.00",
      abatimentoFrete: "0.15",
      frete: "0.15",
      baseAposFrete: "22.85",
      comissaoCalculada: "0.46",
      taxaCalculada: "0.38",
      total: "22.77",
    });
    expect(resultado.taxasAdicionais).toEqual([
      { descricao: "Taxa percentual", tipo: "percentual", valor: "1.0000", calculado: "0.23", ordem: 0 },
      { descricao: "Taxa fixa", tipo: "fixo", valor: "0.1500", calculado: "0.15", ordem: 1 },
    ]);
  });

  it("usa a taxa única legada como fallback e rejeita duas representações conflitantes", () => {
    const legado = prepararNovaVendaComercial("externa", entrada({
      itens: [{ ...entrada().itens[0], tipoComercializacao: "unidade", espessura: "0", largura: "0", comprimento: "0", precoM3: "100.00", quantidade: 1 }],
      taxaDescricao: "Taxa antiga",
      taxaTipo: "fixo",
      taxaValor: "12.50",
      taxaCalculada: "999999",
    }));

    expect(legado.taxasAdicionais).toEqual([
      { descricao: "Taxa antiga", tipo: "fixo", valor: "12.5000", calculado: "12.50", ordem: 0 },
    ]);
    expect(legado.cabecalho).toMatchObject({ taxaDescricao: "Taxa antiga", taxaValor: "12.50", taxaCalculada: "12.50", total: "112.50" });
    expect(() => prepararNovaVendaComercial("externa", entrada({
      taxaDescricao: "Taxa antiga",
      taxasAdicionais: [{ descricao: "Taxa nova", tipo: "fixo", valor: "1.00" }],
    }))).toThrow(/sem duplicar/);
  });

  it("mantém a soma do subtotal igual à soma das linhas arredondadas", () => {
    const resultado = prepararNovaVendaComercial("externa", entrada({
      itens: [
        { ...entrada().itens[0], tipoComercializacao: "unidade", espessura: "0", largura: "0", comprimento: "0", quantidade: 3, precoM3: "1.11" },
        { ...entrada().itens[0], tipoComercializacao: "pacote", madeiraNome: "Pacote", bitolaDescricao: "Venda por pacote", espessura: "0", largura: "0", comprimento: "0", quantidade: 2, precoM3: "2.22", componentesPacote: [{ descricao: "Peça", quantidade: 4 }] },
      ],
      aproveitamentos: [{ madeiraNome: "Aproveitamento", volume: "0.125", precoM3: "0.20" }],
    }));

    const centavos = resultado.itens.reduce((sum, item) => sum + BigInt(item.valorTotal.replace(".", "")), BigInt(0))
      + resultado.aproveitamentos.reduce((sum, item) => sum + BigInt(item.valorTotal.replace(".", "")), BigInt(0));
    expect(resultado.cabecalho.subtotal).toBe("7.80");
    expect(centavos).toBe(BigInt(780));
  });

  it("mantém os exemplos aprovados de arredondamento e resultado determinístico", () => {
    const halfCent = entrada({
      itens: [{
        ...entrada().itens[0],
        espessura: "36.00",
        largura: "43.75",
        comprimento: "5.02",
        quantidade: 2,
        precoM3: "10000.00",
      }],
    });
    const first = prepararNovaVendaComercial("externa", halfCent);
    expect(first.itens[0]).toMatchObject({ valorPeca: "79.07", valorTotal: "158.14" });
    expect(prepararNovaVendaComercial("externa", halfCent)).toEqual(first);
  });

  it.each([
    ["preço com escala excedida", { itens: [{ ...entrada().itens[0], precoM3: "1.005" }] }],
    ["volume com escala excedida", { itens: [], aproveitamentos: [{ madeiraNome: "Aproveitamento", volume: "0.1236", precoM3: "20" }] }],
    ["preço negativo", { itens: [{ ...entrada().itens[0], precoM3: "-1.00" }] }],
    ["quantidade inválida", { itens: [{ ...entrada().itens[0], quantidade: 0 }] }],
    ["item com texto que excede coluna", { itens: [{ ...entrada().itens[0], madeiraNome: "x".repeat(201) }] }],
  ] as const)("rejeita %s", (_label, overrides) => {
    expect(() => prepararNovaVendaComercial("externa", entrada(overrides))).toThrow();
  });
});
