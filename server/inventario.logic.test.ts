import { describe, expect, it } from "vitest";
import { calcularRelatorioInventarioSerrado } from "./inventario.logic";

describe("relatório de inventário serrado", () => {
  it("calcula rotação e cobertura com base no saldo, entradas e entregas do período", () => {
    const resultado = calcularRelatorioInventarioSerrado([
      { id: 1, madeiraNome: "Cedrinho", espessura: "3", largura: "5", comprimento: "3", quantidadeProduzida: 10, quantidadeDisponivel: 6, volume: "0.045" },
    ], [
      { loteId: 1, tipo: "entrada_producao", quantidade: 10, createdAt: new Date() },
      { loteId: 1, tipo: "saida_entrega", quantidade: 4, createdAt: new Date() },
    ], 30);

    expect(resultado.linhas[0]).toMatchObject({ saldoAtual: 6, saldoInicialEstimado: 0, estoqueMedio: 3, rotacao: 1.33, coberturaDias: 45, situacao: "adequado" });
    expect(resultado.resumo).toMatchObject({ itensAnalisados: 1, saidasNoPeriodo: 4, itensEmRutura: 0 });
  });

  it("prioriza a rutura e totaliza déficits negativos originados por entregas sem saldo", () => {
    const resultado = calcularRelatorioInventarioSerrado([
      { id: 2, madeiraNome: "Itaúba", espessura: "3", largura: "5", comprimento: "2", quantidadeProduzida: 0, quantidadeDisponivel: -3, volume: "0.0045" },
    ], [
      { loteId: 2, tipo: "saida_entrega", quantidade: 3, createdAt: new Date() },
    ], 30);

    expect(resultado.linhas[0]).toMatchObject({ saldoAtual: -3, situacao: "rutura", coberturaDias: 0 });
    expect(resultado.resumo).toMatchObject({ itensEmRutura: 1, pecasEmDeficit: 3 });
  });

  it("considera o ajuste assinado ao reconstruir o saldo inicial estimado", () => {
    const resultado = calcularRelatorioInventarioSerrado([
      { id: 3, madeiraNome: "Garapeira", espessura: "2.5", largura: "10", comprimento: "4", quantidadeProduzida: 0, quantidadeDisponivel: 4, volume: "0.01" },
    ], [
      { loteId: 3, tipo: "ajuste", quantidade: 4, createdAt: new Date() },
    ], 30);

    expect(resultado.linhas[0]).toMatchObject({ saldoAtual: 4, saldoInicialEstimado: 0, ajustes: 4 });
  });
});
