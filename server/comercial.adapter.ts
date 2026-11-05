import {
  calcularComercial,
  type ComponentePacoteCalculo,
  type TipoAjusteCalculo,
  type TipoComercializacaoCalculo,
} from "./comercial.calculator";

const INT_MAX = 2_147_483_647;

type TipoVenda = "externa" | "interna";

export type ItemComercialMutation = {
  madeiraId?: number | null;
  bitolaId?: number | null;
  produtoComercialId?: number | null;
  madeiraNome: string;
  bitolaDescricao: string;
  espessura: string;
  largura: string;
  comprimento: string;
  quantidade: number;
  tipoComercializacao: TipoComercializacaoCalculo;
  unidadesPorComercializacao?: unknown;
  precoM3: string;
  precoLinear?: unknown;
  valorPeca?: unknown;
  valorTotal?: unknown;
  componentesPacote?: Array<{
    descricao: string;
    madeiraNome?: string | null;
    espessura?: string | null;
    largura?: string | null;
    comprimento?: string | null;
    quantidade: number;
  }>;
  orcamentoId?: unknown;
};

export type TaxaComercialMutation = {
  descricao: string;
  tipo: TipoAjusteCalculo;
  valor: string;
  /** Campo derivado legado, deliberadamente ignorado. */
  calculado?: unknown;
};

export type AproveitamentoComercialMutation = {
  madeiraNome: string;
  volume: string | number;
  precoM3: string | number;
};

/** Formato comercial validado/normalizado produzido pelo contrato atual de orcamento.create. */
export type EntradaAdaptadorComercial = {
  clienteId: number;
  desconto: string;
  fretePorTonelada: string;
  pesoCargaToneladas: string;
  comissaoTipo: TipoAjusteCalculo;
  comissaoValor: string;
  itens: ItemComercialMutation[];
  aproveitamentos?: AproveitamentoComercialMutation[];
  taxasAdicionais?: TaxaComercialMutation[];
  /** Campos calculados pelo cliente; nunca usados como fonte de verdade. */
  frete?: unknown;
  abatimentoFrete?: unknown;
  baseAposFrete?: unknown;
  comissaoCalculada?: unknown;
  taxaCalculada?: unknown;
  subtotal?: unknown;
  total?: unknown;
  totalPecas?: unknown;
  totalMetroLinear?: unknown;
  totalVolume?: unknown;
  /** Compatibilidade com o campo de taxa única usado por registros antigos. */
  taxaDescricao?: string | null;
  taxaTipo?: TipoAjusteCalculo;
  taxaValor?: string;
  /** A versão é controlada pelo servidor, mesmo se um chamador enviar esse campo. */
  versaoCalculoComercial?: unknown;
};

export type ItemComercialPreparado = {
  madeiraId: number | null;
  bitolaId: number | null;
  produtoComercialId: number | null;
  madeiraNome: string;
  bitolaDescricao: string;
  espessura: string;
  largura: string;
  comprimento: string;
  quantidade: number;
  tipoComercializacao: TipoComercializacaoCalculo;
  unidadesPorComercializacao: number;
  precoM3: string;
  precoLinear: string;
  valorPeca: string;
  valorTotal: string;
  componentesPacote: ComponentePacoteCalculo[];
};

export type ResultadoAdaptadorComercial = {
  cabecalho: {
    clienteId: number;
    tipoVenda: TipoVenda;
    versaoCalculoComercial: 1;
    desconto: string;
    frete: string;
    fretePorTonelada: string;
    pesoCargaToneladas: string;
    abatimentoFrete: string;
    baseAposFrete: string;
    comissaoTipo: TipoAjusteCalculo;
    comissaoValor: string;
    comissaoCalculada: string;
    taxaDescricao: string | null;
    taxaTipo: TipoAjusteCalculo;
    taxaValor: string;
    taxaCalculada: string;
    subtotal: string;
    total: string;
    totalPecas: number;
    totalMetroLinear: string;
    totalVolume: string;
  };
  itens: ItemComercialPreparado[];
  aproveitamentos: Array<{
    madeiraNome: string;
    volume: string;
    precoM3: string;
    valorTotal: string;
  }>;
  taxasAdicionais: Array<{
    descricao: string;
    tipo: TipoAjusteCalculo;
    valor: string;
    calculado: string;
    ordem: number;
  }>;
};

function decimalTexto(value: unknown, field: string, scale: number): string {
  if (typeof value !== "string") throw new Error(`${field}: informe um decimal como texto`);
  const normalized = value.trim().replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`${field}: valor decimal inválido`);
  const fraction = normalized.split(".")[1] ?? "";
  if (fraction.length > scale) throw new Error(`${field}: precisão máxima de ${scale} casas decimais`);
  return normalized;
}

function decimalNumeroTexto(value: unknown, field: string, scale: number): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`${field}: valor decimal inválido`);
    value = String(value);
  }
  return decimalTexto(value, field, scale);
}

function formatarEscala(value: string, scale: number): string {
  const [integer, fraction = ""] = value.replace(",", ".").split(".");
  return `${integer}.${fraction.padEnd(scale, "0")}`;
}

