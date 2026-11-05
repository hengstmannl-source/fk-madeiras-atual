import { describe, expect, it } from "vitest";
import { prepararNovaVendaComercial } from "./comercial.adapter";
import { prepararPersistenciaNovaOperacaoComercial } from "./comercial.persistence";

function metadados() {
  return {
    empresaId: 1,
    criadoPor: 7,
    estado: "rascunho" as const,
    observacoes: "Nova operação",
    vendedor: "Equipe",
    dataValidade: null,
    dataVencimento: new Date("2026-11-05T12:00:00.000Z"),
    competencia: new Date("2026-11-01T12:00:00.000Z"),
  };
}

function calculo(overrides: Parameters<typeof prepararNovaVendaComercial>[1] = {}) {
  return prepararNovaVendaComercial("externa", {
    clienteId: 9,
    desconto: "0.00",
    fretePorTonelada: "0.00",
    pesoCargaToneladas: "0.000",
    comissaoTipo: "fixo",
    comissaoValor: "0.00",
    itens: [{
      madeiraId: 4,
      bitolaId: 5,
      produtoComercialId: null,
      madeiraNome: "Pacote de teste",
      bitolaDescricao: "Venda por pacote",
      espessura: "0",
      largura: "0",
      comprimento: "0",
      quantidade: 2,
      tipoComercializacao: "pacote",
      unidadesPorComercializacao: 999,
      precoM3: "3.00",
      precoLinear: "999.9999",
      valorPeca: "999.99",
      valorTotal: "1999.98",
      componentesPacote: [
        { descricao: "Primeira peça", madeiraNome: "Cedrinho", espessura: "2.00", largura: "5.00", comprimento: "3.00", quantidade: 2 },
        { descricao: "Segunda peça", madeiraNome: null, espessura: null, largura: null, comprimento: null, quantidade: 1 },
      ],
    }],
    aproveitamentos: [{ madeiraNome: "Aproveitamento", volume: "0.250", precoM3: "0.02" }],
    taxasAdicionais: [{ descricao: "Taxa", tipo: "fixo", valor: "0.01", calculado: "999.99" }],
    subtotal: "999999.99",
    total: "999999.99",
    totalPecas: -1,
    ...overrides,
  });
}

describe("prepararPersistenciaNovaOperacaoComercial", () => {
  it("preserva HALF_UP dos aproveitamentos e a igualdade entre subtotal e linhas", () => {
    const resultado = prepararPersistenciaNovaOperacaoComercial(calculo(), metadados());

    expect(resultado.aproveitamentos).toEqual([{
      madeiraNome: "Aproveitamento",
      volume: "0.250",
      precoM3: "0.02",
      valorTotal: "0.01",
    }]);
    expect(resultado.cabecalho.subtotal).toBe("6.01");
    expect(BigInt(resultado.itens[0].valorTotal.replace(".", ""))
      + BigInt(resultado.aproveitamentos[0].valorTotal.replace(".", ""))).toBe(BigInt(601));
  });

  it("falha de forma fechada se o subtotal não corresponder às linhas", () => {
    const resultado = calculo();
    resultado.cabecalho.subtotal = "6.02";

    expect(() => prepararPersistenciaNovaOperacaoComercial(resultado, metadados()))
      .toThrow(/Subtotal preparado não corresponde/);
  });

  it("preserva os valores calculados de cabeçalho, taxas e pacote sem duplicar preço dos componentes", () => {
    const resultado = prepararPersistenciaNovaOperacaoComercial(calculo(), metadados());

    expect(resultado.cabecalho).toMatchObject({
      clienteId: 9,
      tipoVenda: "externa",
      versaoCalculoComercial: 1,
      subtotal: "6.01",
      total: "6.02",
      desconto: "0.00",
      frete: "0.00",
      comissaoCalculada: "0.00",
      taxaCalculada: "0.01",
      estado: "rascunho",
      numero: null,
    });
    expect(resultado.itens[0]).toMatchObject({ quantidade: 2, valorPeca: "3.00", valorTotal: "6.00" });
    expect(resultado.itens[0].componentesPacote.map(({ descricao }) => descricao)).toEqual(["Primeira peça", "Segunda peça"]);
    expect(resultado.itens[0].componentesPacote.reduce((sum, item) => sum + item.quantidadePorPacote, 0)).toBe(3);
    expect(resultado.taxasAdicionais).toEqual([{
      descricao: "Taxa",
      tipo: "fixo",
      valor: "0.0100",
      calculado: "0.01",
      ordem: 0,
    }]);
  });

  it("preserva IDs referenciais, metadados e ordem sem reutilizar identidade histórica", () => {
    const resultado = prepararPersistenciaNovaOperacaoComercial(calculo(), metadados());

    expect(resultado.cabecalho).toMatchObject({
      empresaId: 1,
      clienteId: 9,
      criadoPor: 7,
      observacoes: "Nova operação",
      vendedor: "Equipe",
    });
    expect(resultado.itens[0]).toMatchObject({ madeiraId: 4, bitolaId: 5, produtoComercialId: null });
    expect(resultado.itens[0]).not.toHaveProperty("id");
    expect(resultado.itens[0]).not.toHaveProperty("orcamentoId");
    expect(resultado.itens[0].componentesPacote[0]).not.toHaveProperty("id");
    expect(resultado.cabecalho).not.toHaveProperty("pago");
    expect(resultado.cabecalho).not.toHaveProperty("entregue");
  });

  it("marca somente a nova operação com algoritmo 1 e ignora derivados forjados", () => {
    const base = calculo();
    const forjado = prepararNovaVendaComercial("interna", {
      ...entradaMinima(),
      itens: [{
        ...entradaMinima().itens[0],
        madeiraId: 4,
        bitolaId: 5,
        tipoComercializacao: "pacote",
        quantidade: 2,
        precoM3: "3.00",
        componentesPacote: [{ descricao: "Peça", quantidade: 3 }],
        valorTotal: "999999.99",
      }],
      subtotal: "999999.99",
      total: "999999.99",
      versaoCalculoComercial: 999,
    });
    const persistido = prepararPersistenciaNovaOperacaoComercial(forjado, metadados());

    expect(base.cabecalho.versaoCalculoComercial).toBe(1);
    expect(persistido.cabecalho).toMatchObject({ tipoVenda: "interna", versaoCalculoComercial: 1, subtotal: "6.00", total: "6.00" });
  });
});

function entradaMinima(): Parameters<typeof prepararNovaVendaComercial>[1] {
  return {
    clienteId: 9,
    desconto: "0.00",
    fretePorTonelada: "0.00",
    pesoCargaToneladas: "0.000",
    comissaoTipo: "fixo",
    comissaoValor: "0.00",
    itens: [{
      madeiraNome: "Pacote de teste",
      bitolaDescricao: "Venda por pacote",
      espessura: "0",
      largura: "0",
      comprimento: "0",
      quantidade: 2,
      tipoComercializacao: "pacote",
      precoM3: "3.00",
      componentesPacote: [{ descricao: "Peça", quantidade: 3 }],
    }],
  };
}
