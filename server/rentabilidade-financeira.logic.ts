export type TipoCentroRentabilidade = "industrial" | "comercial_administrativo" | "nao_apropriavel";

export type ComponenteRentabilidadeFinanceira = {
  chave: string;
  origem: string;
  centroCustoId: number;
  centroNome: string;
  centroTipo: TipoCentroRentabilidade;
  categoriaId: number | null;
  categoriaNome: string;
  descricao: string;
  valor: number | string;
};

export type ReferenciaPrecoEssencia = {
  essencia: string;
  volumeBase: number | string;
  valorMetroCubico: number | string;
  fretePorMetroCubico: number | string;
};

export type ProducaoParaCusteioMateriaPrima = {
  id: number;
  numero: string;
  dataProducao: Date;
  volumePecas: number | string;
  volumeAproveitamento: number | string;
  incluirAproveitamento: boolean;
};

export type VolumeProduzidoPorEssencia = {
  producaoId: number;
  essencia: string;
  volumePecas: number | string;
  volumeAproveitamento?: number | string;
};

export type ToraConsumidaParaCusteioMateriaPrima = {
  producaoId: number;
  plaquetaId: number;
  plaquetaCodigo: string;
  essencia: string;
  volume: number | string;
  romaneioCargaId: number | null;
  valorMetroCubico: number | string | null;
  fretePorMetroCubico: number | string | null;
  numeroRomaneioCarga: string | null;
};

type SituacaoCustoTora = "rastreavel" | "estimado_por_essencia" | "sem_referencia";

type DetalheToraMateriaPrima = {
  plaquetaId: number;
  plaquetaCodigo: string;
  essencia: string;
  volumeM3: number;
  situacao: SituacaoCustoTora;
  romaneioCargaNumero: string | null;
  valorMetroCubico: number | null;
  fretePorMetroCubico: number | null;
  custoTora: number;
  freteEntrada: number;
  custoEstimado: number;
  referenciaEssencia: { valorMetroCubicoMedio: number; fretePorMetroCubicoMedio: number; quantidadePlaquetas: number; volumeBaseM3: number } | null;
  motivoCustoIndisponivel: string | null;
};

export type ResumoMateriaPrimaRentabilidade = {
  totalTorasConsumidas: number;
  volumeTorasConsumidasM3: number;
  volumeRastreavelM3: number;
  volumeEstimadoM3: number;
  volumeSemReferenciaM3: number;
  coberturaRastreavelPercentual: number;
  coberturaComEstimativaPercentual: number;
  custoTorasRastreavel: number;
  freteEntradaRastreavel: number;
  custoTorasEstimado: number;
  freteEntradaEstimado: number;
  custoTotalConhecido: number;
  custoTotalComEstimativa: number;
  custoTotalReal: number;
  custoTotalReferencia: number;
  periodoReferencia: { inicio: Date; fimExclusivo: Date } | null;
  producoes: Array<{
    id: number;
    numero: string;
    dataProducao: Date;
    totalToras: number;
    volumeTorasConsumidasM3: number;
    volumePecasM3: number;
    volumeAproveitamentoM3: number;
    volumeElegivelM3: number;
    volumeRastreavelM3: number;
    volumeEstimadoM3: number;
    volumeSemReferenciaM3: number;
    coberturaRastreavelPercentual: number;
    coberturaComEstimativaPercentual: number;
    custoTorasRastreavel: number;
    freteEntradaRastreavel: number;
    custoTorasEstimado: number;
    freteEntradaEstimado: number;
    custoTotalReal: number;
    custoTotalComEstimativa: number;
    custoRealPorM3: number | null;
    custoPorM3: number | null;
    porEssencia: ResumoEssenciaMateriaPrimaRentabilidade[];
    toras: DetalheToraMateriaPrima[];
  }>;
  referenciasPorEssencia: Array<{
    essencia: string;
    valorMetroCubicoMedio: number;
    fretePorMetroCubicoMedio: number;
    quantidadePlaquetas: number;
    volumeBaseM3: number;
  }>;
  porEssencia: Array<{
    essencia: string;
    volumePecasM3: number;
    volumeAproveitamentoM3: number;
    volumeElegivelM3: number;
    totalToras: number;
    volumeTorasConsumidasM3: number;
    volumeRastreavelM3: number;
    volumeEstimadoM3: number;
    volumeSemReferenciaM3: number;
    coberturaRastreavelPercentual: number;
    coberturaComEstimativaPercentual: number;
    custoTorasRastreavel: number;
    freteEntradaRastreavel: number;
    custoTorasEstimado: number;
    freteEntradaEstimado: number;
    custoTotalReal: number;
    custoTotalComEstimativa: number;
    custoRealPorM3: number | null;
    custoPorM3: number | null;
  }>;
  torasSemReferencia: DetalheToraMateriaPrima[];
};