function validarId(value: unknown, field: string, nullable = false): number | null {
  if (nullable && (value === null || value === undefined)) return null;
  if (!Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > INT_MAX) {
    throw new Error(`${field}: identificador inválido`);
  }
  return Number(value);
}

function validarTexto(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim().length < 2 || value.length > maxLength) {
    throw new Error(`${field}: texto inválido`);
  }
  return value.trim();
}

function dimensaoComponente(value: string | null | undefined, field: string): string | null | undefined {
  if (value == null || value.trim() === "") return null;
  return formatarEscala(decimalTexto(value, field, 2), 2);
}

function validarQuantidade(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > INT_MAX) {
    throw new Error(`${field}: quantidade inteira positiva inválida`);
  }
  return Number(value);
}

function normalizarComponentes(
  componentes: ItemComercialMutation["componentesPacote"],
  index: number,
): ComponentePacoteCalculo[] {
  if (componentes === undefined) return [];
  if (!Array.isArray(componentes) || componentes.length > 60) {
    throw new Error(`Item ${index + 1}: quantidade de componentes inválida`);
  }
  return componentes.map((component, componentIndex) => ({
    descricao: validarTexto(component.descricao, `Componente ${componentIndex + 1} descrição`, 240),
    madeiraNome: component.madeiraNome == null || component.madeiraNome.trim() === ""
      ? null
      : validarTexto(component.madeiraNome, `Componente ${componentIndex + 1} madeira`, 200),
    espessura: dimensaoComponente(component.espessura, "Espessura do componente"),
    largura: dimensaoComponente(component.largura, "Largura do componente"),
    comprimento: dimensaoComponente(component.comprimento, "Comprimento do componente"),
    quantidade: validarQuantidade(component.quantidade, `Componente ${componentIndex + 1} quantidade`),
  }));
}

/**
 * Adapta uma nova operação comercial sem acessar o banco. Totais e valores por
 * linha enviados pelo cliente são deliberadamente ignorados; a versão do cálculo
 * é sempre atribuída pelo servidor.
 */
