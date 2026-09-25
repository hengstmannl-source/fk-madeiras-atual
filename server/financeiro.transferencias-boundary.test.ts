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

describe("fronteira patrimonial das transferências internas", () => {
  it("cria somente a transferência e seus dois movimentos vinculados, sem título ou baixa", () => {
    const criacao = corpoDaFuncao("criarTransferenciaFinanceira");
    const movimentos = codigoFinanceiro.slice(
      codigoFinanceiro.indexOf("async function registrarMovimentosTransferencia"),
      codigoFinanceiro.indexOf("/**\n * Cria uma transferência", codigoFinanceiro.indexOf("async function registrarMovimentosTransferencia")),
    );

    expect(criacao).toContain("tx.insert(transferenciasFinanceiras)");
    expect(criacao).toContain("registrarMovimentosTransferencia(tx");
    expect(criacao).not.toContain("titulosFinanceiros");
    expect(criacao).not.toContain("baixasFinanceiras");
    expect(movimentos).toContain("tipo: \"saida\"");
    expect(movimentos).toContain("tipo: \"entrada\"");
  });

  it("estorna somente uma vez por transferência inversa, sem apagar o histórico", () => {
    const estorno = corpoDaFuncao("estornarTransferenciaFinanceira");

    expect(estorno).toContain('estado: "estornada"');
    expect(estorno).toContain('eq(transferenciasFinanceiras.estado, "efetivada")');
    expect(estorno).toContain("transferenciaOrigemId: transferencia.id");
    expect(estorno).toContain("registrarMovimentosTransferencia(tx");
    expect(estorno).not.toContain("tx.delete(transferenciasFinanceiras)");
  });

  it("bloqueia as contas e a transferência original durante operações concorrentes", () => {
    const bloqueioContasInicio = codigoFinanceiro.indexOf("async function contasDaTransferencia");
    const bloqueioContasFim = codigoFinanceiro.indexOf("\nasync function registrarMovimentosTransferencia", bloqueioContasInicio);
    const bloqueioContas = codigoFinanceiro.slice(bloqueioContasInicio, bloqueioContasFim);
    const estorno = corpoDaFuncao("estornarTransferenciaFinanceira");

    expect(bloqueioContas).toContain('.for("update")');
    expect(estorno).toContain('.for("update").limit(1)');
  });
});
