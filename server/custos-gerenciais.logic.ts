export const BASES_APROPRIACAO_CUSTO = [
  "m3_produzido",
  "m3_vendido",
  "valor_vendido",
  "quantidade_vendida",
  "carga",
  "pedido",
  "percentual_receita",
  "manual",
] as const;

export type BaseApropriacaoCusto = (typeof BASES_APROPRIACAO_CUSTO)[number];
export type UnidadeValorCusto = "monetario" | "percentual";

export type LancamentoCustoParaCalculo = {
  id: number;
  categoriaCustoId: number;
  baseApropriacao: BaseApropriacaoCusto;
  unidadeValor: UnidadeValorCusto;
  valor: number | string;
};

export type BasesApropriacao = Partial<Record<BaseApropriacaoCusto, number>>;

export type ItemRateioCalculado = {
  categoriaCustoId: number;
  baseApropriacao: BaseApropriacaoCusto;
  baseTotal: number;
  valorRateado: number;
  fatorUnitario: number;
  coberturaPercentual: number;
  lancamentosIds: number[];
};

export type InsumoMateriaPrima = {
  identificador: string;
  volumeConsumidoM3: number | string;
  custoTora: number | string | null;
  freteEntrada: number | string | null;
};

export type CustoMateriaPrimaRastreavel = {
  volumeConsumidoM3: number;
  custoRastreavel: number;
  volumeCobertoM3: number;
  volumeSemCustoM3: number;
  coberturaPercentual: number;
  custoPorM3Coberto: number | null;
  itensSemCusto: string[];
};

export type SimulacaoPreco = {
  custoTotal: number;
  margemPercentual: number;
  markupPercentual: number;
  precoPorM3: number | null;
  aviso: string | null;
};

const ARREDONDAMENTO_MONETARIO = 100;
const ARREDONDAMENTO_FATOR = 100_000_000;

export function decimalCusto(valor: number | string | null | undefined): number {
  if (valor === null || valor === undefined || valor === "") return 0;
  const numero = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  if (!Number.isFinite(numero)) throw new Error("Valor de custo inválido.");
  return numero;
}

export function arredondarCusto(valor: number, casas = 2): number {
  const fator = 10 ** casas;
  return Math.round((valor + Number.EPSILON) * fator) / fator;
}

export function validarBaseApropriacao(base: string): asserts base is BaseApropriacaoCusto {
  if (!BASES_APROPRIACAO_CUSTO.includes(base as BaseApropriacaoCusto)) {
    throw new Error("Base de apropriação inválida.");
  }
}

/**
 * Torna explícito o efeito de um lançamento percentual. Percentuais nunca são
 * inferidos pelo nome da categoria: devem chegar com unidadeValor = percentual.
 */
export function calcularValorLancamentoCusto(input: Pick<LancamentoCustoParaCalculo, "unidadeValor" | "valor">, base: number | string): number {
  const valor = decimalCusto(input.valor);
  const baseNumerica = decimalCusto(base);
  if (valor < 0 || baseNumerica < 0) throw new Error("Custos e bases não podem ser negativos.");
  return input.unidadeValor === "percentual"
    ? arredondarCusto((baseNumerica * valor) / 100, 4)
    : arredondarCusto(valor, 4);
}

/**
 * Consolida uma categoria para uma competência. A ausência de base não é
 * estimada: o rateio é marcado com cobertura zero e fator nulo.
 */
export function calcularRateiosPorCategoria(
  lancamentos: LancamentoCustoParaCalculo[],
  bases: BasesApropriacao,
): ItemRateioCalculado[] {
  const porCategoria = new Map<number, LancamentoCustoParaCalculo[]>();
  for (const lancamento of lancamentos) {
    validarBaseApropriacao(lancamento.baseApropriacao);
    const atuais = porCategoria.get(lancamento.categoriaCustoId) ?? [];
    atuais.push(lancamento);
    porCategoria.set(lancamento.categoriaCustoId, atuais);
  }

  return Array.from(porCategoria.entries()).map(([categoriaCustoId, itens]: [number, LancamentoCustoParaCalculo[]]) => {
    const primeiro = itens[0];
    if (!primeiro) throw new Error("Uma categoria precisa ter ao menos um lançamento de custo.");
    const baseApropriacao: BaseApropriacaoCusto = primeiro.baseApropriacao;
    if (itens.some((item: LancamentoCustoParaCalculo) => item.baseApropriacao !== baseApropriacao)) {
      throw new Error("Uma categoria não pode misturar bases de apropriação na mesma competência.");
    }
    const baseTotal = decimalCusto(bases[baseApropriacao]);
    const valorRateado = itens.reduce(
      (soma: number, item: LancamentoCustoParaCalculo) => soma + calcularValorLancamentoCusto(item, baseTotal),
      0,
    );
    const possuiBase = baseApropriacao === "manual" || baseTotal > 0;
    const fatorUnitario = baseApropriacao === "manual"
      ? 0
      : possuiBase
        ? Math.round((valorRateado / baseTotal) * ARREDONDAMENTO_FATOR) / ARREDONDAMENTO_FATOR
        : 0;
    return {
      categoriaCustoId,
      baseApropriacao,
      baseTotal: arredondarCusto(baseTotal, 6),
      valorRateado: arredondarCusto(valorRateado, 2),
      fatorUnitario,
      coberturaPercentual: possuiBase ? 100 : 0,
      lancamentosIds: itens.map((item: LancamentoCustoParaCalculo) => item.id),
    };
  });
}