export function prepararNovaVendaComercial(
  tipoVenda: TipoVenda,
  input: EntradaAdaptadorComercial,
): ResultadoAdaptadorComercial {
  if (tipoVenda !== "externa" && tipoVenda !== "interna") throw new Error("Tipo de venda inválido");
  const clienteId = validarId(input.clienteId, "Cliente")!;
  if (!Array.isArray(input.itens) || !Array.isArray(input.aproveitamentos ?? []) || !Array.isArray(input.taxasAdicionais ?? [])) {
    throw new Error("Itens, aproveitamentos e taxas devem ser listas");
  }

  const taxasInformadas = input.taxasAdicionais ?? [];
  const descricaoTaxaLegada = input.taxaDescricao?.trim();
  if (taxasInformadas.length > 0 && descricaoTaxaLegada) {
    throw new Error("Informe taxas adicionais ou a taxa legada, sem duplicar as duas representações");
  }
  const taxaLegada = taxasInformadas.length === 0 && descricaoTaxaLegada
    ? {
      descricao: validarTexto(descricaoTaxaLegada, "Descrição da taxa", 120),
      tipo: input.taxaTipo ?? "percentual",
      valor: decimalTexto(input.taxaValor ?? "0", "Valor da taxa legada", 2),
    }
    : undefined;
  const taxas = taxasInformadas.length > 0
    ? taxasInformadas.map((taxa, index) => ({
      descricao: validarTexto(taxa.descricao, `Taxa ${index + 1} descrição`, 120),
      tipo: taxa.tipo,
      valor: decimalTexto(taxa.valor, `Taxa ${index + 1} valor`, 4),
    }))
    : taxaLegada ? [taxaLegada] : [];

  const itensNormalizados = input.itens.map((item, index) => {
    const prefix = `Item ${index + 1}`;
    const tipo = item.tipoComercializacao;
    if (tipo !== "metro_cubico" && tipo !== "unidade" && tipo !== "pacote") {
      throw new Error(`${prefix}: tipo de comercialização inválido`);
    }
    const componentesPacote = normalizarComponentes(item.componentesPacote, index);
    return {
      persistencia: {
        madeiraId: validarId(item.madeiraId, `${prefix} madeira`, true),
        bitolaId: validarId(item.bitolaId, `${prefix} bitola`, true),
        produtoComercialId: validarId(item.produtoComercialId, `${prefix} produto`, true),
        madeiraNome: validarTexto(item.madeiraNome, `${prefix} madeira`, 200),
        bitolaDescricao: validarTexto(item.bitolaDescricao, `${prefix} descrição da bitola`, 200),
        espessura: decimalTexto(item.espessura, `${prefix} espessura`, 2),
        largura: decimalTexto(item.largura, `${prefix} largura`, 2),
        comprimento: decimalTexto(item.comprimento, `${prefix} comprimento`, 2),
        quantidade: validarQuantidade(item.quantidade, `${prefix} quantidade`),
        tipoComercializacao: tipo,
        precoM3: decimalTexto(item.precoM3, `${prefix} preço`, 2),
        componentesPacote,
      },
      calculo: {
        tipoComercializacao: tipo,
        madeiraNome: item.madeiraNome,
        espessuraMm: decimalTexto(item.espessura, `${prefix} espessura`, 2),
        larguraMm: decimalTexto(item.largura, `${prefix} largura`, 2),
        comprimentoMetros: decimalTexto(item.comprimento, `${prefix} comprimento`, 2),
        quantidade: validarQuantidade(item.quantidade, `${prefix} quantidade`),
        preco: decimalTexto(item.precoM3, `${prefix} preço`, 2),
        componentesPacote,
      },
    };
  });

  const aproveitamentosNormalizados = (input.aproveitamentos ?? []).map((item, index) => ({
    madeiraNome: validarTexto(item.madeiraNome, `Aproveitamento ${index + 1} madeira`, 200),
    volume: decimalNumeroTexto(item.volume, `Aproveitamento ${index + 1} volume`, 3),
    precoM3: decimalNumeroTexto(item.precoM3, `Aproveitamento ${index + 1} preço`, 2),
  }));

  const desconto = decimalTexto(input.desconto, "Desconto", 2);
  const fretePorTonelada = decimalTexto(input.fretePorTonelada, "Frete por tonelada", 2);
  const pesoCargaToneladas = decimalTexto(input.pesoCargaToneladas, "Peso da carga", 3);
  const comissaoValor = decimalTexto(input.comissaoValor, "Comissão", 2);
  const comissaoTipo = input.comissaoTipo;
  if (comissaoTipo !== "percentual" && comissaoTipo !== "fixo") throw new Error("Tipo de comissão inválido");

  const resultado = calcularComercial({
    itens: itensNormalizados.map((item) => item.calculo),
    aproveitamentos: aproveitamentosNormalizados,
    desconto,
    fretePorTonelada,
    pesoCargaToneladas,
    comissao: { tipo: comissaoTipo, valor: comissaoValor },
    taxas,
  });
  if (resultado.totalPecas > INT_MAX) throw new Error("Quantidade total de peças excede o limite da coluna");

  const itens = resultado.itens.map((calculado, index): ItemComercialPreparado => {
    const original = itensNormalizados[index].persistencia;
    return {
      ...original,
      madeiraNome: calculado.madeiraNome,
      // A coluna também é usada para exibição histórica; não participa do cálculo.
      unidadesPorComercializacao: original.tipoComercializacao === "metro_cubico"
        ? 0
        : calculado.unidadesPorComercializacao,
      precoM3: formatarEscala(original.precoM3, 2),
      espessura: formatarEscala(original.espessura, 2),
      largura: formatarEscala(original.largura, 2),
      comprimento: formatarEscala(original.comprimento, 2),
      precoLinear: calculado.precoLinear,
      valorPeca: calculado.valorPeca,
      valorTotal: calculado.valorTotal,
      componentesPacote: calculado.componentesPacote.map((component) => ({
        ...component,
        espessura: dimensaoComponente(component.espessura, "Espessura do componente"),
        largura: dimensaoComponente(component.largura, "Largura do componente"),
        comprimento: dimensaoComponente(component.comprimento, "Comprimento do componente"),
      })),
    };
  });

  const taxasAdicionais = resultado.taxasCalculadas.map((taxa, index) => ({
    descricao: taxa.descricao,
    tipo: taxas[index].tipo,
    valor: formatarEscala(decimalTexto(taxas[index].valor, `Taxa ${index + 1} valor`, 4), 4),
    calculado: taxa.calculado,
    ordem: index,
  }));
  const usaTaxaLegada = taxaLegada !== undefined;
  const taxaLegadaCalculada = usaTaxaLegada ? resultado.taxasCalculadas[0]?.calculado ?? "0.00" : "0.00";

  return {
    cabecalho: {
      clienteId,
      tipoVenda,
      versaoCalculoComercial: 1,
      desconto: formatarEscala(resultado.desconto, 2),
      frete: resultado.abatimentoFrete,
      fretePorTonelada: formatarEscala(fretePorTonelada, 2),
      pesoCargaToneladas: formatarEscala(pesoCargaToneladas, 3),
      abatimentoFrete: resultado.abatimentoFrete,
      baseAposFrete: resultado.baseAposFrete,
      comissaoTipo,
      comissaoValor: formatarEscala(comissaoValor, 2),
      comissaoCalculada: resultado.comissaoCalculada,
      taxaDescricao: usaTaxaLegada ? taxaLegada.descricao : null,
      taxaTipo: usaTaxaLegada ? taxaLegada.tipo : "percentual",
      taxaValor: usaTaxaLegada ? formatarEscala(taxaLegada.valor, 2) : "0.00",
      taxaCalculada: usaTaxaLegada ? taxaLegadaCalculada : resultado.taxaCalculada,
      subtotal: resultado.subtotal,
      total: resultado.total,
      totalPecas: resultado.totalPecas,
      totalMetroLinear: resultado.totalMetroLinear,
      totalVolume: resultado.totalVolume,
    },
    itens,
    aproveitamentos: resultado.aproveitamentos,
    taxasAdicionais,
  };
}
