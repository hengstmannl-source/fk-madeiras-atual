import { describe, expect, it } from "vitest";
import { calcularBaseIRRF, calcularFolhaColaboradorRh, calcularIRRFFinal, calcularImpostoProgressivoRh, competenciaRh, motivoBloqueioRemocaoColaboradorRh, podeEditarFolhaRh } from "./rh.logic";

const regras = {
  faixasInss: [
    { limiteInferior: 0, limiteSuperior: 1500, aliquota: 7.5, parcelaDeduzir: 0 },
    { limiteInferior: 1500.01, limiteSuperior: null, aliquota: 10, parcelaDeduzir: 37.5 },
  ],
  faixasIrrf: [
    { limiteInferior: 0, limiteSuperior: 2000, aliquota: 0, parcelaDeduzir: 0 },
    { limiteInferior: 2000.01, limiteSuperior: null, aliquota: 7.5, parcelaDeduzir: 150 },
  ],
  aliquotaFgts: 8,
  deducaoDependenteIrrf: 189.59,
};

const regrasIrrf2026 = {
  faixasInss: [
    { limiteInferior: 0, limiteSuperior: 1621, aliquota: 7.5, parcelaDeduzir: 0 },
    { limiteInferior: 1621.01, limiteSuperior: 2902.84, aliquota: 9, parcelaDeduzir: 24.32 },
    { limiteInferior: 2902.85, limiteSuperior: 4354.27, aliquota: 12, parcelaDeduzir: 111.3 },
    { limiteInferior: 4354.28, limiteSuperior: 8475.55, aliquota: 14, parcelaDeduzir: 198.82 },
    { limiteInferior: 8475.56, limiteSuperior: null, aliquota: 14, parcelaDeduzir: 198.82 },
  ],
  faixasIrrf: [
    { limiteInferior: 0, limiteSuperior: 2428.8, aliquota: 0, parcelaDeduzir: 0 },
    { limiteInferior: 2428.81, limiteSuperior: 2826.65, aliquota: 7.5, parcelaDeduzir: 182.16 },
    { limiteInferior: 2826.66, limiteSuperior: 3751.05, aliquota: 15, parcelaDeduzir: 394.16 },
    { limiteInferior: 3751.06, limiteSuperior: 4664.68, aliquota: 22.5, parcelaDeduzir: 675.49 },
    { limiteInferior: 4664.69, limiteSuperior: null, aliquota: 27.5, parcelaDeduzir: 908.73 },
  ],
  aliquotaFgts: 8,
  deducaoDependenteIrrf: 189.59,
  descontoSimplificadoIrrf: 607.2,
  regrasReducaoIrrf: [
    { tipo: "zera_imposto" as const, limiteInferior: 0, limiteSuperior: 5000, valorMaximo: 0, constante: 0, coeficiente: 0, ordem: 1 },
    { tipo: "formula_linear" as const, limiteInferior: 5000.01, limiteSuperior: 7350, valorMaximo: 0, constante: 978.62, coeficiente: 0.133145, ordem: 2 },
  ],
};

const calcularIrrf2026 = (salarioBase: number, quantidadeDependentesIrrf = 0, eventos: any[] = []) => calcularFolhaColaboradorRh({ salarioBase, quantidadeDependentesIrrf, adiantamentos: 0, eventos, regras: regrasIrrf2026 });

