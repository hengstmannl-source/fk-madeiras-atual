import { describe, expect, it } from "vitest";
import { calcularPreviaComercial } from "../shared/comercial.preview";

describe("prévia comercial compartilhada", () => {
  it("usa ROUND_HALF_UP por peça e soma duas peças em centavos exatos", () => {
    const resultado = calcularPreviaComercial({
      itens: [{
        madeiraNome: "Cedrinho",
        espessura: "36.00",
        largura: "43.75",
        comprimento: "5.02",
        quantidade: 2,
        tipoComercializacao: "metro_cubico",
        precoM3: "10000.00",
      }],
      aproveitamentos: [], desconto: "0.00", fretePorTonelada: "0.00", pesoCargaToneladas: "0.000",
      comissao: { tipo: "fixo", valor: "0.00" }, taxas: [],
    });
    expect(resultado.itens[0]).toMatchObject({ valorPeca: "79.07", valorTotal: "158.14" });
    expect(resultado.subtotal).toBe("158.14");
    expect(resultado.total).toBe("158.14");
  });

  it("calcula aproveitamento a três casas e pacote sem somar preço dos componentes", () => {
    const resultado = calcularPreviaComercial({
      itens: [{
        madeiraNome: "Pacote", espessura: "0", largura: "0", comprimento: "0", quantidade: 2,
        tipoComercializacao: "pacote", precoM3: "10.00",
        componentesPacote: [{ descricao: "Peça", quantidade: 3 }],
      }],
      aproveitamentos: [{ madeiraNome: "Aproveitamento", volume: "0.125", precoM3: "0.20" }],
      desconto: "1.00", fretePorTonelada: "0.10", pesoCargaToneladas: "1.500",
      comissao: { tipo: "percentual", valor: "2.00" },
      taxas: [{ descricao: "Taxa", tipo: "fixo", valor: "0.15" }],
    });
    expect(resultado.itens[0]).toMatchObject({ valorPeca: "10.00", valorTotal: "20.00", unidadesPorComercializacao: 3 });
    expect(resultado.aproveitamentos[0]).toMatchObject({ volume: "0.125", valorTotal: "0.03" });
    expect(resultado.subtotal).toBe("20.03");
    expect(resultado.abatimentoFrete).toBe("0.15");
    expect(resultado.comissaoCalculada).toBe("0.38");
    expect(resultado.taxasCalculadas[0].calculado).toBe("0.15");
    expect(resultado.total).toBe("18.65");
  });

  it("rejeita precisão acima da regra sem alterar os valores de entrada", () => {
    const item = { madeiraNome: "Unidade", espessura: "0", largura: "0", comprimento: "0", quantidade: 1, tipoComercializacao: "unidade" as const, precoM3: "1.005" };
    expect(() => calcularPreviaComercial({
      itens: [item], aproveitamentos: [], desconto: "0", fretePorTonelada: "0", pesoCargaToneladas: "0",
      comissao: { tipo: "fixo", valor: "0" }, taxas: [],
    })).toThrow(/precisão máxima de 2 casas/);
    expect(item.precoM3).toBe("1.005");
  });
});
