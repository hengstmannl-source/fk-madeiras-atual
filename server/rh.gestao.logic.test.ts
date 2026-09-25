import { describe, expect, it } from "vitest";
import { calcularCustoColaboradorGerencialRh, custoVigenteNoMes, somarCustosEquipeGerencialRh } from "./rh.gestao.logic";

const configuracaoPadrao = {
  fgtsPercentual: 8,
  descontoInssEstimadoAtivo: false,
  provisaoDecimoTerceiroAtiva: true,
  provisaoFeriasAtiva: true,
  provisaoTercoFeriasAtiva: true,
};

describe("RH gerencial — composição de custos", () => {
  it("calcula salário, FGTS estimado e provisões mensais de forma transparente", () => {
    const resultado = calcularCustoColaboradorGerencialRh({
      salarioBruto: 3000,
      configuracao: configuracaoPadrao,
      custos: [],
      referencia: new Date(2026, 7, 1),
    });
    expect(resultado).toMatchObject({
      salarioBruto: 3000,
      fgtsEstimado: 240,
      provisaoDecimoTerceiro: 250,
      provisaoFerias: 250,
      provisaoTercoFerias: 83.33,
      beneficiosECustos: 0,
      custoMensalEstimado: 3823.33,
      custoAnualEstimado: 45879.96,
    });
  });

  it("calcula o desconto estimado de INSS sem reduzir o custo empresarial", () => {
    const resultado = calcularCustoColaboradorGerencialRh({
      salarioBruto: 3000,
      configuracao: { ...configuracaoPadrao, descontoInssEstimadoAtivo: true },
      custos: [],
      referencia: new Date(2026, 7, 1),
      faixasInss: [{ limiteInferior: 0, limiteSuperior: null, aliquota: 10, parcelaDeduzir: 0 }],
    });
    expect(resultado).toMatchObject({ inssEstimado: 300, salarioLiquidoEstimado: 2700, custoMensalEstimado: 3823.33 });
  });

  it("desconta do líquido apenas os benefícios marcados e os adiantamentos pendentes", () => {
    const resultado = calcularCustoColaboradorGerencialRh({
      salarioBruto: 3000,
      configuracao: { ...configuracaoPadrao, fgtsPercentual: 0, provisaoDecimoTerceiroAtiva: false, provisaoFeriasAtiva: false, provisaoTercoFeriasAtiva: false },
      custos: [
        { descricao: "Vale-transporte", tipo: "fixo", valor: 180, recorrente: true, descontarDoLiquido: true, ativo: true, dataInicio: new Date(2026, 0, 1) },
        { descricao: "Plano de saúde custeado", tipo: "fixo", valor: 250, recorrente: true, descontarDoLiquido: false, ativo: true, dataInicio: new Date(2026, 0, 1) },
      ],
      adiantamentosDescontados: 400,
      referencia: new Date(2026, 7, 1),
    });
    expect(resultado).toMatchObject({ beneficiosDescontados: 180, adiantamentosDescontados: 400, totalDescontosGerenciais: 580, salarioLiquidoEstimado: 2420, custoMensalEstimado: 3430 });
  });

  it("inclui custos fixos e percentuais apenas dentro da vigência", () => {
    const resultado = calcularCustoColaboradorGerencialRh({
      salarioBruto: 2000,
      configuracao: { ...configuracaoPadrao, fgtsPercentual: 0, provisaoDecimoTerceiroAtiva: false, provisaoFeriasAtiva: false, provisaoTercoFeriasAtiva: false },
      custos: [
        { descricao: "Plano de saúde", tipo: "fixo", valor: 120, recorrente: true, ativo: true, dataInicio: new Date(2026, 0, 1) },
        { descricao: "Seguro", tipo: "percentual", valor: 2, recorrente: true, ativo: true, dataInicio: new Date(2026, 0, 1) },
        { descricao: "Benefício encerrado", tipo: "fixo", valor: 999, recorrente: true, ativo: true, dataInicio: new Date(2025, 0, 1), dataFim: new Date(2026, 5, 30) },
      ],
      referencia: new Date(2026, 7, 1),
    });
    expect(resultado.detalhesOutrosCustos).toEqual([{ descricao: "Plano de saúde", valor: 120 }, { descricao: "Seguro", valor: 40 }]);
    expect(resultado.beneficiosECustos).toBe(160);
    expect(resultado.custoMensalEstimado).toBe(2160);
    expect(resultado.custoAnualEstimado).toBe(25920);
  });

  it("considera custo pontual somente uma vez na previsão anual", () => {
    const resultado = calcularCustoColaboradorGerencialRh({
      salarioBruto: 1000,
      configuracao: { ...configuracaoPadrao, fgtsPercentual: 0, provisaoDecimoTerceiroAtiva: false, provisaoFeriasAtiva: false, provisaoTercoFeriasAtiva: false },
      custos: [{ descricao: "Exame admissional", tipo: "fixo", valor: 180, recorrente: false, ativo: true, dataInicio: new Date(2026, 7, 1) }],
      referencia: new Date(2026, 7, 1),
    });
    expect(resultado.custoMensalEstimado).toBe(1180);
    expect(resultado.custoAnualEstimado).toBe(12180);
  });

  it("agrega custo de equipe separado de custos por colaborador", () => {
    const referencia = new Date(2026, 7, 1);
    const item = calcularCustoColaboradorGerencialRh({ salarioBruto: 1000, configuracao: { ...configuracaoPadrao, fgtsPercentual: 0, provisaoDecimoTerceiroAtiva: false, provisaoFeriasAtiva: false, provisaoTercoFeriasAtiva: false }, custos: [], referencia });
    const equipe = somarCustosEquipeGerencialRh([item, item], [{ descricao: "Seguro coletivo", tipo: "fixo", valor: 200, recorrente: true, ativo: true, dataInicio: new Date(2026, 0, 1) }], referencia);
    expect(equipe).toMatchObject({ colaboradoresAtivos: 2, salariosBrutos: 2000, outrosCustosEquipe: 200, custoMensalEstimado: 2200, custoAnualEstimado: 26400 });
  });

  it("rejeita regra inativa, sem valor ou fora de vigência", () => {
    const referencia = new Date(2026, 7, 1);
    expect(custoVigenteNoMes({ descricao: "Inativo", tipo: "fixo", valor: 100, recorrente: true, ativo: false, dataInicio: new Date(2026, 0, 1) }, referencia)).toBe(false);
    expect(custoVigenteNoMes({ descricao: "Sem valor", tipo: "fixo", valor: 0, recorrente: true, ativo: true, dataInicio: new Date(2026, 0, 1) }, referencia)).toBe(false);
    expect(custoVigenteNoMes({ descricao: "Futuro", tipo: "fixo", valor: 100, recorrente: true, ativo: true, dataInicio: new Date(2026, 8, 1) }, referencia)).toBe(false);
  });
});
