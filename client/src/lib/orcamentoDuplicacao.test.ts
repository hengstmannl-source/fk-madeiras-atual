import { describe, expect, it } from "vitest";
import { mapearOrcamentoParaDuplicacao } from "./orcamentoDuplicacao";

describe("dados comerciais para duplicar orçamento", () => {
  it("preserva itens, componentes, taxas e aproveitamentos sem transportar estado operacional", () => {
    const formulario = mapearOrcamentoParaDuplicacao({
      orcamento: {
        clienteId: 17, desconto: "5.00", fretePorTonelada: "12.50", pesoCargaToneladas: "3.000",
        comissaoTipo: "percentual", comissaoValor: "2.00", taxaDescricao: null, taxaTipo: "fixo",
        taxaValor: "0", observacoes: "Condição comercial", vendedor: "Ana", dataValidade: new Date(2026, 10, 1, 12),
        dataVencimento: new Date(2026, 9, 15, 12), competencia: new Date(2026, 9, 1, 12),
      },
      itens: [{
        madeiraId: 2, bitolaId: null, produtoComercialId: 9, madeiraNome: "Pacote cedrinho",
        bitolaDescricao: "Venda por pacote", espessura: "0", largura: "0", comprimento: "0",
        quantidade: 2, tipoComercializacao: "pacote", unidadesPorComercializacao: 6,
        precoM3: "750", precoLinear: "0", valorPeca: "750", valorTotal: "1500",
        componentesPacote: [{ descricao: "Tábua", madeiraNome: "Cedrinho", espessura: "20", largura: "50", comprimento: "3", quantidadePorPacote: 6 }],
      }],
      aproveitamentos: [{ madeiraNome: "Aproveitamento", volume: "0.25", precoM3: "200" }],
      taxasAdicionais: [{ descricao: "Taxa", tipo: "fixo", valor: "25.00" }],
    });

    expect(formulario).toMatchObject({
      clienteId: "17", desconto: "5.00", frete: "12.50", pesoCargaToneladas: "3.000",
      observacoes: "Condição comercial", vendedor: "Ana", itens: [{ tipoComercializacao: "pacote", valorTotal: "1500" }],
      taxasAdicionais: [{ descricao: "Taxa", valor: "25.00" }],
      aproveitamentos: [{ madeiraNome: "Aproveitamento", volume: "0.25", precoM3: "200" }],
    });
    expect(formulario.itens[0].componentesPacote).toEqual([{ descricao: "Tábua", madeiraNome: "Cedrinho", espessura: "20", largura: "50", comprimento: "3", quantidade: 6 }]);
    expect(formulario).not.toHaveProperty("id");
    expect(formulario).not.toHaveProperty("estado");
    expect(formulario).not.toHaveProperty("pago");
    expect(formulario).not.toHaveProperty("criadoPor");
  });

  it("usa a taxa legada quando a origem ainda não possui linhas de taxas adicionais", () => {
    const formulario = mapearOrcamentoParaDuplicacao({
      orcamento: {
        clienteId: 1, desconto: "0", fretePorTonelada: "0", pesoCargaToneladas: "0",
        comissaoTipo: "percentual", comissaoValor: "0", taxaDescricao: "Taxa antiga", taxaTipo: "fixo",
        taxaValor: "10", observacoes: null, vendedor: null, dataValidade: null,
        dataVencimento: null, competencia: null,
      }, itens: [], aproveitamentos: [], taxasAdicionais: [],
    });

    expect(formulario.taxasAdicionais).toEqual([{ descricao: "Taxa antiga", tipo: "fixo", valor: "10" }]);
  });
});