export type ResumoEssenciaMateriaPrimaRentabilidade = {
  essencia: string;
  volumePecasM3: number;
  volumeAproveitamentoM3: number;
  volumeElegivelM3: number;
  totalToras: number;
  volumeTorasConsumidasM3: number;
  volumeRastreavelM3: number;
  volumeEstimadoM3: number;
  volumeSemReferenciaM3: number;
  coberturaRastreavelPercentual: number;
  coberturaComEstimativaPercentual: number;
  custoTorasRastreavel: number;
  freteEntradaRastreavel: number;
  custoTorasEstimado: number;
  freteEntradaEstimado: number;
  custoTotalReal: number;
  custoTotalComEstimativa: number;
  custoRealPorM3: number | null;
  custoPorM3: number | null;
};

type AcumuladoEssenciaMateriaPrima = Omit<ResumoEssenciaMateriaPrimaRentabilidade,
  "volumeElegivelM3" | "coberturaRastreavelPercentual" | "coberturaComEstimativaPercentual" |
  "custoTotalReal" | "custoTotalComEstimativa" | "custoRealPorM3" | "custoPorM3">;

const numero = (valor: number | string | null | undefined) => {
  const convertido = Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
};

const normalizarEssencia = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

const criarAcumuladoEssencia = (essencia: string): AcumuladoEssenciaMateriaPrima => ({
  essencia,
  volumePecasM3: 0,
  volumeAproveitamentoM3: 0,
  totalToras: 0,
  volumeTorasConsumidasM3: 0,
  volumeRastreavelM3: 0,
  volumeEstimadoM3: 0,
  volumeSemReferenciaM3: 0,
  custoTorasRastreavel: 0,
  freteEntradaRastreavel: 0,
  custoTorasEstimado: 0,
  freteEntradaEstimado: 0,
});

const obterAcumuladoEssencia = (mapa: Map<string, AcumuladoEssenciaMateriaPrima>, essencia: string) => {
  const nome = essencia.trim() || "Essência não informada";
  const chave = normalizarEssencia(nome) || "essencia-nao-informada";
  const atual = mapa.get(chave) ?? criarAcumuladoEssencia(nome);
  mapa.set(chave, atual);
  return atual;
};

const resumirAcumuladoEssencia = (item: AcumuladoEssenciaMateriaPrima): ResumoEssenciaMateriaPrimaRentabilidade => {
  const volumeElegivelM3 = item.volumePecasM3 + item.volumeAproveitamentoM3;
  const custoTotalReal = item.custoTorasRastreavel + item.freteEntradaRastreavel;
  const custoTotalComEstimativa = custoTotalReal + item.custoTorasEstimado + item.freteEntradaEstimado;
  return {
    ...item,
    volumeElegivelM3,
    coberturaRastreavelPercentual: item.volumeTorasConsumidasM3 > 0 ? (item.volumeRastreavelM3 / item.volumeTorasConsumidasM3) * 100 : 0,
    coberturaComEstimativaPercentual: item.volumeTorasConsumidasM3 > 0 ? ((item.volumeRastreavelM3 + item.volumeEstimadoM3) / item.volumeTorasConsumidasM3) * 100 : 0,
    custoTotalReal,
    custoTotalComEstimativa,
    custoRealPorM3: volumeElegivelM3 > 0 ? custoTotalReal / volumeElegivelM3 : null,
    custoPorM3: volumeElegivelM3 > 0 ? custoTotalComEstimativa / volumeElegivelM3 : null,
  };
};

