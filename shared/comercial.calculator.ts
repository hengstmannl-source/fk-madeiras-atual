/**
 * Pure commercial calculation shared by the browser preview and new server-side sales.
 * Uses exact base-10 arithmetic and ROUND_HALF_UP; it is not connected to
 * operational sale flows.
 * Decimal values are represented as BigInt coefficients and base-10 scales;
 * no database, tRPC, frontend or process state is used here.
 */

export type TipoComercializacaoCalculo = "metro_cubico" | "unidade" | "pacote";
export type TipoAjusteCalculo = "percentual" | "fixo";

export type ComponentePacoteCalculo = {
  descricao: string;
  madeiraNome?: string | null;
  espessura?: string | null;
  largura?: string | null;
  comprimento?: string | null;
  quantidade: number;
};

export type ItemComercialCalculo = {
  tipoComercializacao: TipoComercializacaoCalculo;
  madeiraNome: string;
  espessuraMm: string;
  larguraMm: string;
  comprimentoMetros: string;
  quantidade: number;
  /** For m³ items this is the price per m³; otherwise price per commercial unit. */
  preco: string;
  componentesPacote?: ComponentePacoteCalculo[];
};

export type AjusteComercialCalculo = {
  tipo: TipoAjusteCalculo;
  valor: string;
};

export type TaxaComercialCalculo = AjusteComercialCalculo & { descricao: string };

export type AproveitamentoComercialCalculo = {
  madeiraNome: string;
  volume: string;
  precoM3: string;
};

export type EntradaCalculoComercial = {
  itens: ItemComercialCalculo[];
  aproveitamentos?: AproveitamentoComercialCalculo[];
  desconto: string;
  fretePorTonelada: string;
  pesoCargaToneladas: string;
  comissao: AjusteComercialCalculo;
  taxas?: TaxaComercialCalculo[];
};

type Decimal = { coefficient: bigint; scale: number };
const POW10: bigint[] = [BigInt(1)];

function pow10(scale: number): bigint {
  if (!Number.isInteger(scale) || scale < 0 || scale > 100) throw new Error("Escala decimal inválida");
  while (POW10.length <= scale) POW10.push(POW10[POW10.length - 1] * BigInt(10));
  return POW10[scale];
}

function parseDecimal(value: string, field: string, maxScale: number, maxIntegerDigits = 12): Decimal {
  if (typeof value !== "string") throw new Error(`${field}: informe um decimal como texto`);
  const normalized = value.trim().replace(",", ".");
  if (!/^(?:\d+)(?:\.\d+)?$/.test(normalized)) throw new Error(`${field}: valor decimal inválido`);
  const [integer, fraction = ""] = normalized.split(".");
  if (fraction.length > maxScale) throw new Error(`${field}: precisão máxima de ${maxScale} casas decimais`);
  if ((integer.replace(/^0+/, "") || "0").length > maxIntegerDigits) throw new Error(`${field}: valor excede a precisão máxima`);
  const coefficient = BigInt(`${integer}${fraction}`);
  return { coefficient, scale: fraction.length };
}

function add(a: Decimal, b: Decimal): Decimal {
  const scale = Math.max(a.scale, b.scale);
  return { coefficient: a.coefficient * pow10(scale - a.scale) + b.coefficient * pow10(scale - b.scale), scale };
}

function subtract(a: Decimal, b: Decimal): Decimal {
  const scale = Math.max(a.scale, b.scale);
  return { coefficient: a.coefficient * pow10(scale - a.scale) - b.coefficient * pow10(scale - b.scale), scale };
}

function multiply(a: Decimal, b: Decimal): Decimal {
  return { coefficient: a.coefficient * b.coefficient, scale: a.scale + b.scale };
}

function divideByPowerOfTen(value: Decimal, places: number): Decimal {
  return { coefficient: value.coefficient, scale: value.scale + places };
}

function round(value: Decimal, targetScale: number): Decimal {
  if (value.scale <= targetScale) return { coefficient: value.coefficient * pow10(targetScale - value.scale), scale: targetScale };
  const divisor = pow10(value.scale - targetScale);
  const negative = value.coefficient < BigInt(0);
  const absolute = negative ? -value.coefficient : value.coefficient;
  let quotient = absolute / divisor;
  const remainder = absolute % divisor;
  if (remainder * BigInt(2) >= divisor) quotient += BigInt(1);
  return { coefficient: negative ? -quotient : quotient, scale: targetScale };
}

