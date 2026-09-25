import { describe, expect, it } from "vitest";
import { podeAlterarOrcamentoPago } from "./db";
import { RegistroPagamentoSchema } from "./routers/orcamento";

describe("bloqueio de orçamento pago", () => {
  it("permite alterações em um orçamento ainda não pago", () => {
    expect(podeAlterarOrcamentoPago(false, false)).toBe(true);
  });

  it("exige confirmação dupla antes de alterar ou excluir um orçamento pago", () => {
    expect(podeAlterarOrcamentoPago(true, false)).toBe(false);
    expect(podeAlterarOrcamentoPago(true, true)).toBe(true);
  });

  it("aceita uma forma e uma data exata ao registrar o pagamento", () => {
    expect(RegistroPagamentoSchema.parse({
      id: 9,
      formaPagamento: "pix",
      pagoEm: "2026-08-11",
    })).toMatchObject({ formaPagamento: "pix", pagoEm: "2026-08-11" });
  });

  it("rejeita formas de pagamento não suportadas", () => {
    expect(() => RegistroPagamentoSchema.parse({ id: 9, formaPagamento: "cripto", pagoEm: "2026-08-11" })).toThrow();
  });
});