/**
 * Calcula o custo da matéria-prima pelo consumo físico. O custo real da tora e
 * do frete de entrada tem prioridade. Na ausência de custo identificável, usa
 * apenas uma referência ponderada da mesma essência (valor e frete por m³).
 * Sem referência comparável, o custo permanece indisponível e não é inventado.
 */
export function calcularCusteioMateriaPrima(input: {
  producoes: ProducaoParaCusteioMateriaPrima[];
  torasConsumidas: ToraConsumidaParaCusteioMateriaPrima[];
  referenciasPrecoPorEssencia: ReferenciaPrecoEssencia[];
  volumesProduzidosPorEssencia?: VolumeProduzidoPorEssencia[];
  periodoReferencia?: { inicio: Date; fimExclusivo: Date } | null;
}): ResumoMateriaPrimaRentabilidade {
  const referencias = new Map<string, { essencia: string; valorTotalPonderado: number; freteTotalPonderado: number; volumeBaseM3: number; quantidadePlaquetas: number }>();
  for (const item of input.referenciasPrecoPorEssencia) {
    const volumeBaseM3 = numero(item.volumeBase);
    const valorMetroCubico = numero(item.valorMetroCubico);
    const fretePorMetroCubico = numero(item.fretePorMetroCubico);
    const chave = normalizarEssencia(item.essencia);
    if (!chave || volumeBaseM3 <= 0 || valorMetroCubico <= 0) continue;
    const atual = referencias.get(chave) ?? { essencia: item.essencia.trim(), valorTotalPonderado: 0, freteTotalPonderado: 0, volumeBaseM3: 0, quantidadePlaquetas: 0 };
    atual.valorTotalPonderado += volumeBaseM3 * valorMetroCubico;
    atual.freteTotalPonderado += volumeBaseM3 * fretePorMetroCubico;
    atual.volumeBaseM3 += volumeBaseM3;
    atual.quantidadePlaquetas += 1;
    referencias.set(chave, atual);
  }

  const porEssencia = new Map<string, AcumuladoEssenciaMateriaPrima>();
  const porEssenciaPorProducao = new Map<number, Map<string, AcumuladoEssenciaMateriaPrima>>();

  const producoes = new Map<number, {
    id: number;
    numero: string;
    dataProducao: Date;
    incluirAproveitamento: boolean;
    volumePecasM3: number;
    volumeAproveitamentoM3: number;
    volumeElegivelM3: number;
    totalToras: number;
    volumeTorasConsumidasM3: number;
    volumeRastreavelM3: number;
    volumeEstimadoM3: number;
    volumeSemReferenciaM3: number;
    custoTorasRastreavel: number;
    freteEntradaRastreavel: number;
    custoTorasEstimado: number;
    freteEntradaEstimado: number;
    toras: DetalheToraMateriaPrima[];
  }>();
  for (const item of input.producoes) {
    const volumePecasM3 = numero(item.volumePecas);
    const volumeAproveitamentoM3 = item.incluirAproveitamento ? numero(item.volumeAproveitamento) : 0;
    producoes.set(item.id, {
      id: item.id,
      numero: item.numero,
      dataProducao: item.dataProducao,
      incluirAproveitamento: item.incluirAproveitamento,
      volumePecasM3,
      volumeAproveitamentoM3,
      volumeElegivelM3: volumePecasM3 + volumeAproveitamentoM3,
      totalToras: 0,
      volumeTorasConsumidasM3: 0,
      volumeRastreavelM3: 0,
      volumeEstimadoM3: 0,
      volumeSemReferenciaM3: 0,
      custoTorasRastreavel: 0,
      freteEntradaRastreavel: 0,
      custoTorasEstimado: 0,
      freteEntradaEstimado: 0,
      toras: [],
    });
    porEssenciaPorProducao.set(item.id, new Map());
  }
  for (const item of input.volumesProduzidosPorEssencia ?? []) {
    const producao = producoes.get(item.producaoId);
    if (!producao) continue;
    const essenciaGeral = obterAcumuladoEssencia(porEssencia, item.essencia);
    const essenciaDaProducao = obterAcumuladoEssencia(porEssenciaPorProducao.get(item.producaoId)!, item.essencia);
    const volumePecas = numero(item.volumePecas);
    const volumeAproveitamento = producao.incluirAproveitamento ? numero(item.volumeAproveitamento) : 0;
    essenciaGeral.volumePecasM3 += volumePecas;
    essenciaGeral.volumeAproveitamentoM3 += volumeAproveitamento;
    essenciaDaProducao.volumePecasM3 += volumePecas;
    essenciaDaProducao.volumeAproveitamentoM3 += volumeAproveitamento;
  }

  const torasSemReferencia: DetalheToraMateriaPrima[] = [];
  for (const item of input.torasConsumidas) {
    const producao = producoes.get(item.producaoId);
    if (!producao) continue;
    const volumeM3 = numero(item.volume);
    if (volumeM3 <= 0) continue;
    const valorMetroCubico = numero(item.valorMetroCubico);
    const fretePorMetroCubico = numero(item.fretePorMetroCubico);
    const referencia = referencias.get(normalizarEssencia(item.essencia));
    const possuiCustoRastreavel = item.romaneioCargaId !== null && valorMetroCubico > 0;
    const referenciaEssencia = referencia && referencia.volumeBaseM3 > 0
      ? {
        valorMetroCubicoMedio: referencia.valorTotalPonderado / referencia.volumeBaseM3,
        fretePorMetroCubicoMedio: referencia.freteTotalPonderado / referencia.volumeBaseM3,
        quantidadePlaquetas: referencia.quantidadePlaquetas,
        volumeBaseM3: referencia.volumeBaseM3,
      }
      : null;

    const detalhe: DetalheToraMateriaPrima = {
      plaquetaId: item.plaquetaId,
      plaquetaCodigo: item.plaquetaCodigo,
      essencia: item.essencia,
      volumeM3,
      situacao: "sem_referencia",
      romaneioCargaNumero: item.numeroRomaneioCarga,
      valorMetroCubico: null,
      fretePorMetroCubico: null,
      custoTora: 0,
      freteEntrada: 0,
      custoEstimado: 0,
      referenciaEssencia,
      motivoCustoIndisponivel: null,
    };

    producao.totalToras += 1;
    producao.volumeTorasConsumidasM3 += volumeM3;
    const essencias = [
      obterAcumuladoEssencia(porEssencia, item.essencia),
      obterAcumuladoEssencia(porEssenciaPorProducao.get(item.producaoId)!, item.essencia),
    ];
    for (const essencia of essencias) {
      essencia.totalToras += 1;
      essencia.volumeTorasConsumidasM3 += volumeM3;
    }
    if (possuiCustoRastreavel) {
      detalhe.situacao = "rastreavel";
      detalhe.valorMetroCubico = valorMetroCubico;
      detalhe.fretePorMetroCubico = fretePorMetroCubico;
      detalhe.custoTora = volumeM3 * valorMetroCubico;
      detalhe.freteEntrada = volumeM3 * fretePorMetroCubico;
      producao.volumeRastreavelM3 += volumeM3;
      producao.custoTorasRastreavel += detalhe.custoTora;
      producao.freteEntradaRastreavel += detalhe.freteEntrada;
      for (const essencia of essencias) {
        essencia.volumeRastreavelM3 += volumeM3;
        essencia.custoTorasRastreavel += detalhe.custoTora;
        essencia.freteEntradaRastreavel += detalhe.freteEntrada;
      }
    } else if (referenciaEssencia) {
      detalhe.situacao = "estimado_por_essencia";
      detalhe.valorMetroCubico = referenciaEssencia.valorMetroCubicoMedio;
      detalhe.fretePorMetroCubico = referenciaEssencia.fretePorMetroCubicoMedio;
      detalhe.custoEstimado = volumeM3 * referenciaEssencia.valorMetroCubicoMedio;
      detalhe.freteEntrada = volumeM3 * referenciaEssencia.fretePorMetroCubicoMedio;
      producao.volumeEstimadoM3 += volumeM3;
      producao.custoTorasEstimado += detalhe.custoEstimado;
      producao.freteEntradaEstimado += detalhe.freteEntrada;
      for (const essencia of essencias) {
        essencia.volumeEstimadoM3 += volumeM3;
        essencia.custoTorasEstimado += detalhe.custoEstimado;
        essencia.freteEntradaEstimado += detalhe.freteEntrada;
      }
    } else {
      producao.volumeSemReferenciaM3 += volumeM3;
      for (const essencia of essencias) essencia.volumeSemReferenciaM3 += volumeM3;
      detalhe.motivoCustoIndisponivel = item.romaneioCargaId === null
        ? "Tora sem romaneio de entrada e sem referência da mesma essência."
        : "Romaneio de entrada sem custo identificável e sem referência da mesma essência.";
      torasSemReferencia.push(detalhe);
    }
    producao.toras.push(detalhe);
  }

  const producoesOrdenadas = Array.from(producoes.values()).map((item) => {
    const coberturaRastreavelPercentual = item.volumeTorasConsumidasM3 > 0 ? (item.volumeRastreavelM3 / item.volumeTorasConsumidasM3) * 100 : 0;
    const coberturaComEstimativaPercentual = item.volumeTorasConsumidasM3 > 0 ? ((item.volumeRastreavelM3 + item.volumeEstimadoM3) / item.volumeTorasConsumidasM3) * 100 : 0;
    const custoTotalReal = item.custoTorasRastreavel + item.freteEntradaRastreavel;
    const custoTotalComEstimativa = custoTotalReal + item.custoTorasEstimado + item.freteEntradaEstimado;
    return {
      ...item,
      coberturaRastreavelPercentual,
      coberturaComEstimativaPercentual,
      custoTotalReal,
      custoTotalComEstimativa,
      custoRealPorM3: item.volumeElegivelM3 > 0 ? custoTotalReal / item.volumeElegivelM3 : null,
      custoPorM3: item.volumeElegivelM3 > 0 ? custoTotalComEstimativa / item.volumeElegivelM3 : null,
      porEssencia: Array.from(porEssenciaPorProducao.get(item.id)?.values() ?? [])
        .map(resumirAcumuladoEssencia)
        .sort((a, b) => a.essencia.localeCompare(b.essencia, "pt-BR")),
    };
  }).sort((a, b) => b.dataProducao.getTime() - a.dataProducao.getTime() || a.numero.localeCompare(b.numero));

  const total = producoesOrdenadas.reduce((acumulado, item) => ({
    totalTorasConsumidas: acumulado.totalTorasConsumidas + item.totalToras,
    volumeTorasConsumidasM3: acumulado.volumeTorasConsumidasM3 + item.volumeTorasConsumidasM3,
    volumeRastreavelM3: acumulado.volumeRastreavelM3 + item.volumeRastreavelM3,
    volumeEstimadoM3: acumulado.volumeEstimadoM3 + item.volumeEstimadoM3,
    volumeSemReferenciaM3: acumulado.volumeSemReferenciaM3 + item.volumeSemReferenciaM3,
    custoTorasRastreavel: acumulado.custoTorasRastreavel + item.custoTorasRastreavel,
    freteEntradaRastreavel: acumulado.freteEntradaRastreavel + item.freteEntradaRastreavel,
    custoTorasEstimado: acumulado.custoTorasEstimado + item.custoTorasEstimado,
    freteEntradaEstimado: acumulado.freteEntradaEstimado + item.freteEntradaEstimado,
  }), { totalTorasConsumidas: 0, volumeTorasConsumidasM3: 0, volumeRastreavelM3: 0, volumeEstimadoM3: 0, volumeSemReferenciaM3: 0, custoTorasRastreavel: 0, freteEntradaRastreavel: 0, custoTorasEstimado: 0, freteEntradaEstimado: 0 });

  const custoTotalConhecido = total.custoTorasRastreavel + total.freteEntradaRastreavel;
  const custoTotalComEstimativa = custoTotalConhecido + total.custoTorasEstimado + total.freteEntradaEstimado;
  const resumoPorEssencia = Array.from(porEssencia.values())
    .map(resumirAcumuladoEssencia)
    .sort((a, b) => b.custoTotalComEstimativa - a.custoTotalComEstimativa || a.essencia.localeCompare(b.essencia, "pt-BR"));
  return {
    ...total,
    coberturaRastreavelPercentual: total.volumeTorasConsumidasM3 > 0 ? (total.volumeRastreavelM3 / total.volumeTorasConsumidasM3) * 100 : 0,
    coberturaComEstimativaPercentual: total.volumeTorasConsumidasM3 > 0 ? ((total.volumeRastreavelM3 + total.volumeEstimadoM3) / total.volumeTorasConsumidasM3) * 100 : 0,
    custoTotalConhecido,
    custoTotalComEstimativa,
    custoTotalReal: custoTotalConhecido,
    custoTotalReferencia: total.custoTorasEstimado + total.freteEntradaEstimado,
    periodoReferencia: input.periodoReferencia ?? null,
    producoes: producoesOrdenadas,
    referenciasPorEssencia: Array.from(referencias.values()).map((item) => ({
      essencia: item.essencia,
      valorMetroCubicoMedio: item.valorTotalPonderado / item.volumeBaseM3,
      fretePorMetroCubicoMedio: item.freteTotalPonderado / item.volumeBaseM3,
      quantidadePlaquetas: item.quantidadePlaquetas,
      volumeBaseM3: item.volumeBaseM3,
    })).sort((a, b) => a.essencia.localeCompare(b.essencia)),
    porEssencia: resumoPorEssencia,
    torasSemReferencia,
  };
}

