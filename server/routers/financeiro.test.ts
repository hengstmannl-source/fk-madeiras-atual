import { describe, expect, it } from "vitest";
import { ContaSchema, FormaPagamentoFinanceiraSchema, LancamentoManualSchema, RecorrenciaSchema } from "./financeiro";

describe("validação de lançamentos financeiros manuais", () => {
  const base = {
    tipo: "pagar" as const,
    descricao: "Frete excepcional",
    categoriaId: 1,
    valorOriginal: "150,50",
    dataEmissao: "2026-08-11",
    dataVencimento: "2026-08-20",
  };

  it("aceita um lançamento não programado sem orçamento, cliente ou fornecedor", () => {
    expect(LancamentoManualSchema.parse(base)).toMatchObject(base);
  });

  it("rejeita lançamentos manuais sem valor ou categoria", () => {
    expect(() => LancamentoManualSchema.parse({ ...base, valorOriginal: "" })).toThrow();
    expect(() => LancamentoManualSchema.parse({ ...base, categoriaId: 0 })).toThrow();
  });
});

describe("validação de recorrências financeiras", () => {
  const base = {
    tipo: "pagar" as const,
    descricao: "Aluguel do galpão",
    categoriaId: 1,
    valor: "2500,00",
    frequencia: "mensal" as const,
    proximoVencimento: "2026-09-10",
  };

  it("aceita uma recorrência com prazo final opcional", () => {
    expect(RecorrenciaSchema.parse(base)).toMatchObject(base);
  });

  it("rejeita uma recorrência sem frequência válida", () => {
    expect(() => RecorrenciaSchema.parse({ ...base, frequencia: "diaria" })).toThrow();
  });
});

describe("contrato do Caixa Cheque", () => {
  it("aceita a forma de pagamento cheque", () => {
    expect(FormaPagamentoFinanceiraSchema.parse("cheque")).toBe("cheque");
  });

  it("aceita uma conta financeira do tipo Caixa Cheque", () => {
    expect(ContaSchema.parse({ nome: "Caixa Cheque", tipo: "caixa_cheque", saldoInicial: "0" })).toMatchObject({ tipo: "caixa_cheque" });
  });

  it("rejeita tipos de conta e formas de pagamento desconhecidos", () => {
    expect(() => FormaPagamentoFinanceiraSchema.parse("promissoria")).toThrow();
    expect(() => ContaSchema.parse({ nome: "Conta inválida", tipo: "credito" })).toThrow();
  });
});

describe("contrato de edição cadastral de contas bancárias", () => {
  const contaBancaria = {
    nome: "Banco Principal",
    tipo: "banco" as const,
    saldoInicial: "1250,00",
    banco: "Banco do Brasil",
    agencia: "1234-5",
    numeroConta: "98765-4",
    dataInicio: "2026-01-02",
    observacoes: "Conta operacional",
  };

  it("aceita dados cadastrais bancários editáveis", () => {
    expect(ContaSchema.parse(contaBancaria)).toMatchObject({
      banco: "Banco do Brasil",
      agencia: "1234-5",
      numeroConta: "98765-4",
      dataInicio: "2026-01-02",
    });
  });

  it("descarta campos financeiros imutáveis da edição cadastral", () => {
    const entradaInsegura = { ...contaBancaria, saldoAtual: "9999,99", valorBaixado: "80,00" };
    const resultado = ContaSchema.parse(entradaInsegura);
    expect(resultado).not.toHaveProperty("saldoAtual");
    expect(resultado).not.toHaveProperty("valorBaixado");
    expect(resultado.saldoInicial).toBe("1250,00");
  });
});
