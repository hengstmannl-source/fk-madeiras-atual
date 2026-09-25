import { describe, expect, it } from "vitest";
import { calcularAcertoComercial } from "./acertoComercial";

describe("calcularAcertoComercial", () => {
  it("desconta frete antes de aplicar comissão e acrescenta a taxa percentual ao valor final", () => {
    const acerto = calcularAcertoComercial({
      subtotal: 54_000,
      desconto: "0",
      fretePorTonelada: "440",
      pesoCargaToneladas: "22",
      comissaoTipo: "percentual",
      comissaoValor: "2",
      taxaTipo: "percentual",
      taxaValor: "1",
    });

    expect(acerto.abatimentoFrete).toBe(9_680);
    expect(acerto.baseAposFrete).toBe(44_320);
    expect(acerto.comissaoCalculada).toBeCloseTo(886.4);
    expect(acerto.taxaCalculada).toBeCloseTo(443.2);
    expect(acerto.total).toBeCloseTo(43_876.8);
  });

  it("aceita comissão e taxa em valores fixos, cobrando a taxa como acréscimo", () => {
    const acerto = calcularAcertoComercial({ subtotal: 10_000, desconto: "200", fretePorTonelada: "100", pesoCargaToneladas: "10", comissaoTipo: "fixo", comissaoValor: "500", taxaTipo: "fixo", taxaValor: "150" });
    expect(acerto.baseAposFrete).toBe(8_800);
    expect(acerto.total).toBe(8_450);
  });

  it("soma múltiplas taxas percentuais e fixas sobre a base após o frete", () => {
    const acerto = calcularAcertoComercial({
      subtotal: 54_000,
      desconto: "0",
      fretePorTonelada: "440",
      pesoCargaToneladas: "22",
      comissaoTipo: "percentual",
      comissaoValor: "2",
      taxas: [
        { descricao: "ICMS do frete", tipo: "percentual", valor: "1" },
        { descricao: "Taxa de despacho", tipo: "fixo", valor: "150" },
      ],
    });

    expect(acerto.baseAposFrete).toBe(44_320);
    expect(acerto.taxasCalculadas).toEqual([
      expect.objectContaining({ descricao: "ICMS do frete", calculado: 443.2 }),
      expect.objectContaining({ descricao: "Taxa de despacho", calculado: 150 }),
    ]);
    expect(acerto.taxaCalculada).toBeCloseTo(593.2);
    expect(acerto.total).toBeCloseTo(44_026.8);
  });
});
