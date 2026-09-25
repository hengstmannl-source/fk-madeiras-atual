export type TipoEventoFolhaRh = "provento" | "desconto" | "informativo";

export type FaixaTributariaRhCalculo = {
  limiteInferior: number;
  limiteSuperior: number | null;
  aliquota: number;
  parcelaDeduzir: number;
};

export type RegraReducaoIrrfRhCalculo = {
  tipo: "zera_imposto" | "formula_linear";
  limiteInferior: number;
  limiteSuperior: number | null;
  valorMaximo: number;
  constante: number;
  coeficiente: number;
  ordem: number;
};

export type EventoCalculoFolhaRh = {
  descricao: string;
  tipo: TipoEventoFolhaRh;
  valor: number;
  incideInss?: boolean;
  incideIrrf?: boolean;
  deduzIrrf?: boolean;
  incideFgts?: boolean;
  eventoId?: number;
};

export type RegrasCalculoFolhaRh = {
  faixasInss: FaixaTributariaRhCalculo[];
  faixasIrrf: FaixaTributariaRhCalculo[];
  aliquotaFgts: number;
  deducaoDependenteIrrf: number;
  descontoSimplificadoIrrf?: number;
  regrasReducaoIrrf?: RegraReducaoIrrfRhCalculo[];
  tabelaIrrfId?: number | null;
  tabelaIrrfNome?: string | null;
  vigenciaIrrf?: string | null;
};

export type EntradaCalculoFolhaRh = {
  salarioBase: number;
  quantidadeDependentesIrrf: number;
  adiantamentos: number;
  eventos: EventoCalculoFolhaRh[];
  regras: RegrasCalculoFolhaRh;
};

export type MemoriaCalculoIrrfRh = {
  rendimentosTributaveis: number;
  inssDedutivel: number;
  quantidadeDependentes: number;
  deducaoDependentes: number;
  outrasDeducoes: number;
  deducoesLegais: number;
  descontoSimplificado: number;
  metodoDeducao: "legal" | "simplificado" | "nenhum";
  deducaoUtilizada: number;
  baseCalculo: number;
  aliquota: number;
  parcelaDeduzir: number;
  irrfProgressivo: number;
  reducaoIrrf: number;
  irrfFinal: number;
  tabelaIrrfId: number | null;
  tabelaIrrfNome: string | null;
  vigenciaIrrf: string | null;
};

export function arredondarDinheiroRh(valor: number) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function faixaAplicavel(base: number, faixas: FaixaTributariaRhCalculo[]) {
  return [...faixas]
    .sort((a, b) => a.limiteInferior - b.limiteInferior)
    .find((item) => base >= item.limiteInferior && (item.limiteSuperior === null || base <= item.limiteSuperior)) ?? null;
}

/** Calcula um imposto progressivo por faixa usando a fórmula: base × alíquota - parcela a deduzir. */
export function calcularIRRFProgressivo(base: number, faixas: FaixaTributariaRhCalculo[]) {
  if (!Number.isFinite(base) || base <= 0) return 0;
  const faixa = faixaAplicavel(base, faixas);
  if (!faixa) return 0;
  return arredondarDinheiroRh(Math.max(0, base * (faixa.aliquota / 100) - faixa.parcelaDeduzir));
}

/** Mantido como alias para preservar os cálculos progressivos já usados por INSS e demais módulos. */
export const calcularImpostoProgressivoRh = calcularIRRFProgressivo;

export function calcularBaseIRRF(entrada: {
  rendimentosTributaveis: number;
  inssDedutivel: number;
  quantidadeDependentes: number;
  deducaoDependente: number;
  outrasDeducoes?: number;
  descontoSimplificado?: number;
}) {
  const rendimentosTributaveis = Math.max(0, Number(entrada.rendimentosTributaveis) || 0);
  const inssDedutivel = Math.max(0, Number(entrada.inssDedutivel) || 0);
  const quantidadeDependentes = Math.max(0, Math.floor(Number(entrada.quantidadeDependentes) || 0));
  const deducaoDependentes = arredondarDinheiroRh(quantidadeDependentes * Math.max(0, Number(entrada.deducaoDependente) || 0));
  const outrasDeducoes = Math.max(0, Number(entrada.outrasDeducoes) || 0);
  const deducoesLegais = arredondarDinheiroRh(inssDedutivel + deducaoDependentes + outrasDeducoes);
  const descontoSimplificado = Math.max(0, Number(entrada.descontoSimplificado) || 0);
  const metodoDeducao: "legal" | "simplificado" | "nenhum" = descontoSimplificado > deducoesLegais && descontoSimplificado > 0
    ? "simplificado"
    : deducoesLegais > 0 ? "legal" : "nenhum";
  const deducaoUtilizada = metodoDeducao === "simplificado" ? descontoSimplificado : metodoDeducao === "legal" ? deducoesLegais : 0;

  return {
    rendimentosTributaveis: arredondarDinheiroRh(rendimentosTributaveis),
    inssDedutivel: arredondarDinheiroRh(inssDedutivel),
    quantidadeDependentes,
    deducaoDependentes,
    outrasDeducoes: arredondarDinheiroRh(outrasDeducoes),
    deducoesLegais,
    descontoSimplificado: arredondarDinheiroRh(descontoSimplificado),
    metodoDeducao,
    deducaoUtilizada: arredondarDinheiroRh(deducaoUtilizada),
    baseCalculo: arredondarDinheiroRh(Math.max(0, rendimentosTributaveis - deducaoUtilizada)),
  };
}

