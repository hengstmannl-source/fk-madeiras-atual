export type SituacaoCoberturaRentabilidadeVenda = "completa" | "parcial" | "indisponivel";
export type OrigemCustoMateriaPrimaVenda = "rastreavel" | "estimado_por_essencia" | "indisponivel";

export type ReferenciaCustoHistoricoVenda = {
  essencia: string;
  volumeBaseM3: number;
  competenciasComDados: number;
  custoMateriaPrimaPorM3: number;
  valorToraPorM3: number;
  freteEntradaPorM3: number;
  custoIndustrialPorM3: number | null;
  custoComercialAdministrativoPorM3: number | null;
};

export type ObservacaoValorToraRomaneio = {
  essencia: string;
  volumeBaseM3: number | string | null | undefined;
  valorMetroCubico: number | string | null | undefined;
  fretePorMetroCubico?: number | string | null | undefined;
};

export type ObservacaoReferenciaCustoHistoricoVenda = {
  competencia: string;
  essencia: string;
  volumeProduzidoM3: number | string | null | undefined;
  custoMateriaPrima: number | string | null | undefined;
  custoIndustrialPorM3: number | string | null | undefined;
  custoComercialAdministrativoPorM3: number | string | null | undefined;
};

export type LoteVendidoParaRentabilidade = {
  loteId: number | null;
  itemVendaId: number | null;
  essencia: string;
  tipo: "peca" | "aproveitamento";
  quantidadeLiquida: number;
  volumeVendidoM3: number | null;
  custoMateriaPrimaPorM3: number | null;
  custoIndustrialPorM3: number | null;
  custoComercialAdministrativoPorM3: number | null;
  coberturaMateriaPrimaPercentual: number;
  coberturaMateriaPrimaComEstimativaPercentual: number;
  origemCustoMateriaPrima: OrigemCustoMateriaPrimaVenda;
  referenciaEstimada: ReferenciaCustoHistoricoVenda | null;
  motivoIndisponibilidade: string | null;
};

const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;
const numeroSeguro = (valor: number | string | null | undefined) => {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
};
const normalizarEssencia = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleUpperCase("pt-BR");

/**
 * Consolida uma referência por essência ponderada pelo volume efetivamente
 * produzido. Ela só é usada como estimativa identificada de lacunas físicas;
 * nunca substitui o custo rastreado de lote com origem conhecida.
 */
export function consolidarReferenciasHistoricasPorEssencia(input: ObservacaoReferenciaCustoHistoricoVenda[]) {
  const acumulados = new Map<string, {
    essencia: string;
    volumeBaseM3: number;
    custoMateriaPrima: number;
    custoIndustrial: number;
    volumeIndustrial: number;
    custoComercialAdministrativo: number;
    volumeComercialAdministrativo: number;
    competencias: Set<string>;
  }>();
  for (const item of input) {
    const essencia = item.essencia.trim();
    const chave = normalizarEssencia(essencia);
    const volume = numeroSeguro(item.volumeProduzidoM3);
    const custoMateriaPrima = Number(item.custoMateriaPrima);
    if (!chave || volume <= 0 || !Number.isFinite(custoMateriaPrima) || custoMateriaPrima < 0) continue;
    const atual = acumulados.get(chave) ?? {
      essencia,
      volumeBaseM3: 0,
      custoMateriaPrima: 0,
      custoIndustrial: 0,
      volumeIndustrial: 0,
      custoComercialAdministrativo: 0,
      volumeComercialAdministrativo: 0,
      competencias: new Set<string>(),
    };
    atual.volumeBaseM3 += volume;
    atual.custoMateriaPrima += custoMateriaPrima;
    const custoIndustrialPorM3 = Number(item.custoIndustrialPorM3);
    if (Number.isFinite(custoIndustrialPorM3) && custoIndustrialPorM3 >= 0) {
      atual.custoIndustrial += volume * custoIndustrialPorM3;
      atual.volumeIndustrial += volume;
    }
    const custoComercialPorM3 = Number(item.custoComercialAdministrativoPorM3);
    if (Number.isFinite(custoComercialPorM3) && custoComercialPorM3 >= 0) {
      atual.custoComercialAdministrativo += volume * custoComercialPorM3;
      atual.volumeComercialAdministrativo += volume;
    }
    atual.competencias.add(item.competencia);
    acumulados.set(chave, atual);
  }
  return new Map(Array.from(acumulados.entries()).map(([chave, item]) => [chave, {
    essencia: item.essencia,
    volumeBaseM3: item.volumeBaseM3,
    competenciasComDados: item.competencias.size,
    custoMateriaPrimaPorM3: item.custoMateriaPrima / item.volumeBaseM3,
    valorToraPorM3: item.custoMateriaPrima / item.volumeBaseM3,
    freteEntradaPorM3: 0,
    custoIndustrialPorM3: item.volumeIndustrial > 0 ? item.custoIndustrial / item.volumeIndustrial : null,
    custoComercialAdministrativoPorM3: item.volumeComercialAdministrativo > 0 ? item.custoComercialAdministrativo / item.volumeComercialAdministrativo : null,
  } satisfies ReferenciaCustoHistoricoVenda]));
}

