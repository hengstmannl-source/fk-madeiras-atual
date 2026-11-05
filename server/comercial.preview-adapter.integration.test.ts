import { describe, expect, it } from "vitest";
import { prepararNovaVendaComercial } from "./comercial.adapter";
import { calcularPreviaComercial } from "../shared/comercial.preview";

describe("prévia e cálculo backend de nova operação comercial", () => {
  it("produz valores idênticos para m³, unidade, pacote, aproveitamento e ajustes", () => {
    const itens = [
      {
        madeiraNome: "Cedrinho",
        bitolaDescricao: "36 × 43,75 mm",
        espessura: "36.00",
        largura: "43.75",
        comprimento: "5.02",
        quantidade: 2,
        tipoComercializacao: "metro_cubico" as const,
        precoM3: "10000.00",
        componentesPacote: [],
      },
      {
        madeiraNome: "Pontalete",
        bitolaDescricao: "Venda por unidade",
        espessura: "0",
        largura: "0",
        comprimento: "0",
        quantidade: 3,
        tipoComercializacao: "unidade" as const,
        precoM3: "1.25",
        componentesPacote: [],
      },
      {
        madeiraNome: "Pacote montado",
        bitolaDescricao: "Pacote",
        espessura: "0",
        largura: "0",
        comprimento: "0",
        quantidade: 2,
        tipoComercializacao: "pacote" as const,
        precoM3: "10.00",
        componentesPacote: [{ descricao: "Peça do pacote", quantidade: 3 }],
      },
    ];
    const ajustes = {
      desconto: "1.00",
      fretePorTonelada: "0.10",
      pesoCargaToneladas: "1.500",
      comissao: { tipo: "percentual" as const, valor: "2.00" },
      taxas: [{ descricao: "Taxa operacional", tipo: "fixo" as const, valor: "0.15" }],
    };
    const aproveitamentos = [{ madeiraNome: "Aproveitamento", volume: "0.125", precoM3: "0.20" }];

    const previa = calcularPreviaComercial({
      itens: itens.map(({ madeiraNome, espessura, largura, comprimento, quantidade, tipoComercializacao, precoM3, componentesPacote }) => ({
        madeiraNome, espessura, largura, comprimento, quantidade, tipoComercializacao, precoM3, componentesPacote,
      })),
      aproveitamentos,
      ...ajustes,
    });
    const backend = prepararNovaVendaComercial("externa", {
      clienteId: 25,
      desconto: ajustes.desconto,
      fretePorTonelada: ajustes.fretePorTonelada,
      pesoCargaToneladas: ajustes.pesoCargaToneladas,
      comissaoTipo: ajustes.comissao.tipo,
      comissaoValor: ajustes.comissao.valor,
      taxasAdicionais: ajustes.taxas,
      aproveitamentos,
      // Deliberately bogus derived values prove they do not alter parity.
      subtotal: "999999.99",
      total: "999999.99",
      itens: itens.map((item) => ({
        ...item,
        madeiraId: null,
        bitolaId: null,
        produtoComercialId: null,
        unidadesPorComercializacao: 999,
        precoLinear: "999.9999",
        valorPeca: "999.99",
        valorTotal: "999999.99",
      })),
    });

    expect(backend.cabecalho).toMatchObject({
      subtotal: previa.subtotal,
      total: previa.total,
      desconto: previa.desconto,
      abatimentoFrete: previa.abatimentoFrete,
      baseAposFrete: previa.baseAposFrete,
      comissaoCalculada: previa.comissaoCalculada,
      taxaCalculada: previa.taxaCalculada,
      totalPecas: previa.totalPecas,
      totalMetroLinear: previa.totalMetroLinear,
      totalVolume: previa.totalVolume,
      versaoCalculoComercial: 1,
    });
    expect(backend.itens.map(({ precoLinear, valorPeca, valorTotal, unidadesPorComercializacao }) => ({
      precoLinear, valorPeca, valorTotal, unidadesPorComercializacao,
    }))).toEqual(previa.itens.map(({ precoLinear, valorPeca, valorTotal, unidadesPorComercializacao }) => ({
      precoLinear, valorPeca, valorTotal, unidadesPorComercializacao,
    })));
    expect(backend.aproveitamentos).toEqual(previa.aproveitamentos);
    expect(backend.taxasAdicionais.map(({ descricao, calculado }) => ({ descricao, calculado })))
      .toEqual(previa.taxasCalculadas);
  });
});