export function consolidarRentabilidadeFinanceira(input: {
  componentes: ComponenteRentabilidadeFinanceira[];
  volumeProprioM3: number | string;
  materiaPrima: ResumoMateriaPrimaRentabilidade;
  titulosSemCentro: { quantidade: number; valor: number | string };
  titulosSemCompetencia: { quantidade: number; valor: number | string };
  titulosExcluidosPorOrigem: { quantidade: number; valor: number | string };
  titulosRomaneioCargaExcluidos: { quantidade: number; valor: number | string };
}) {
  /** A proteção também é aplicada na lógica pura: título de romaneio nunca é matéria-prima adicional. */
  const componentes = input.componentes
    .filter((item) => item.centroTipo !== "nao_apropriavel" && item.origem !== "romaneio_carga")
    .map((item) => ({ ...item, valor: numero(item.valor) }));
  const porCentro = new Map<number, { id: number; nome: string; tipo: TipoCentroRentabilidade; total: number; quantidade: number }>();
  const porCategoria = new Map<string, { chave: string; centroNome: string; centroTipo: TipoCentroRentabilidade; categoriaNome: string; total: number; quantidade: number }>();

  for (const componente of componentes) {
    const centro = porCentro.get(componente.centroCustoId) ?? { id: componente.centroCustoId, nome: componente.centroNome, tipo: componente.centroTipo, total: 0, quantidade: 0 };
    centro.total += componente.valor;
    centro.quantidade += 1;
    porCentro.set(componente.centroCustoId, centro);
    const chave = `${componente.centroCustoId}:${componente.categoriaId ?? "sem_categoria"}`;
    const categoria = porCategoria.get(chave) ?? { chave, centroNome: componente.centroNome, centroTipo: componente.centroTipo, categoriaNome: componente.categoriaNome, total: 0, quantidade: 0 };
    categoria.total += componente.valor;
    categoria.quantidade += 1;
    porCategoria.set(chave, categoria);
  }

  const industrialSemMateriaPrima = componentes.filter((item) => item.centroTipo === "industrial").reduce((total, item) => total + item.valor, 0);
  const comercialAdministrativo = componentes.filter((item) => item.centroTipo === "comercial_administrativo").reduce((total, item) => total + item.valor, 0);
  const volumeProprioM3 = numero(input.volumeProprioM3);
  const custoIndustrialComMateriaPrima = industrialSemMateriaPrima + input.materiaPrima.custoTotalComEstimativa;
  const custoTotalApropriado = custoIndustrialComMateriaPrima + comercialAdministrativo;

  return {
    indicadores: {
      custosIndustriais: industrialSemMateriaPrima,
      custosComerciaisAdministrativos: comercialAdministrativo,
      custosMateriaPrima: input.materiaPrima.custoTotalComEstimativa,
      custosMateriaPrimaRastreaveis: input.materiaPrima.custoTotalConhecido,
      custosMateriaPrimaEstimados: input.materiaPrima.custoTorasEstimado,
      custosMateriaPrimaReferenciados: input.materiaPrima.custoTotalReferencia,
      custoIndustrialComMateriaPrima,
      custoTotalApropriado,
      volumeProprioM3,
      custosMateriaPrimaPorM3: volumeProprioM3 > 0 ? input.materiaPrima.custoTotalComEstimativa / volumeProprioM3 : null,
      custosIndustriaisPorM3: volumeProprioM3 > 0 ? industrialSemMateriaPrima / volumeProprioM3 : null,
      custosComerciaisAdministrativosPorM3: volumeProprioM3 > 0 ? comercialAdministrativo / volumeProprioM3 : null,
      custoIndustrialPorM3: volumeProprioM3 > 0 ? custoIndustrialComMateriaPrima / volumeProprioM3 : null,
      custoCompletoPorM3: volumeProprioM3 > 0 ? custoTotalApropriado / volumeProprioM3 : null,
      custoTotalPorM3: volumeProprioM3 > 0 ? custoTotalApropriado / volumeProprioM3 : null,
    },
    materiaPrima: input.materiaPrima,
    porCentro: Array.from(porCentro.values()).sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome)),
    porCategoria: Array.from(porCategoria.values()).sort((a, b) => b.total - a.total || a.categoriaNome.localeCompare(b.categoriaNome)),
    componentes: componentes.sort((a, b) => b.valor - a.valor || a.descricao.localeCompare(b.descricao)),
    qualidadeDados: {
      titulosSemCentro: { quantidade: input.titulosSemCentro.quantidade, valor: numero(input.titulosSemCentro.valor) },
      titulosSemCompetencia: { quantidade: input.titulosSemCompetencia.quantidade, valor: numero(input.titulosSemCompetencia.valor) },
      titulosExcluidosPorOrigem: { quantidade: input.titulosExcluidosPorOrigem.quantidade, valor: numero(input.titulosExcluidosPorOrigem.valor) },
      titulosRomaneioCargaExcluidos: { quantidade: input.titulosRomaneioCargaExcluidos.quantidade, valor: numero(input.titulosRomaneioCargaExcluidos.valor) },
    },
  };
}