/** Aplica regras de redução sobre o imposto progressivo, usando rendimento tributável — não a base já deduzida. */
export function calcularReducaoIRRF2026(rendimentoTributavel: number, irrfProgressivo: number, regras: RegraReducaoIrrfRhCalculo[] = []) {
  if (!Number.isFinite(rendimentoTributavel) || !Number.isFinite(irrfProgressivo) || rendimentoTributavel <= 0 || irrfProgressivo <= 0) return 0;
  const regra = [...regras]
    .sort((a, b) => a.ordem - b.ordem)
    .find((item) => rendimentoTributavel >= item.limiteInferior && (item.limiteSuperior === null || rendimentoTributavel <= item.limiteSuperior));
  if (!regra) return 0;
  const reducaoBruta = regra.tipo === "zera_imposto"
    ? (regra.valorMaximo > 0 ? regra.valorMaximo : irrfProgressivo)
    : regra.constante - regra.coeficiente * rendimentoTributavel;
  return arredondarDinheiroRh(Math.min(irrfProgressivo, Math.max(0, reducaoBruta)));
}

export function calcularIRRFFinal(entrada: {
  baseCalculo: number;
  rendimentoTributavel: number;
  faixas: FaixaTributariaRhCalculo[];
  regrasReducao?: RegraReducaoIrrfRhCalculo[];
}) {
  const irrfProgressivo = calcularIRRFProgressivo(entrada.baseCalculo, entrada.faixas);
  const reducaoIrrf = calcularReducaoIRRF2026(entrada.rendimentoTributavel, irrfProgressivo, entrada.regrasReducao);
  return {
    irrfProgressivo,
    reducaoIrrf,
    irrfFinal: arredondarDinheiroRh(Math.max(0, irrfProgressivo - reducaoIrrf)),
  };
}

export function validarRegrasFolhaRh(regras: RegrasCalculoFolhaRh) {
  if (!Number.isFinite(regras.aliquotaFgts) || regras.aliquotaFgts < 0) throw new Error("A alíquota de FGTS deve ser um valor não negativo");
  if (!Number.isFinite(regras.deducaoDependenteIrrf) || regras.deducaoDependenteIrrf < 0) throw new Error("A dedução por dependente deve ser um valor não negativo");
  if (!Number.isFinite(regras.descontoSimplificadoIrrf ?? 0) || (regras.descontoSimplificadoIrrf ?? 0) < 0) throw new Error("O desconto simplificado deve ser um valor não negativo");
  for (const grupo of [regras.faixasInss, regras.faixasIrrf]) {
    for (const faixa of grupo) {
      if (faixa.limiteInferior < 0 || faixa.aliquota < 0 || faixa.parcelaDeduzir < 0) throw new Error("As faixas tributárias devem possuir valores não negativos");
      if (faixa.limiteSuperior !== null && faixa.limiteSuperior < faixa.limiteInferior) throw new Error("O limite superior da faixa não pode ser menor que o limite inferior");
    }
  }
  for (const regra of regras.regrasReducaoIrrf ?? []) {
    if (regra.limiteInferior < 0 || regra.valorMaximo < 0 || regra.constante < 0 || regra.coeficiente < 0) throw new Error("As regras de redução do IRRF devem possuir valores não negativos");
    if (regra.limiteSuperior !== null && regra.limiteSuperior < regra.limiteInferior) throw new Error("O limite superior da redução não pode ser menor que o limite inferior");
  }
}