/** Custo da matéria-prima é sempre rastreado no consumo de tora e nunca estimado. */
export function calcularCustoMateriaPrimaRastreavel(insumos: InsumoMateriaPrima[]): CustoMateriaPrimaRastreavel {
  const resumo = insumos.reduce((acumulado, insumo) => {
    const volume = decimalCusto(insumo.volumeConsumidoM3);
    if (volume < 0) throw new Error("O volume consumido não pode ser negativo.");
    const custoTora = insumo.custoTora === null ? null : decimalCusto(insumo.custoTora);
    const freteEntrada = insumo.freteEntrada === null ? null : decimalCusto(insumo.freteEntrada);
    const possuiCusto = custoTora !== null && freteEntrada !== null;
    acumulado.volumeConsumidoM3 += volume;
    if (possuiCusto) {
      acumulado.volumeCobertoM3 += volume;
      acumulado.custoRastreavel += custoTora + freteEntrada;
    } else {
      acumulado.volumeSemCustoM3 += volume;
      acumulado.itensSemCusto.push(insumo.identificador);
    }
    return acumulado;
  }, {
    volumeConsumidoM3: 0,
    custoRastreavel: 0,
    volumeCobertoM3: 0,
    volumeSemCustoM3: 0,
    itensSemCusto: [] as string[],
  });

  const coberturaPercentual = resumo.volumeConsumidoM3 > 0
    ? arredondarCusto((resumo.volumeCobertoM3 / resumo.volumeConsumidoM3) * 100, 2)
    : 0;
  return {
    ...resumo,
    custoRastreavel: arredondarCusto(resumo.custoRastreavel),
    coberturaPercentual,
    custoPorM3Coberto: resumo.volumeCobertoM3 > 0
      ? arredondarCusto(resumo.custoRastreavel / resumo.volumeCobertoM3, 4)
      : null,
  };
}

/** Preço sugerido é simulação: não altera pedido, estoque, custo ou financeiro. */
export function calcularPrecoSugerido(input: {
  custoPorM3: number | string | null;
  margemPercentual?: number | string | null;
  markupPercentual?: number | string | null;
}): SimulacaoPreco {
  const custoTotal = decimalCusto(input.custoPorM3);
  const margemPercentual = decimalCusto(input.margemPercentual);
  const markupPercentual = decimalCusto(input.markupPercentual);
  if (custoTotal <= 0) return { custoTotal, margemPercentual, markupPercentual, precoPorM3: null, aviso: "Não há custo coberto suficiente para sugerir preço." };
  if (margemPercentual > 0) {
    if (margemPercentual >= 100) throw new Error("A margem desejada deve ser inferior a 100%.");
    return {
      custoTotal,
      margemPercentual,
      markupPercentual,
      precoPorM3: arredondarCusto(custoTotal / (1 - margemPercentual / 100)),
      aviso: null,
    };
  }
  return {
    custoTotal,
    margemPercentual,
    markupPercentual,
    precoPorM3: arredondarCusto(custoTotal * (1 + markupPercentual / 100)),
    aviso: null,
  };
}

export function calcularMargemGerencial(receita: number | string, custoTotal: number | string): { receita: number; custoTotal: number; margem: number; margemPercentual: number | null } {
  const receitaNumerica = decimalCusto(receita);
  const custoNumerico = decimalCusto(custoTotal);
  const margem = arredondarCusto(receitaNumerica - custoNumerico);
  return {
    receita: arredondarCusto(receitaNumerica),
    custoTotal: arredondarCusto(custoNumerico),
    margem,
    margemPercentual: receitaNumerica > 0 ? arredondarCusto((margem / receitaNumerica) * 100, 2) : null,
  };
}