/**
 * Forma a referência de matéria-prima pelos romaneios de carga. Somente toras
 * da mesma essência com valor por m³ informado participam da média ponderada.
 * O frete de entrada do mesmo romaneio integra a matéria-prima; frete comercial
 * de madeira serrada não é recebido nesta função e permanece fora do custo.
 */
export function consolidarValoresToraRomaneioPorEssencia(input: ObservacaoValorToraRomaneio[]) {
  const acumulados = new Map<string, { essencia: string; volumeBaseM3: number; valorTotal: number; freteTotal: number; quantidadeToras: number }>();
  for (const item of input) {
    const essencia = item.essencia.trim();
    const chave = normalizarEssencia(essencia);
    const volume = numeroSeguro(item.volumeBaseM3);
    const valorMetroCubico = Number(item.valorMetroCubico);
    if (!chave || volume <= 0 || !Number.isFinite(valorMetroCubico) || valorMetroCubico <= 0) continue;
    const fretePorMetroCubico = numeroSeguro(item.fretePorMetroCubico);
    const atual = acumulados.get(chave) ?? { essencia, volumeBaseM3: 0, valorTotal: 0, freteTotal: 0, quantidadeToras: 0 };
    atual.volumeBaseM3 += volume;
    atual.valorTotal += volume * valorMetroCubico;
    atual.freteTotal += volume * fretePorMetroCubico;
    atual.quantidadeToras += 1;
    acumulados.set(chave, atual);
  }
  return new Map(Array.from(acumulados.entries()).map(([chave, item]) => [chave, {
    essencia: item.essencia,
    volumeBaseM3: item.volumeBaseM3,
    valorMetroCubicoMedio: item.valorTotal / item.volumeBaseM3,
    freteEntradaPorM3Medio: item.freteTotal / item.volumeBaseM3,
    custoMateriaPrimaPorM3Medio: (item.valorTotal + item.freteTotal) / item.volumeBaseM3,
    quantidadeToras: item.quantidadeToras,
  }]));
}

/**
 * Reconstrói o volume vendido de peças a partir da saída líquida e do lote de
 * origem. Movimentos antigos de peça podem ter volume zero, portanto eles não
 * são usados como base. Quando autorizado para uma lacuna histórica, o volume
 * já registrado no lote próprio é usado somente como base da referência média.
 */
export function calcularVolumeLiquidoVendido(input: {
  tipo: "peca" | "aproveitamento";
  quantidadeLiquida: number | string | null | undefined;
  volumeLiquidoMovimentado: number | string | null | undefined;
  volumeLote: number | string | null | undefined;
  quantidadeProduzida: number | string | null | undefined;
  permitirVolumeLoteSemProducao?: boolean;
}) {
  const quantidadeLiquida = numeroSeguro(input.quantidadeLiquida);
  const volumeLiquidoMovimentado = numeroSeguro(input.volumeLiquidoMovimentado);
  if (input.tipo === "aproveitamento") return volumeLiquidoMovimentado > 0 ? volumeLiquidoMovimentado : null;
  const quantidadeProduzida = numeroSeguro(input.quantidadeProduzida);
  if (quantidadeLiquida <= 0) return null;
  if (quantidadeProduzida > 0) return (quantidadeLiquida * numeroSeguro(input.volumeLote)) / quantidadeProduzida;
  if (input.permitirVolumeLoteSemProducao && numeroSeguro(input.volumeLote) > 0) return numeroSeguro(input.volumeLote);
  return null;
}

/** Calcula o volume físico negociado de um item em m³, com dimensões em cm/cm/m. */
export function calcularVolumeItemVendaEstimado(input: {
  espessura: number | string | null | undefined;
  largura: number | string | null | undefined;
  comprimento: number | string | null | undefined;
  quantidade: number | string | null | undefined;
}) {
  const espessura = numeroSeguro(input.espessura);
  const largura = numeroSeguro(input.largura);
  const comprimento = numeroSeguro(input.comprimento);
  const quantidade = numeroSeguro(input.quantidade);
  if (espessura <= 0 || largura <= 0 || comprimento <= 0 || quantidade <= 0) return null;
  return (espessura * largura * comprimento * quantidade) / 10_000;
}

