import { describe, expect, it } from "vitest";
import { chaveDataFinanceira, diasEntreDatasFinanceiras, hojeFinanceiro, somarDiasFinanceiros } from "@shared/financeiro-data-civil";

describe("datas civis financeiras", () => {
  it("mantém a data de vencimento de um timestamp UTC sem deslocá-la para o dia anterior", () => {
    expect(chaveDataFinanceira("2026-08-13T00:00:00.000Z")).toBe("2026-08-13");
  });

  it("distingue vencidos, vencimento hoje e futuro pela data, não pela hora", () => {
    const hoje = hojeFinanceiro(new Date("2026-08-13T12:00:00.000Z"));
    expect(chaveDataFinanceira("2026-08-12T00:00:00.000Z")! < hoje).toBe(true);
    expect(chaveDataFinanceira("2026-08-13T00:00:00.000Z")).toBe(hoje);
    expect(chaveDataFinanceira("2026-08-14T00:00:00.000Z")! > hoje).toBe(true);
  });

  it("mantém o dia 13 antes da meia-noite de Brasília mesmo quando UTC já está no dia 14", () => {
    expect(hojeFinanceiro(new Date("2026-08-14T02:59:59.999Z"))).toBe("2026-08-13");
  });

  it("avança para o dia 14 imediatamente após a meia-noite de Brasília", () => {
    expect(hojeFinanceiro(new Date("2026-08-14T03:00:00.001Z"))).toBe("2026-08-14");
  });

  it("faz aritmética de dias atravessando mês e ano sem depender do fuso horário", () => {
    expect(somarDiasFinanceiros("2026-01-01", -1)).toBe("2025-12-31");
    expect(somarDiasFinanceiros("2026-01-31", 1)).toBe("2026-02-01");
    expect(diasEntreDatasFinanceiras("2025-12-31", "2026-01-02")).toBe(2);
  });

  it("rejeita datas civis inexistentes", () => {
    expect(chaveDataFinanceira("2026-02-30")).toBeNull();
  });
});