describe("cálculo de folha de RH", () => {
  it("calcula proventos, descontos e custo da empresa a partir de regras configuráveis", () => {
    const resultado = calcularFolhaColaboradorRh({
      salarioBase: 3000,
      quantidadeDependentesIrrf: 1,
      adiantamentos: 400,
      regras,
      eventos: [
        { descricao: "Hora extra", tipo: "provento", valor: 200, incideInss: true, incideIrrf: true, incideFgts: true },
        { descricao: "Plano de saúde", tipo: "desconto", valor: 80 },
      ],
    });
    expect(resultado).toMatchObject({ totalProventos: 3200, inss: 282.5, irrf: 54.59, outrosDescontos: 80, totalDescontos: 817.09, salarioLiquido: 2382.91, fgts: 256, custoEmpresa: 3456 });
  });

  it("protege o imposto contra bases negativas e permite editar somente folhas abertas", () => {
    expect(calcularImpostoProgressivoRh(-10, regras.faixasInss)).toBe(0);
    expect(podeEditarFolhaRh("aberta")).toBe(true);
    expect(podeEditarFolhaRh("fechada")).toBe(false);
  });

  it("normaliza competências para o primeiro dia do mês", () => {
    expect(competenciaRh(new Date(2026, 7, 19, 9, 30)).toISOString()).toContain("2026-08-01");
  });

  it("permite remover cadastro com apenas histórico salarial inicial e bloqueia movimentações efetivas", () => {
    expect(motivoBloqueioRemocaoColaboradorRh({ dependentes: false, alteracoesSalariais: false, adiantamentos: false, itensFolha: false })).toBeNull();
    expect(motivoBloqueioRemocaoColaboradorRh({ dependentes: false, alteracoesSalariais: true, adiantamentos: false, itensFolha: true })).toMatch(/alterações salariais.*lançamentos de folha/i);
  });

  it("permite remover colaborador inativo sem lançamentos financeiros, sem considerar alterações salariais", () => {
    expect(motivoBloqueioRemocaoColaboradorRh({ dependentes: true, alteracoesSalariais: true, adiantamentos: false, itensFolha: false }, "desligado")).toBeNull();
    expect(motivoBloqueioRemocaoColaboradorRh({ dependentes: true, alteracoesSalariais: true, adiantamentos: true, itensFolha: false }, "desligado")).toMatch(/adiantamentos/i);
    expect(motivoBloqueioRemocaoColaboradorRh({ dependentes: false, alteracoesSalariais: true, adiantamentos: false, itensFolha: true }, "desligado")).toMatch(/lançamentos de folha/i);
  });

  it("identifica cada categoria de vínculo que deve continuar bloqueando a exclusão", () => {
    expect(motivoBloqueioRemocaoColaboradorRh({ dependentes: true, alteracoesSalariais: false, adiantamentos: false, itensFolha: false })).toMatch(/dependentes/i);
    expect(motivoBloqueioRemocaoColaboradorRh({ dependentes: false, alteracoesSalariais: false, adiantamentos: true, itensFolha: false })).toMatch(/adiantamentos/i);
    expect(motivoBloqueioRemocaoColaboradorRh({ dependentes: false, alteracoesSalariais: false, adiantamentos: false, itensFolha: true })).toMatch(/lançamentos de folha/i);
  });

  it("compara deduções legais e desconto simplificado antes de definir a base de IRRF", () => {
    expect(calcularBaseIRRF({ rendimentosTributaveis: 3000, inssDedutivel: 248.7, quantidadeDependentes: 0, deducaoDependente: 189.59, descontoSimplificado: 607.2 })).toMatchObject({ deducoesLegais: 248.7, deducaoUtilizada: 607.2, metodoDeducao: "simplificado", baseCalculo: 2392.8 });
    expect(calcularBaseIRRF({ rendimentosTributaveis: 5000, inssDedutivel: 501.18, quantidadeDependentes: 2, deducaoDependente: 189.59, descontoSimplificado: 607.2 })).toMatchObject({ deducaoDependentes: 379.18, deducoesLegais: 880.36, deducaoUtilizada: 880.36, metodoDeducao: "legal", baseCalculo: 4119.64 });
  });

  it("aplica a tabela progressiva e as reduções de 2026 armazenadas em regras", () => {
    expect(calcularIrrf2026(1621).irrf).toBe(0);
    expect(calcularIrrf2026(2000).irrf).toBe(0);
    expect(calcularIrrf2026(3000).irrf).toBe(0);
    expect(calcularIrrf2026(4000).memoriaIrrf).toMatchObject({ irrfProgressivo: 114.76, reducaoIrrf: 114.76, irrfFinal: 0 });
    expect(calcularIrrf2026(5000).memoriaIrrf).toMatchObject({ rendimentosTributaveis: 5000, irrfProgressivo: 312.89, reducaoIrrf: 312.89, irrfFinal: 0 });
    expect(calcularIrrf2026(6000).memoriaIrrf).toMatchObject({ irrfProgressivo: 564.95, reducaoIrrf: 179.75, irrfFinal: 385.2 });
  });

  it("respeita os limites superior e inferior da redução sem codificar o ano no motor", () => {
    expect(calcularIrrf2026(7350).memoriaIrrf).toMatchObject({ reducaoIrrf: 0, irrfFinal: 884.22 });
    expect(calcularIrrf2026(7351).memoriaIrrf).toMatchObject({ reducaoIrrf: 0, irrfFinal: 884.46 });
    expect(calcularIrrf2026(10000).memoriaIrrf).toMatchObject({ reducaoIrrf: 0, irrfFinal: 1510.95 });
    expect(calcularIRRFFinal({ baseCalculo: 4000, rendimentoTributavel: 5001, faixas: regrasIrrf2026.faixasIrrf, regrasReducao: regrasIrrf2026.regrasReducaoIrrf })).toMatchObject({ irrfProgressivo: 224.51, reducaoIrrf: 224.51, irrfFinal: 0 });
  });

  it("preserva outras deduções legais e a memória auditável na folha", () => {
    const resultado = calcularIrrf2026(5000, 2, [{ descricao: "Pensão alimentícia", tipo: "desconto", valor: 400, deduzIrrf: true }]);
    expect(resultado.memoriaIrrf).toMatchObject({ quantidadeDependentes: 2, deducaoDependentes: 379.18, outrasDeducoes: 400, deducoesLegais: 1280.36, metodoDeducao: "legal", tabelaIrrfId: null });
    expect(resultado.outrosDescontos).toBe(400);
    expect(resultado.fgts).toBe(400);
  });
});
