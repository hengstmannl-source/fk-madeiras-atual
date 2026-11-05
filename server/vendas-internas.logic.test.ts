import { describe, expect, it } from "vitest";
import { planejarAjusteFinanceiroRevisao, planejarReservasVendaInterna } from "./vendas-internas.logic";

describe("regras de estoque de venda interna", () => {
  const lotes = [{ id: 1, madeiraNome: "Cedrinho", espessura: "1.80", largura: "10.00", comprimento: "2.40", quantidadeDisponivel: 5 }];
  it("reserva apenas linhas por metro cúbico e deixa unidade/pacote fora do estoque serrado", () => {
    const resultado = planejarReservasVendaInterna({
      lotes,
      reservasAtivas: [],
      itens: [
        { id: 10, tipoComercializacao: "metro_cubico", madeiraNome: "Cedrinho", espessura: "18", largura: "100", comprimento: "2.4", quantidade: 3 },
        { id: 11, tipoComercializacao: "unidade", madeiraNome: "Cavaco", espessura: "0", largura: "0", comprimento: "0", quantidade: 30 },
        { id: 12, tipoComercializacao: "pacote", madeiraNome: "Lenha", espessura: "0", largura: "0", comprimento: "0", quantidade: 7 },
      ],
    });
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({ itemOrcamentoId: 10, loteId: 1, quantidade: "3.000000" });
  });

  it("respeita reservas anteriores e representa o saldo faltante sem baixar estoque", () => {
    const resultado = planejarReservasVendaInterna({
      lotes,
      reservasAtivas: [{ loteId: 1, quantidade: "4.000000" }],
      itens: [{ id: 20, tipoComercializacao: "metro_cubico", madeiraNome: "Cedrinho", espessura: "18", largura: "100", comprimento: "2.4", quantidade: 3 }],
    });
    expect(resultado).toEqual([
      expect.objectContaining({ loteId: 1, quantidade: "1.000000" }),
      expect.objectContaining({ loteId: null, quantidade: "2.000000" }),
    ]);
  });
});

describe("ajustes financeiros de revisão", () => {
  it("cria delta positivo separado sem alterar títulos existentes", () => {
    expect(planejarAjusteFinanceiroRevisao({ totalNovo: "150.00", titulos: [{ id: 1, valorDevido: "100.00", valorPago: "25.00", ordem: 1 }] }))
      .toMatchObject({ delta: "50.00", novosValores: [], saldoPago: "25.00" });
  });

  it("reduz apenas saldos abertos de trás para frente e preserva valores pagos", () => {
    expect(planejarAjusteFinanceiroRevisao({ totalNovo: "130.00", titulos: [
      { id: 1, valorDevido: "100.00", valorPago: "40.00", ordem: 1 },
      { id: 2, valorDevido: "100.00", valorPago: "20.00", ordem: 2 },
    ] })).toMatchObject({
      delta: "-70.00",
      saldoPago: "60.00",
      novosValores: [
        { tituloId: 2, valorAjuste: "-70.00", novoValorDevido: "30.00" },
      ],
    });
  });

  it("bloqueia redução abaixo do total efetivamente recebido", () => {
    expect(() => planejarAjusteFinanceiroRevisao({ totalNovo: "19.99", titulos: [{ id: 1, valorDevido: "100.00", valorPago: "20.00", ordem: 1 }] }))
      .toThrow(/abaixo do valor já recebido/);
  });
});
