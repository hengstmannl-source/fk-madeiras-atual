import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const arquivoFinanceiro = path.resolve(process.cwd(), "server/repositories/financeiro.ts");
const codigoFinanceiro = fs.readFileSync(arquivoFinanceiro, "utf8");

function corpoDaFuncao(nome: string): string {
  const inicio = codigoFinanceiro.indexOf(`export async function ${nome}`);
  if (inicio < 0) throw new Error(`Função ${nome} não encontrada`);
  const proximaFuncao = codigoFinanceiro.indexOf("\nexport async function ", inicio + 1);
  return codigoFinanceiro.slice(inicio, proximaFuncao < 0 ? undefined : proximaFuncao);
}

describe("fronteira do ciclo de vida de títulos financeiros", () => {
  it("reconstrói saldo e estado pela única rotina materializadora", () => {
    expect(codigoFinanceiro).toContain("async function reconciliarCicloTituloFinanceiro");
    expect(codigoFinanceiro).toContain("calcularCicloTituloFinanceiro");
  });

  it("serializa baixa e estorno no título antes de reconciliar seus valores", () => {
    const baixa = corpoDaFuncao("registrarBaixaFinanceira");
    const estorno = corpoDaFuncao("estornarBaixaFinanceira");
    expect(baixa).toContain('.for("update")');
    expect(baixa).toContain("reconciliarCicloTituloFinanceiro(tx, titulo");
    expect(estorno).toContain('.for("update")');
    expect(estorno).toContain("reconciliarCicloTituloFinanceiro(tx, titulo");
  });
});
