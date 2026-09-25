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

describe("fronteiras da conciliação bancária assistida", () => {
  it("cria títulos somente pelo motor idempotente e baixas pelo ciclo central", () => {
    const criacao = corpoDaFuncao("criarLancamentoDaConciliacao");

    expect(criacao).toContain("garantirTituloFinanceiroComChave");
    expect(criacao).toContain("registrarBaixaFinanceira");
    expect(criacao).toContain('origemBaixa: "conciliacao"');
    expect(criacao).not.toContain("tx.insert(titulosFinanceiros)");
    expect(criacao).not.toContain("tx.insert(baixasFinanceiras)");
  });

  it("concilia transferência como operação patrimonial sem título, baixa, receita ou despesa", () => {
    const transferencia = corpoDaFuncao("confirmarConciliacaoTransferenciaBancaria");

    expect(transferencia).toContain("movimentoTransferenciaFinanceiraId");
    expect(transferencia).toContain('tipo: "transferencia"');
    expect(transferencia).toContain("sem título, baixa, receita ou despesa");
    expect(transferencia).not.toContain("titulosFinanceiros");
    expect(transferencia).not.toContain("baixasFinanceiras");
  });

  it("desfaz vínculos de forma auditável e estorna apenas a baixa criada explicitamente pela conciliação", () => {
    const reversao = corpoDaFuncao("desfazerConciliacaoBancaria");

    expect(reversao).toContain("desfeitoEm: agora");
    expect(reversao).toContain("movimentoTransferenciaFinanceiraId: null");
    expect(reversao).toContain('vinculo.tipo === "baixa_gerada"');
    expect(reversao).toContain("estornarBaixaFinanceira");
  });

  it("protege importação e confirmação com bloqueios transacionais e vínculo reutilizável", () => {
    const importacao = corpoDaFuncao("importarExtratoBancario");
    const confirmacao = corpoDaFuncao("confirmarConciliacaoBancaria");
    const helperInicio = codigoFinanceiro.indexOf("async function criarOuReativarVinculoConciliacao");
    const helperFim = codigoFinanceiro.indexOf("/**\n * Materializa o ciclo", helperInicio);
    const helper = codigoFinanceiro.slice(helperInicio, helperFim);

    expect(importacao).toContain('.for("update")');
    expect(importacao).toContain("identificadorExterno");
    expect(confirmacao).toContain('.for("update")');
    expect(confirmacao).toContain("criarOuReativarVinculoConciliacao");
    expect(helper).toContain("existente.desfeitoEm");
    expect(helper).toContain("desfeitoEm: null");
  });
});
