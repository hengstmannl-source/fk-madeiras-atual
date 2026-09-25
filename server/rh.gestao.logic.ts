import { arredondarDinheiroRh, calcularImpostoProgressivoRh, type FaixaTributariaRhCalculo } from "./rh.logic";

export type TipoCustoGerencialRh = "fixo" | "percentual";

export type RegraCustoGerencialRh = {
  id?: number;
  descricao: string;
  tipo: TipoCustoGerencialRh;
  valor: number;
  recorrente: boolean;
  descontarDoLiquido?: boolean;
  ativo: boolean;
  dataInicio: Date;
  dataFim?: Date | null;
};

export type ConfiguracaoCustosGerenciaisRh = {
  fgtsPercentual: number;
  descontoInssEstimadoAtivo: boolean;
  provisaoDecimoTerceiroAtiva: boolean;
  provisaoFeriasAtiva: boolean;
  provisaoTercoFeriasAtiva: boolean;
};

export type ComposicaoCustoColaboradorRh = {
  salarioBruto: number;
  inssEstimado: number;
  beneficiosDescontados: number;
  adiantamentosDescontados: number;
  totalDescontosGerenciais: number;
  salarioLiquidoEstimado: number;
  fgtsEstimado: number;
  provisaoDecimoTerceiro: number;
  provisaoFerias: number;
  provisaoTercoFerias: number;
  beneficiosECustos: number;
  custoMensalEstimado: number;
  custoAnualEstimado: number;
  detalhesOutrosCustos: Array<{ descricao: string; valor: number }>;
};

function numeroPositivo(valor: number) {
  return Math.max(0, Number(valor) || 0);
}

export function custoVigenteNoMes(regra: RegraCustoGerencialRh, referencia: Date) {
  if (!regra.ativo || !regra.descricao.trim() || numeroPositivo(regra.valor) <= 0) return false;
  const inicioMes = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
  const fimMes = new Date(referencia.getFullYear(), referencia.getMonth() + 1, 0, 23, 59, 59, 999);
  return regra.dataInicio <= fimMes && (!regra.dataFim || regra.dataFim >= inicioMes);
}

export function valorRegraCustoGerencial(regra: RegraCustoGerencialRh, salarioBruto: number) {
  const valor = numeroPositivo(regra.valor);
  return arredondarDinheiroRh(regra.tipo === "percentual" ? numeroPositivo(salarioBruto) * (valor / 100) : valor);
}

/**
 * Cálculo exclusivamente gerencial: não apura folha, impostos nem obrigações oficiais.
 * As provisões são lineares para permitir planejamento financeiro transparente.
 */
export function calcularCustoColaboradorGerencialRh(entrada: {
  salarioBruto: number;
  configuracao: ConfiguracaoCustosGerenciaisRh;
  custos: RegraCustoGerencialRh[];
  referencia: Date;
  faixasInss?: FaixaTributariaRhCalculo[];
  adiantamentosDescontados?: number;
}) : ComposicaoCustoColaboradorRh {
  const salarioBruto = arredondarDinheiroRh(numeroPositivo(entrada.salarioBruto));
  const inssEstimado = entrada.configuracao.descontoInssEstimadoAtivo ? calcularImpostoProgressivoRh(salarioBruto, entrada.faixasInss ?? []) : 0;
  const fgtsEstimado = arredondarDinheiroRh(salarioBruto * (numeroPositivo(entrada.configuracao.fgtsPercentual) / 100));
  const provisaoDecimoTerceiro = entrada.configuracao.provisaoDecimoTerceiroAtiva ? arredondarDinheiroRh(salarioBruto / 12) : 0;
  const provisaoFerias = entrada.configuracao.provisaoFeriasAtiva ? arredondarDinheiroRh(salarioBruto / 12) : 0;
  const provisaoTercoFerias = entrada.configuracao.provisaoTercoFeriasAtiva && entrada.configuracao.provisaoFeriasAtiva ? arredondarDinheiroRh(provisaoFerias / 3) : 0;
  const detalhesOutrosCustos = entrada.custos
    .filter((custo) => custoVigenteNoMes(custo, entrada.referencia))
    .map((custo) => ({ descricao: custo.descricao.trim(), valor: valorRegraCustoGerencial(custo, salarioBruto) }));
  const beneficiosDescontados = arredondarDinheiroRh(entrada.custos.filter((custo) => custo.descontarDoLiquido && custoVigenteNoMes(custo, entrada.referencia)).reduce((soma, custo) => soma + valorRegraCustoGerencial(custo, salarioBruto), 0));
  const adiantamentosDescontados = arredondarDinheiroRh(numeroPositivo(entrada.adiantamentosDescontados ?? 0));
  const totalDescontosGerenciais = arredondarDinheiroRh(inssEstimado + beneficiosDescontados + adiantamentosDescontados);
  const salarioLiquidoEstimado = arredondarDinheiroRh(Math.max(0, salarioBruto - totalDescontosGerenciais));
  const beneficiosECustos = arredondarDinheiroRh(detalhesOutrosCustos.reduce((soma, custo) => soma + custo.valor, 0));
  const custoMensalEstimado = arredondarDinheiroRh(salarioBruto + fgtsEstimado + provisaoDecimoTerceiro + provisaoFerias + provisaoTercoFerias + beneficiosECustos);
  const baseRecorrente = salarioBruto + fgtsEstimado + provisaoDecimoTerceiro + provisaoFerias + provisaoTercoFerias;
  const outrosCustosAnuais = entrada.custos
    .filter((custo) => custoVigenteNoMes(custo, entrada.referencia))
    .reduce((soma, custo) => soma + valorRegraCustoGerencial(custo, salarioBruto) * (custo.recorrente ? 12 : 1), 0);
  const custoAnualEstimado = arredondarDinheiroRh(baseRecorrente * 12 + outrosCustosAnuais);
  return { salarioBruto, inssEstimado, beneficiosDescontados, adiantamentosDescontados, totalDescontosGerenciais, salarioLiquidoEstimado, fgtsEstimado, provisaoDecimoTerceiro, provisaoFerias, provisaoTercoFerias, beneficiosECustos, custoMensalEstimado, custoAnualEstimado, detalhesOutrosCustos };
}