/**
 * Distribui o volume comercial já registrado em uma venda histórica entre seus
 * itens físicos. As dimensões servem apenas como peso relativo: quando o
 * volume total do pedido existe, ele é a fonte de volume prioritária.
 */
export function distribuirVolumeVendaHistoricaSemSaida(input: {
  volumeTotalVendaM3: number | string | null | undefined;
  itens: Array<{
    id: number;
    espessura: number | string | null | undefined;
    largura: number | string | null | undefined;
    comprimento: number | string | null | undefined;
    quantidade: number | string | null | undefined;
  }>;
}) {
  const volumesCalculados = input.itens.map((item) => ({ id: item.id, volume: calcularVolumeItemVendaEstimado(item) }));
  const itensComVolume = volumesCalculados.filter((item): item is { id: number; volume: number } => item.volume !== null && item.volume > 0);
  const volumeCalculadoTotal = itensComVolume.reduce((total, item) => total + item.volume, 0);
  const volumeTotalVenda = numeroSeguro(input.volumeTotalVendaM3);
  const escala = volumeTotalVenda > 0 && volumeCalculadoTotal > 0 ? volumeTotalVenda / volumeCalculadoTotal : 1;
  return new Map(volumesCalculados.map((item) => [item.id, item.volume === null ? null : item.volume * escala]));
}

/**
 * Consolida custos que possuem volume e origem suficientes para a respectiva
 * camada. Frete e comissão não compõem o custo: já reduziram a receita líquida
 * da madeira no cálculo comercial da venda.
 */