function format(value: Decimal, targetScale = value.scale): string {
  const rounded = round(value, targetScale);
  const negative = rounded.coefficient < BigInt(0);
  const absolute = negative ? -rounded.coefficient : rounded.coefficient;
  const digits = absolute.toString().padStart(targetScale + 1, "0");
  if (targetScale === 0) return `${negative ? "-" : ""}${digits}`;
  return `${negative ? "-" : ""}${digits.slice(0, -targetScale)}.${digits.slice(-targetScale)}`;
}

function formatColumn(value: Decimal, precision: number, scale: number, field: string): string {
  const rounded = round(value, scale);
  const absolute = rounded.coefficient < BigInt(0) ? -rounded.coefficient : rounded.coefficient;
  if (absolute >= pow10(precision)) throw new Error(`${field}: resultado excede a precisão da coluna`);
  return format(rounded, scale);
}

function validateNonNegative(value: Decimal, field: string, allowZero = true): void {
  if (value.coefficient < BigInt(0) || (!allowZero && value.coefficient === BigInt(0))) {
    throw new Error(`${field}: valor ${allowZero ? "não negativo" : "positivo"} obrigatório`);
  }
}

function validateQuantity(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647) {
    throw new Error(`${field}: quantidade inteira positiva inválida`);
  }
}

function parseAdjustment(adjustment: AjusteComercialCalculo, field: string, maxScale: number, maxIntegerDigits: number): Decimal {
  if (adjustment.tipo !== "percentual" && adjustment.tipo !== "fixo") throw new Error(`${field}: tipo de ajuste inválido`);
  const value = parseDecimal(adjustment.valor, field, maxScale, maxIntegerDigits);
  validateNonNegative(value, field);
  if (adjustment.tipo === "percentual" && value.coefficient > BigInt(100) * pow10(value.scale)) {
    throw new Error(`${field}: percentual deve estar entre 0% e 100%`);
  }
  return value;
}

function checkedName(value: string, field: string): void {
  if (typeof value !== "string" || value.trim().length < 2) throw new Error(`${field}: informe ao menos 2 caracteres`);
}

export type ItemCalculadoComercial = {
  madeiraNome: string;
  tipoComercializacao: TipoComercializacaoCalculo;
  quantidade: number;
  unidadesPorComercializacao: number;
  precoLinear: string;
  valorPeca: string;
  valorTotal: string;
  componentesPacote: ComponentePacoteCalculo[];
};

export type ResultadoCalculoComercial = {
  itens: ItemCalculadoComercial[];
  subtotal: string;
  subtotalExato: string;
  desconto: string;
  abatimentoFrete: string;
  baseAposFrete: string;
  comissaoCalculada: string;
  taxasCalculadas: Array<{ descricao: string; calculado: string }>;
  taxaCalculada: string;
  total: string;
  totalPecas: number;
  totalMetroLinear: string;
  totalVolume: string;
  aproveitamentos: Array<{ madeiraNome: string; volume: string; precoM3: string; valorTotal: string }>;
};

