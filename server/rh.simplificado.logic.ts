export type ColaboradorRhSimplificado = {
  id: number;
  nome: string;
  salarioAtual: string | number;
  situacao: "ativo" | "afastado" | "desligado";
  cargoNome?: string | null;
  departamentoNome?: string | null;
};

export type AdiantamentoRhSimplificado = {
  id: number;
  colaboradorId: number;
  competencia: Date;
  dataAdiantamento: Date;
  valor: string | number;
  estado: "aberto" | "descontado" | "cancelado";
  observacoes?: string | null;
};

export function valorRhSimplificado(valor: string | number | null | undefined) {
  return Number(valor ?? 0);
}

export function chaveCompetenciaRhSimplificado(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

export function calcularResumoRhSimplificado(params: {
  competencia: Date;
  colaboradores: ColaboradorRhSimplificado[];
  adiantamentos: AdiantamentoRhSimplificado[];
}) {
  const referencia = chaveCompetenciaRhSimplificado(params.competencia);
  const adiantadoPorColaborador = new Map<number, number>();

  for (const adiantamento of params.adiantamentos) {
    if (adiantamento.estado === "cancelado" || chaveCompetenciaRhSimplificado(adiantamento.competencia) !== referencia) continue;
    adiantadoPorColaborador.set(
      adiantamento.colaboradorId,
      (adiantadoPorColaborador.get(adiantamento.colaboradorId) ?? 0) + valorRhSimplificado(adiantamento.valor),
    );
  }

  const linhas = params.colaboradores
    .filter((colaborador) => colaborador.situacao === "ativo")
    .map((colaborador) => {
      const salario = valorRhSimplificado(colaborador.salarioAtual);
      const adiantado = adiantadoPorColaborador.get(colaborador.id) ?? 0;
      return {
        ...colaborador,
        salario,
        adiantado,
        saldoPagar: Math.round((salario - adiantado) * 100) / 100,
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const totais = linhas.reduce(
    (acumulado, linha) => ({
      funcionariosAtivos: acumulado.funcionariosAtivos + 1,
      salarios: acumulado.salarios + linha.salario,
      adiantamentos: acumulado.adiantamentos + linha.adiantado,
      saldoPagar: acumulado.saldoPagar + linha.saldoPagar,
    }),
    { funcionariosAtivos: 0, salarios: 0, adiantamentos: 0, saldoPagar: 0 },
  );

  return {
    linhas,
    totais: {
      ...totais,
      salarios: Math.round(totais.salarios * 100) / 100,
      adiantamentos: Math.round(totais.adiantamentos * 100) / 100,
      saldoPagar: Math.round(totais.saldoPagar * 100) / 100,
    },
  };
}

export function validarLimiteAdiantamentoRhSimplificado(params: {
  salario: string | number;
  totalExistente: number;
  valorNovo: string | number;
}) {
  const salario = valorRhSimplificado(params.salario);
  const totalProjetado = Math.round((params.totalExistente + valorRhSimplificado(params.valorNovo)) * 100) / 100;
  return { salario, totalProjetado, excede: totalProjetado > salario };
}

export function validarFechamentoRhSimplificado(linhas: Array<{ id: number; saldoPagar: number }>) {
  const saldosNegativos = linhas.filter((linha) => linha.saldoPagar < 0).map((linha) => linha.id);
  return {
    saldosNegativos,
    bloqueado: saldosNegativos.length > 0,
    titulosNecessarios: linhas.filter((linha) => linha.saldoPagar > 0).map((linha) => linha.id),
  };
}
