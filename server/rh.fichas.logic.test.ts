import { calcularExtratoComSaldo, resumoLancamentos } from "./routers/rh.fichas";
import { describe, expect, it } from "vitest";

describe("fichas financeiras de colaboradores", () => {
  it("calcula o saldo líquido a partir de créditos, débitos e pagamentos", () => {
    const resumo = resumoLancamentos([
      { tipo: "credito", valor: "2500.00", estado: "pendente" },
      { tipo: "credito", valor: "150.00", estado: "pendente" },
      { tipo: "debito", valor: "300.00", estado: "pendente" },
      { tipo: "pagamento", valor: "1000.00", estado: "liquidado" },
    ]);

    expect(resumo).toEqual({ creditos: 2650, debitos: 300, pagamentos: 1000 });
    expect(resumo.creditos - resumo.debitos - resumo.pagamentos).toBe(1350);
  });

  it("preserva o histórico cancelado sem deixá-lo alterar o saldo em aberto", () => {
    const resumo = resumoLancamentos([
      { tipo: "credito", valor: "1800.00", estado: "pendente" },
      { tipo: "debito", valor: "250.00", estado: "cancelado" },
      { tipo: "pagamento", valor: "500.00", estado: "cancelado" },
    ]);

    expect(resumo).toEqual({ creditos: 1800, debitos: 0, pagamentos: 0 });
  });

  it("ordena o extrato cronologicamente e apresenta saldo acumulado sem movimentar cancelamentos", () => {
    const extrato = calcularExtratoComSaldo([
      { id: 3, tipo: "pagamento" as const, valor: "500.00", estado: "liquidado" as const, dataLancamento: new Date("2026-08-20T12:00:00") },
      { id: 2, tipo: "debito" as const, valor: "180.00", estado: "cancelado" as const, dataLancamento: new Date("2026-08-10T12:00:00") },
      { id: 1, tipo: "credito" as const, valor: "2000.00", estado: "pendente" as const, dataLancamento: new Date("2026-08-05T12:00:00") },
    ]);

    expect(extrato.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(extrato.map((item) => item.saldoAcumulado)).toEqual([2000, 2000, 1500]);
  });
});