export function somarCustosEquipeGerencialRh(entradas: ComposicaoCustoColaboradorRh[], custosEquipe: RegraCustoGerencialRh[], referencia: Date) {
  const base = entradas.reduce((total, item) => ({
    colaboradoresAtivos: total.colaboradoresAtivos + 1,
    salariosBrutos: total.salariosBrutos + item.salarioBruto,
    inssEstimado: total.inssEstimado + item.inssEstimado,
    beneficiosDescontados: total.beneficiosDescontados + item.beneficiosDescontados,
    adiantamentosDescontados: total.adiantamentosDescontados + item.adiantamentosDescontados,
    totalDescontosGerenciais: total.totalDescontosGerenciais + item.totalDescontosGerenciais,
    salariosLiquidosEstimados: total.salariosLiquidosEstimados + item.salarioLiquidoEstimado,
    fgtsEstimado: total.fgtsEstimado + item.fgtsEstimado,
    provisaoDecimoTerceiro: total.provisaoDecimoTerceiro + item.provisaoDecimoTerceiro,
    provisaoFerias: total.provisaoFerias + item.provisaoFerias,
    provisaoTercoFerias: total.provisaoTercoFerias + item.provisaoTercoFerias,
    outrosCustos: total.outrosCustos + item.beneficiosECustos,
    custoMensalEstimado: total.custoMensalEstimado + item.custoMensalEstimado,
    custoAnualEstimado: total.custoAnualEstimado + item.custoAnualEstimado,
  }), { colaboradoresAtivos: 0, salariosBrutos: 0, inssEstimado: 0, beneficiosDescontados: 0, adiantamentosDescontados: 0, totalDescontosGerenciais: 0, salariosLiquidosEstimados: 0, fgtsEstimado: 0, provisaoDecimoTerceiro: 0, provisaoFerias: 0, provisaoTercoFerias: 0, outrosCustos: 0, custoMensalEstimado: 0, custoAnualEstimado: 0 });

  const totalEquipe = custosEquipe.filter((custo) => custoVigenteNoMes(custo, referencia)).reduce((soma, custo) => soma + valorRegraCustoGerencial(custo, base.salariosBrutos), 0);
  const anualEquipe = custosEquipe.filter((custo) => custoVigenteNoMes(custo, referencia)).reduce((soma, custo) => soma + valorRegraCustoGerencial(custo, base.salariosBrutos) * (custo.recorrente ? 12 : 1), 0);
  return {
    ...Object.fromEntries(Object.entries(base).map(([chave, valor]) => [chave, chave === "colaboradoresAtivos" ? valor : arredondarDinheiroRh(valor as number)])),
    outrosCustosEquipe: arredondarDinheiroRh(totalEquipe),
    outrosCustos: arredondarDinheiroRh(base.outrosCustos + totalEquipe),
    custoMensalEstimado: arredondarDinheiroRh(base.custoMensalEstimado + totalEquipe),
    custoAnualEstimado: arredondarDinheiroRh(base.custoAnualEstimado + anualEquipe),
  } as typeof base & { outrosCustosEquipe: number };
}