export function calcularFolhaColaboradorRh(entrada: EntradaCalculoFolhaRh) {
  if (!Number.isFinite(entrada.salarioBase) || entrada.salarioBase < 0) throw new Error("O salário-base deve ser um valor não negativo");
  if (!Number.isFinite(entrada.adiantamentos) || entrada.adiantamentos < 0) throw new Error("Os adiantamentos devem ser um valor não negativo");
  validarRegrasFolhaRh(entrada.regras);

  const eventos = entrada.eventos.map((evento) => {
    if (!evento.descricao.trim()) throw new Error("Todo evento da folha deve ter descrição");
    if (!Number.isFinite(evento.valor) || evento.valor < 0) throw new Error("O valor de cada evento deve ser não negativo");
    return { ...evento, valor: arredondarDinheiroRh(evento.valor) };
  });
  const proventosExtras = eventos.filter((evento) => evento.tipo === "provento").reduce((soma, evento) => soma + evento.valor, 0);
  const descontosEventos = eventos.filter((evento) => evento.tipo === "desconto").reduce((soma, evento) => soma + evento.valor, 0);
  const baseInss = entrada.salarioBase + eventos.filter((evento) => evento.tipo === "provento" && evento.incideInss).reduce((soma, evento) => soma + evento.valor, 0);
  const inss = calcularImpostoProgressivoRh(baseInss, entrada.regras.faixasInss);
  const rendimentosTributaveis = entrada.salarioBase + eventos.filter((evento) => evento.tipo === "provento" && evento.incideIrrf).reduce((soma, evento) => soma + evento.valor, 0);
  const outrasDeducoes = eventos.filter((evento) => evento.tipo === "desconto" && evento.deduzIrrf).reduce((soma, evento) => soma + evento.valor, 0);
  const baseIrrf = calcularBaseIRRF({
    rendimentosTributaveis,
    inssDedutivel: inss,
    quantidadeDependentes: entrada.quantidadeDependentesIrrf,
    deducaoDependente: entrada.regras.deducaoDependenteIrrf,
    outrasDeducoes,
    descontoSimplificado: entrada.regras.descontoSimplificadoIrrf,
  });
  const irrfCalculado = calcularIRRFFinal({
    baseCalculo: baseIrrf.baseCalculo,
    rendimentoTributavel: rendimentosTributaveis,
    faixas: entrada.regras.faixasIrrf,
    regrasReducao: entrada.regras.regrasReducaoIrrf,
  });
  const faixaIrrf = faixaAplicavel(baseIrrf.baseCalculo, entrada.regras.faixasIrrf);
  const memoriaIrrf: MemoriaCalculoIrrfRh = {
    ...baseIrrf,
    aliquota: faixaIrrf?.aliquota ?? 0,
    parcelaDeduzir: faixaIrrf?.parcelaDeduzir ?? 0,
    irrfProgressivo: irrfCalculado.irrfProgressivo,
    reducaoIrrf: irrfCalculado.reducaoIrrf,
    irrfFinal: irrfCalculado.irrfFinal,
    tabelaIrrfId: entrada.regras.tabelaIrrfId ?? null,
    tabelaIrrfNome: entrada.regras.tabelaIrrfNome ?? null,
    vigenciaIrrf: entrada.regras.vigenciaIrrf ?? null,
  };
  const baseFgts = entrada.salarioBase + eventos.filter((evento) => evento.tipo === "provento" && evento.incideFgts).reduce((soma, evento) => soma + evento.valor, 0);
  const fgts = arredondarDinheiroRh(baseFgts * (entrada.regras.aliquotaFgts / 100));
  const totalProventos = arredondarDinheiroRh(entrada.salarioBase + proventosExtras);
  const totalDescontos = arredondarDinheiroRh(inss + irrfCalculado.irrfFinal + entrada.adiantamentos + descontosEventos);
  const salarioLiquido = arredondarDinheiroRh(Math.max(0, totalProventos - totalDescontos));

  return {
    salarioBase: arredondarDinheiroRh(entrada.salarioBase),
    totalProventos,
    baseInss: arredondarDinheiroRh(baseInss),
    inss,
    baseIrrf: baseIrrf.baseCalculo,
    irrf: irrfCalculado.irrfFinal,
    deducoesLegaisIrrf: baseIrrf.deducoesLegais,
    descontoSimplificadoIrrf: baseIrrf.descontoSimplificado,
    metodoDeducaoIrrf: baseIrrf.metodoDeducao,
    tabelaIrrfId: memoriaIrrf.tabelaIrrfId,
    memoriaIrrf,
    adiantamentos: arredondarDinheiroRh(entrada.adiantamentos),
    outrosDescontos: arredondarDinheiroRh(descontosEventos),
    totalDescontos,
    salarioLiquido,
    fgts,
    custoEmpresa: arredondarDinheiroRh(totalProventos + fgts),
    eventos,
  };
}

export function podeEditarFolhaRh(estado: "aberta" | "fechada") { return estado === "aberta"; }

export function competenciaRh(data: Date) { return new Date(data.getFullYear(), data.getMonth(), 1, 12, 0, 0, 0); }

export type VinculosRemocaoColaboradorRh = { dependentes: boolean; alteracoesSalariais: boolean; adiantamentos: boolean; itensFolha: boolean; };

export function motivoBloqueioRemocaoColaboradorRh(vinculos: VinculosRemocaoColaboradorRh, situacao: "ativo" | "afastado" | "desligado" = "ativo") {
  const encontrados = situacao === "desligado"
    ? [vinculos.adiantamentos ? "adiantamentos" : null, vinculos.itensFolha ? "lançamentos de folha" : null]
    : [vinculos.dependentes ? "dependentes" : null, vinculos.alteracoesSalariais ? "alterações salariais" : null, vinculos.adiantamentos ? "adiantamentos" : null, vinculos.itensFolha ? "lançamentos de folha" : null];
  const bloqueios = encontrados.filter((item): item is string => Boolean(item));
  if (!bloqueios.length) return null;
  return situacao === "desligado"
    ? `Este colaborador inativo não pode ser removido porque possui movimentações financeiras vinculadas: ${bloqueios.join(", ")}.`
    : `Este colaborador não pode ser removido porque possui ${bloqueios.join(", ")}. Preserve o histórico ou registre o desligamento.`;
}
