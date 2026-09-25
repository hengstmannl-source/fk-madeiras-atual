import { describe, expect, it } from "vitest";
import {
  calcularContaOperacional,
  classificarAgingContaOperacional,
  classificarPrioridadeContaOperacional,
  ordenarContasOperacionais,
  resumirContasOperacionais,
} from "./contas-operacionais.logic";

const agora = new Date(2026, 7, 11, 12);

function tituloBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    tipo: "receber" as const,
    estado: "aberto" as const,
    dataVencimento: new Date(2026, 7, 20, 12),
    valorOriginal: "100.00",
    desconto: "0.00",
    juros: "0.00",
    valorBaixado: "0.00",
    ...overrides,
  };
}

describe("contas operacionais", () => {
  it("usa exclusivamente o saldo residual do título, inclusive em baixa parcial", () => {
    const conta = calcularContaOperacional(tituloBase({
      estado: "parcial",
      valorOriginal: "100.00",
      desconto: "10.00",
      juros: "5.00",
      valorBaixado: "30.00",
    }), agora);

    expect(conta.saldoAberto).toBe(65);
    expect(conta.prioridade).toBe("normal");
  });

  it("não prioriza ou contabiliza títulos quitados e cancelados como pendência", () => {
    const quitado = calcularContaOperacional(tituloBase({ estado: "quitado", valorBaixado: "100.00" }), agora);
    const cancelado = calcularContaOperacional(tituloBase({ id: 2, estado: "cancelado" }), agora);
    const resumo = resumirContasOperacionais([quitado, cancelado]);

    expect(quitado.prioridade).toBe("encerrado");
    expect(cancelado.faixaAging).toBe("encerrado");
    expect(resumo.quantidade).toBe(0);
    expect(resumo.saldoAberto).toBe(0);
    expect(resumo.vencido).toBe(0);
  });

  it("classifica as faixas de aging e prioridades de modo determinístico", () => {
    expect(classificarPrioridadeContaOperacional({
      estado: "aberto", saldoAberto: 10, dataVencimento: new Date(2026, 7, 10, 12), agora,
    })).toBe("vencido");
    expect(classificarPrioridadeContaOperacional({
      estado: "aberto", saldoAberto: 10, dataVencimento: new Date(2026, 7, 3, 12), agora,
    })).toBe("vencido_8_30");
    expect(classificarPrioridadeContaOperacional({
      estado: "aberto", saldoAberto: 10, dataVencimento: new Date(2026, 6, 11, 12), agora,
    })).toBe("vencido_31_60");
    expect(classificarPrioridadeContaOperacional({
      estado: "aberto", saldoAberto: 10, dataVencimento: new Date(2026, 5, 11, 12), agora,
    })).toBe("vencido_61_90");
    expect(classificarPrioridadeContaOperacional({
      estado: "aberto", saldoAberto: 10, dataVencimento: new Date(2026, 4, 1, 12), agora,
    })).toBe("vencido_mais_90");
    expect(classificarPrioridadeContaOperacional({
      estado: "aberto", saldoAberto: 10, dataVencimento: agora, agora,
    })).toBe("vence_hoje");
    expect(classificarPrioridadeContaOperacional({
      estado: "aberto", saldoAberto: 10, dataVencimento: new Date(2026, 7, 18, 12), agora,
    })).toBe("vence_em_breve");
    expect(classificarAgingContaOperacional({
      estado: "aberto", saldoAberto: 10, dataVencimento: new Date(2026, 6, 11, 12), agora,
    })).toBe("31_60");
    expect(classificarAgingContaOperacional({
      estado: "aberto", saldoAberto: 10, dataVencimento: new Date(2026, 4, 1, 12), agora,
    })).toBe("mais_90");
  });

  it("ordena a fila por urgência e vencimento sem depender da ordem de origem", () => {
    const normal = calcularContaOperacional(tituloBase({ id: 3, dataVencimento: new Date(2026, 7, 30, 12) }), agora);
    const hoje = calcularContaOperacional(tituloBase({ id: 2, dataVencimento: agora }), agora);
    const vencido = calcularContaOperacional(tituloBase({ id: 1, dataVencimento: new Date(2026, 7, 1, 12) }), agora);

    expect(ordenarContasOperacionais([normal, hoje, vencido]).map((conta) => conta.id)).toEqual([1, 2, 3]);
  });

  it("compõe a vencer, curto prazo e percentual vencido a partir do mesmo saldo residual", () => {
    const atrasado = calcularContaOperacional(tituloBase({ id: 1, dataVencimento: new Date(2026, 7, 1, 12), valorOriginal: "100.00" }), agora);
    const curtoPrazo = calcularContaOperacional(tituloBase({ id: 2, dataVencimento: new Date(2026, 7, 18, 12), valorOriginal: "150.00" }), agora);
    const maisAdiante = calcularContaOperacional(tituloBase({ id: 3, dataVencimento: new Date(2026, 8, 20, 12), valorOriginal: "250.00" }), agora);
    const resumo = resumirContasOperacionais([atrasado, curtoPrazo, maisAdiante]);

    expect(resumo).toMatchObject({ saldoAberto: 500, vencido: 100, aVencer: 400, proximosSeteDias: 150, proximosTrintaDias: 150, percentualVencido: 20 });
  });
});
