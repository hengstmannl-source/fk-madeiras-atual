import { describe, expect, it } from "vitest";
import { saldoAbertoDashboard, resumirDashboardFinanceiro } from "./dashboardFinanceiro";

describe("indicadores financeiros do Dashboard", () => {
  it("calcula o saldo em aberto a partir do valor original, descontos, juros e baixas", () => {
    expect(saldoAbertoDashboard({
      tipo: "pagar",
      estado: "aberto",
      valorOriginal: "10697.85",
      desconto: "97.85",
      juros: "50",
      valorBaixado: "1000",
    })).toBe(9650);
  });

  it("usa o campo valorOriginal do título, sem zerar valores quando o campo legado valor não existe", () => {
    const resumo = resumirDashboardFinanceiro([
      { tipo: "pagar", estado: "aberto", dataVencimento: "2026-07-21T12:00:00.000Z", valorOriginal: "10.697,85", valorBaixado: "0" },
      { tipo: "receber", estado: "aberto", dataVencimento: "2026-08-20T12:00:00.000Z", valorOriginal: "2500.00", valorBaixado: "500" },
      { tipo: "receber", estado: "quitado", valorOriginal: "999" },
      { tipo: "pagar", estado: "cancelado", valorOriginal: "333" },
    ], new Date("2026-08-13T12:00:00.000Z"));

    expect(resumo).toEqual({
      pagar: 10697.85,
      receber: 2000,
      vencido: 10697.85,
      quantidadePagar: 1,
      quantidadeReceber: 1,
    });
  });

  it("não considera vencido um título com prazo no dia atual", () => {
    const resumo = resumirDashboardFinanceiro([
      { tipo: "pagar", estado: "aberto", dataVencimento: "2026-08-13T00:00:00.000Z", valorOriginal: "100" },
    ], new Date("2026-08-13T12:00:00.000Z"));
    expect(resumo.vencido).toBe(0);
  });
});