/** Calculates a commercial quote using the approved internal-sale rules. */
export function calcularComercial(input: EntradaCalculoComercial): ResultadoCalculoComercial {
  const desconto = parseDecimal(input.desconto, "Desconto", 2, 10);
  const fretePorTonelada = parseDecimal(input.fretePorTonelada, "Frete por tonelada", 2, 10);
  const peso = parseDecimal(input.pesoCargaToneladas, "Peso da carga", 3, 9);
  validateNonNegative(desconto, "Desconto");
  validateNonNegative(fretePorTonelada, "Frete por tonelada");
  validateNonNegative(peso, "Peso da carga");

  if (!Array.isArray(input.itens) || !Array.isArray(input.aproveitamentos ?? []) || !Array.isArray(input.taxas ?? [])) {
    throw new Error("Itens, aproveitamentos e taxas devem ser listas");
  }
  if (input.itens.length > 2000 || (input.aproveitamentos?.length ?? 0) > 30 || (input.taxas?.length ?? 0) > 20) {
    throw new Error("Quantidade máxima de itens, aproveitamentos ou taxas excedida");
  }
  if (!input.itens.length && !input.aproveitamentos?.length) throw new Error("Informe ao menos um item ou aproveitamento");

  // Every line is converted to commercial cents before it contributes to the
  // subtotal. This keeps subtotal exactly equal to the sum of its displayed lines.
  let subtotalExato: Decimal = { coefficient: BigInt(0), scale: 0 };
  let totalPecas = 0;
  let totalMetroLinear: Decimal = { coefficient: BigInt(0), scale: 0 };
  let totalVolume: Decimal = { coefficient: BigInt(0), scale: 0 };

  const itens = input.itens.map((item, index): ItemCalculadoComercial => {
    const prefix = `Item ${index + 1}`;
    checkedName(item.madeiraNome, `${prefix} produto`);
    validateQuantity(item.quantidade, `${prefix} quantidade`);
    if (!["metro_cubico", "unidade", "pacote"].includes(item.tipoComercializacao)) {
      throw new Error(`${prefix}: tipo de comercialização inválido`);
    }
    const dimensoes = [
      parseDecimal(item.espessuraMm, `${prefix} espessura`, 2, 6),
      parseDecimal(item.larguraMm, `${prefix} largura`, 2, 6),
      parseDecimal(item.comprimentoMetros, `${prefix} comprimento`, 2, 6),
    ];
    const [espessura, largura, comprimento] = dimensoes;
    validateNonNegative(espessura, `${prefix} espessura`);
    validateNonNegative(largura, `${prefix} largura`);
    validateNonNegative(comprimento, `${prefix} comprimento`);
    const preco = parseDecimal(item.preco, `${prefix} preço`, 2, 10);
    validateNonNegative(preco, `${prefix} preço`, item.tipoComercializacao !== "metro_cubico");
    let precoLinear: Decimal = { coefficient: BigInt(0), scale: 0 };
    let valorPeca: Decimal;
    let valorTotal: Decimal;
    let componentes = item.componentesPacote ?? [];
    let unidadesPorComercializacao = 1;

    if (item.tipoComercializacao === "metro_cubico") {
      validateNonNegative(espessura, `${prefix} espessura`, false);
      validateNonNegative(largura, `${prefix} largura`, false);
      validateNonNegative(comprimento, `${prefix} comprimento`, false);
      precoLinear = divideByPowerOfTen(multiply(multiply(espessura, largura), preco), 6);
      const valorPecaExato = multiply(precoLinear, comprimento);
      valorPeca = round(valorPecaExato, 2);
      valorTotal = multiply(valorPeca, { coefficient: BigInt(item.quantidade), scale: 0 });
      subtotalExato = add(subtotalExato, multiply(valorPeca, { coefficient: BigInt(item.quantidade), scale: 0 }));
      totalVolume = add(totalVolume, divideByPowerOfTen(
        multiply(multiply(multiply(espessura, largura), comprimento), { coefficient: BigInt(item.quantidade), scale: 0 }),
        6,
      ));
      totalMetroLinear = add(totalMetroLinear, multiply(comprimento, { coefficient: BigInt(item.quantidade), scale: 0 }));
    } else {
      valorPeca = round(preco, 2);
      valorTotal = round(multiply(preco, { coefficient: BigInt(item.quantidade), scale: 0 }), 2);
      subtotalExato = add(subtotalExato, multiply(valorPeca, { coefficient: BigInt(item.quantidade), scale: 0 }));
      if (item.tipoComercializacao === "pacote") {
        if (!componentes.length) throw new Error(`${prefix}: pacote precisa ter componentes`);
        componentes = componentes.map((component, componentIndex) => {
          checkedName(component.descricao, `${prefix} componente ${componentIndex + 1}`);
          validateQuantity(component.quantidade, `${prefix} componente ${componentIndex + 1}`);
          for (const [label, dimension] of [["espessura", component.espessura], ["largura", component.largura], ["comprimento", component.comprimento]] as const) {
            if (dimension != null) {
              const parsed = parseDecimal(dimension, `${prefix} componente ${componentIndex + 1} ${label}`, 2, 6);
              validateNonNegative(parsed, `${prefix} componente ${componentIndex + 1} ${label}`);
            }
          }
          return { ...component };
        });
        unidadesPorComercializacao = componentes.reduce((sum, component) => sum + component.quantidade, 0);
        if (!Number.isSafeInteger(unidadesPorComercializacao) || unidadesPorComercializacao > 2_147_483_647) {
          throw new Error(`${prefix}: total de componentes excede o limite permitido`);
        }
      } else if (componentes.length) {
        throw new Error(`${prefix}: componentes só são permitidos em pacotes`);
      }
    }
    totalPecas += item.quantidade;
    if (!Number.isSafeInteger(totalPecas)) throw new Error("Quantidade total de peças excede o limite seguro");
    return {
      madeiraNome: item.madeiraNome.trim(),
      tipoComercializacao: item.tipoComercializacao,
      quantidade: item.quantidade,
      unidadesPorComercializacao,
      precoLinear: formatColumn(precoLinear, 12, 4, `${prefix} preço linear`),
      valorPeca: formatColumn(valorPeca, 12, 2, `${prefix} valor da peça`),
      valorTotal: formatColumn(valorTotal, 12, 2, `${prefix} total do item`),
      componentesPacote: componentes.map((component) => ({ ...component })),
    };
  });

  const aproveitamentos = (input.aproveitamentos ?? []).map((item, index) => {
    checkedName(item.madeiraNome, `Aproveitamento ${index + 1} produto`);
    const volume = parseDecimal(item.volume, `Aproveitamento ${index + 1} volume`, 3, 9);
    const precoM3 = parseDecimal(item.precoM3, `Aproveitamento ${index + 1} preço`, 2, 10);
    validateNonNegative(volume, `Aproveitamento ${index + 1} volume`, false);
    validateNonNegative(precoM3, `Aproveitamento ${index + 1} preço`);
    const valor = round(multiply(volume, precoM3), 2);
    subtotalExato = add(subtotalExato, valor);
    totalVolume = add(totalVolume, volume);
    return {
      madeiraNome: item.madeiraNome.trim(),
      volume: format(volume, 3),
      precoM3: format(precoM3, 2),
      valorTotal: formatColumn(valor, 12, 2, `Aproveitamento ${index + 1} total`),
    };
  });

  // Monetary adjustment boundaries: freight, commission and each fee are
  // rounded to cents before they are exposed or included in the final total.
  const abatimentoFreteExato = round(multiply(fretePorTonelada, peso), 2);
  const baseExata = subtract(subtract(subtotalExato, desconto), abatimentoFreteExato);
  const zero: Decimal = { coefficient: BigInt(0), scale: 0 };
  const baseAposFrete = baseExata.coefficient < BigInt(0) ? zero : baseExata;
  const comissaoValor = parseAdjustment(input.comissao, "Comissão", 2, 10);
  const comissaoExata = round(input.comissao.tipo === "percentual"
    ? divideByPowerOfTen(multiply(baseAposFrete, comissaoValor), 2)
    : comissaoValor, 2);
  const taxasCalculadasExatas = (input.taxas ?? []).map((taxa, index) => {
    checkedName(taxa.descricao, `Taxa ${index + 1} descrição`);
    if (taxa.tipo !== "percentual" && taxa.tipo !== "fixo") throw new Error(`Taxa ${index + 1}: tipo de ajuste inválido`);
    const valor = parseAdjustment(taxa, `Taxa ${index + 1}`, 4, 8);
    return {
      descricao: taxa.descricao.trim(),
      calculadoExato: round(taxa.tipo === "percentual" ? divideByPowerOfTen(multiply(baseAposFrete, valor), 2) : valor, 2),
    };
  });
  const taxaTotalExata = taxasCalculadasExatas.reduce((total, taxa) => add(total, taxa.calculadoExato), zero);
  const totalBruto = add(subtract(baseAposFrete, comissaoExata), taxaTotalExata);
  const total = totalBruto.coefficient < BigInt(0) ? zero : round(totalBruto, 2);

  return {
    itens,
    subtotal: formatColumn(subtotalExato, 14, 2, "Subtotal"),
    subtotalExato: format(subtotalExato),
    desconto: format(desconto, 2),
    abatimentoFrete: formatColumn(abatimentoFreteExato, 12, 2, "Abatimento do frete"),
    baseAposFrete: formatColumn(baseAposFrete, 14, 2, "Base comercial"),
    comissaoCalculada: formatColumn(comissaoExata, 12, 2, "Comissão calculada"),
    taxasCalculadas: taxasCalculadasExatas.map((taxa, index) => ({ descricao: taxa.descricao, calculado: formatColumn(taxa.calculadoExato, 12, 2, `Taxa ${index + 1} calculada`) })),
    taxaCalculada: formatColumn(taxaTotalExata, 12, 2, "Total das taxas"),
    total: formatColumn(total, 14, 2, "Total comercial"),
    totalPecas,
    totalMetroLinear: formatColumn(totalMetroLinear, 14, 4, "Metragem linear total"),
    totalVolume: formatColumn(totalVolume, 14, 6, "Volume total"),
    aproveitamentos,
  };
}