export function consolidarMargemVendaRastreavel(input: {
  receitaBrutaMadeira: number | string | null | undefined;
  descontoComercial: number | string | null | undefined;
  freteComercial: number | string | null | undefined;
  comissao: number | string | null | undefined;
  volumeNegociadoM3: number | string | null | undefined;
  lotes: LoteVendidoParaRentabilidade[];
}) {
  const receitaBrutaMadeira = numeroSeguro(input.receitaBrutaMadeira);
  const descontoComercial = numeroSeguro(input.descontoComercial);
  const freteComercial = numeroSeguro(input.freteComercial);
  const comissao = numeroSeguro(input.comissao);
  const deducoesComerciais = descontoComercial + freteComercial + comissao;
  const receitaLiquidaMadeira = receitaBrutaMadeira - deducoesComerciais;
  const volumeNegociadoM3 = numeroSeguro(input.volumeNegociadoM3);
  let volumeVendidoM3 = 0;
  let volumeComCustoMateriaPrimaRastreavelM3 = 0;
  let volumeComCustoMateriaPrimaComEstimativaM3 = 0;
  let volumeComCustoIndustrialM3 = 0;
  let volumeEstimadoM3 = 0;
  let custoMateriaPrima = 0;
  let custoIndustrial = 0;
  let custoComercialAdministrativo = 0;
  const problemas = new Set<string>();

  const lotes = input.lotes.map((lote) => {
    const volumeLoteM3 = lote.volumeVendidoM3;
    if (volumeLoteM3 === null || volumeLoteM3 <= 0) {
      problemas.add(lote.motivoIndisponibilidade ?? "Volume físico da saída indisponível para o lote.");
      return { ...lote, custoMateriaPrima: null, custoIndustrial: null, custoComercialAdministrativo: null, custoTotal: null, situacaoCobertura: "indisponivel" as const };
    }
    volumeVendidoM3 += volumeLoteM3;
    const custoMateria = lote.custoMateriaPrimaPorM3 === null ? null : volumeLoteM3 * lote.custoMateriaPrimaPorM3;
    const custoIndustrialLote = lote.custoIndustrialPorM3 === null ? null : volumeLoteM3 * lote.custoIndustrialPorM3;
    const custoComercial = lote.custoComercialAdministrativoPorM3 === null ? null : volumeLoteM3 * lote.custoComercialAdministrativoPorM3;
    if (custoMateria === null) problemas.add(lote.motivoIndisponibilidade ?? "Custo de matéria-prima indisponível para o lote.");
    if (custoIndustrialLote === null) problemas.add("Taxa industrial da competência de produção indisponível.");
    if (custoComercial === null) problemas.add("Taxa comercial/administrativa da competência de produção indisponível.");
    if (custoMateria !== null) {
      custoMateriaPrima += custoMateria;
      volumeComCustoMateriaPrimaComEstimativaM3 += volumeLoteM3;
      if (lote.origemCustoMateriaPrima === "rastreavel") volumeComCustoMateriaPrimaRastreavelM3 += volumeLoteM3;
      if (lote.origemCustoMateriaPrima === "estimado_por_essencia") volumeEstimadoM3 += volumeLoteM3;
    }
    if (custoIndustrialLote !== null) { volumeComCustoIndustrialM3 += volumeLoteM3; custoIndustrial += custoIndustrialLote; }
    if (custoComercial !== null) custoComercialAdministrativo += custoComercial;
    const custosConhecidos = [custoMateria, custoIndustrialLote, custoComercial].filter((valor): valor is number => valor !== null);
    const completo = custosConhecidos.length === 3 && lote.coberturaMateriaPrimaComEstimativaPercentual >= 100;
    const custoTotal = completo ? custosConhecidos.reduce((soma, valor) => soma + valor, 0) : null;
    return {
      ...lote,
      custoMateriaPrima: custoMateria === null ? null : arredondar(custoMateria),
      custoIndustrial: custoIndustrialLote === null ? null : arredondar(custoIndustrialLote),
      custoComercialAdministrativo: custoComercial === null ? null : arredondar(custoComercial),
      custoTotal: custoTotal === null ? null : arredondar(custoTotal),
      situacaoCobertura: completo ? "completa" as const : "parcial" as const,
    };
  });

  const custoTotalConhecido = custoMateriaPrima + custoIndustrial + custoComercialAdministrativo;
  const existemLotesComVolume = lotes.some((lote) => lote.volumeVendidoM3 !== null && lote.volumeVendidoM3 > 0);
  const coberturaCompleta = lotes.length > 0 && lotes.every((lote) => lote.situacaoCobertura === "completa");
  const situacaoCobertura: SituacaoCoberturaRentabilidadeVenda = !existemLotesComVolume ? "indisponivel" : coberturaCompleta ? "completa" : "parcial";
  const custoTotal = situacaoCobertura === "completa" ? custoTotalConhecido : null;
  const volumeBasePrecoM3 = volumeNegociadoM3 > 0 ? volumeNegociadoM3 : volumeVendidoM3;

  return {
    receitaBrutaMadeira: arredondar(receitaBrutaMadeira), descontoComercial: arredondar(descontoComercial), freteComercial: arredondar(freteComercial), comissao: arredondar(comissao), deducoesComerciais: arredondar(deducoesComerciais), receitaLiquidaMadeira: arredondar(receitaLiquidaMadeira),
    volumeNegociadoM3: arredondar(volumeNegociadoM3), volumeVendidoM3: arredondar(volumeVendidoM3), precoLiquidoPorM3: volumeBasePrecoM3 > 0 ? arredondar(receitaLiquidaMadeira / volumeBasePrecoM3) : null,
    custoMateriaPrima: arredondar(custoMateriaPrima), custoIndustrial: arredondar(custoIndustrial), custoComercialAdministrativo: arredondar(custoComercialAdministrativo), custoTotalConhecido: arredondar(custoTotalConhecido), custoTotal: custoTotal === null ? null : arredondar(custoTotal),
    custoConhecidoPorM3: volumeVendidoM3 > 0 ? arredondar(custoTotalConhecido / volumeVendidoM3) : null, custoTotalPorM3: custoTotal !== null && volumeVendidoM3 > 0 ? arredondar(custoTotal / volumeVendidoM3) : null,
    margemConhecida: arredondar(receitaLiquidaMadeira - custoTotalConhecido), margem: custoTotal === null ? null : arredondar(receitaLiquidaMadeira - custoTotal), margemPorM3: custoTotal !== null && volumeVendidoM3 > 0 ? arredondar((receitaLiquidaMadeira - custoTotal) / volumeVendidoM3) : null,
    situacaoCobertura, problemas: Array.from(problemas),
    coberturaMateriaPrimaPercentual: volumeVendidoM3 > 0 ? arredondar((volumeComCustoMateriaPrimaRastreavelM3 / volumeVendidoM3) * 100) : 0,
    coberturaMateriaPrimaComEstimativaPercentual: volumeVendidoM3 > 0 ? arredondar((volumeComCustoMateriaPrimaComEstimativaM3 / volumeVendidoM3) * 100) : 0,
    coberturaIndustrialPercentual: volumeVendidoM3 > 0 ? arredondar((volumeComCustoIndustrialM3 / volumeVendidoM3) * 100) : 0,
    volumeEstimadoM3: arredondar(volumeEstimadoM3), temEstimativa: volumeEstimadoM3 > 0,
    lotes,
  };
}
