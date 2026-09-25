import { describe, expect, it } from "vitest";
import { calcularCustoAbastecimentoDiesel, calcularResumoTanqueDiesel, validarExclusaoNotaDiesel } from "./diesel.logic";

describe("tanque de diesel", () => {
  it("separa o valor das notas do custo apropriado aos abastecimentos", () => {
    const resumo = calcularResumoTanqueDiesel(
      [{ litros: "1000", valorTotal: "6000" }, { litros: "500", valorTotal: "3500" }],
      [{ litros: "200", custoTotal: "1200" }],
    );

    expect(resumo).toMatchObject({
      litrosEntrados: 1500,
      litrosAbastecidos: 200,
      saldoLitros: 1300,
      valorNotas: 9500,
      custoApropriado: 1200,
      valorEstoque: 8300,
      custoMedioLitro: 6.3846,
    });
  });

  it("atribui o custo médio atual ao abastecimento e bloqueia saída acima do saldo", () => {
    const resumo = calcularResumoTanqueDiesel([{ litros: "400", valorTotal: "2600" }], []);
    expect(calcularCustoAbastecimentoDiesel(resumo, "50")).toEqual({ litros: 50, custoUnitario: 6.5, custoTotal: 325 });
    expect(() => calcularCustoAbastecimentoDiesel(resumo, "401")).toThrow("Saldo insuficiente no tanque");
  });

  it("permite excluir nota apenas sem abastecimentos ou baixas financeiras ativas", () => {
    expect(() => validarExclusaoNotaDiesel({ possuiAbastecimentos: false, possuiBaixasAtivas: false })).not.toThrow();
    expect(() => validarExclusaoNotaDiesel({ possuiAbastecimentos: true, possuiBaixasAtivas: false })).toThrow("já existem abastecimentos");
    expect(() => validarExclusaoNotaDiesel({ possuiAbastecimentos: false, possuiBaixasAtivas: true })).toThrow("baixa financeira ativa");
  });
});
