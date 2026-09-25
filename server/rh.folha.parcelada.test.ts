import { describe, expect, it } from "vitest";
import { descontosParceladosDaCompetencia, situacaoAposBaixaParcelas } from "./routers/rh.folha.parcelada";

describe("parcelamento de adiantamentos na folha", () => {
  it("desconta somente a parcela pendente da competência em vez do saldo integral", () => {
    const agosto = new Date(2026, 7, 1, 12);
    const setembro = new Date(2026, 8, 1, 12);
    const adiantamentos = [{ id: 7, colaboradorId: 3, competencia: agosto, saldoPendente: "900.00", estado: "aberto" }];
    const parcelas = [
      { adiantamentoId: 7, competencia: agosto, valor: "300.00", estado: "pendente" },
      { adiantamentoId: 7, competencia: setembro, valor: "300.00", estado: "pendente" },
      { adiantamentoId: 7, competencia: new Date(2026, 9, 1, 12), valor: "300.00", estado: "pendente" },
    ];

    expect(descontosParceladosDaCompetencia(adiantamentos, parcelas, agosto).get(3)).toBe(300);
    expect(descontosParceladosDaCompetencia(adiantamentos, parcelas, setembro).get(3)).toBe(300);
  });

  it("mantém o adiantamento aberto enquanto restarem parcelas e o encerra apenas na última", () => {
    expect(situacaoAposBaixaParcelas([
      { valor: "300.00", estado: "descontada" },
      { valor: "300.00", estado: "pendente" },
      { valor: "300.00", estado: "pendente" },
    ])).toEqual({ saldoPendente: "600.00", estado: "aberto" });
    expect(situacaoAposBaixaParcelas([
      { valor: "300.00", estado: "descontada" },
      { valor: "300.00", estado: "descontada" },
      { valor: "300.00", estado: "descontada" },
    ])).toEqual({ saldoPendente: "0.00", estado: "descontado" });
  });
});
