import {
  calculatePrecoLinear,
  calculateValorPeca,
  calculateValorTotal,
  centimetersToMillimeters,
  formatDimensionCm,
  parseDecimalInput,
} from "@/lib/utils";

export type LinhaComprimentoVenda = {
  id: number;
  comprimento: string;
  quantidade: string;
};

export const comprimentosPadraoVenda = [
  "2", "2,5", "3", "3,5", "4", "4,5", "5", "5,5", "6", "6,5", "7", "7,5", "8", "8,5", "9",
] as const;

export function criarLinhasComprimentoPadraoVenda(): LinhaComprimentoVenda[] {
  return comprimentosPadraoVenda.map((comprimento, indice) => ({
    id: indice + 1,
    comprimento,
    quantidade: "",
  }));
}

export function obterIndiceTabPorColunaVenda(indiceAtual: number, totalLinhas: number, voltar = false): number | null {
  const proximoIndice = indiceAtual + (voltar ? -1 : 1);
  return proximoIndice >= 0 && proximoIndice < totalLinhas ? proximoIndice : null;
}

export type TipoComercializacaoVenda = "metro_cubico" | "unidade" | "pacote";

export const rotulosTipoComercializacaoVenda: Record<TipoComercializacaoVenda, string> = {
  metro_cubico: "Por metro cúbico (m³)",
  unidade: "Por unidade",
  pacote: "Por pacote",
};

export type ItemVendaCalculado = {
  madeiraId: number | null;
  bitolaId: number | null;
  produtoComercialId: number | null;
  madeiraNome: string;
  bitolaDescricao: string;
  espessura: string;
  largura: string;
  comprimento: string;
  quantidade: number;
  tipoComercializacao: TipoComercializacaoVenda;
  unidadesPorComercializacao: number;
  precoM3: string;
  precoLinear: string;
  valorPeca: string;
  valorTotal: string;
  componentesPacote: ComponentePacoteVenda[];
};

export type ComponentePacoteVenda = {
  descricao: string;
  madeiraNome?: string | null;
  espessura?: string | null;
  largura?: string | null;
  comprimento?: string | null;
  quantidade: number;
};

export function criarLinhasComprimentoVazias(inicio = 1, quantidade = 4): LinhaComprimentoVenda[] {
  return Array.from({ length: quantidade }, (_, indice) => ({
    id: inicio + indice,
    comprimento: "",
    quantidade: "",
  }));
}

export type ItemParaResumoPorBitolaVenda = Pick<
  ItemVendaCalculado,
  "bitolaDescricao" | "espessura" | "largura" | "comprimento" | "quantidade" | "tipoComercializacao"
>;

export type ResumoPorBitolaVenda = {
  bitolaDescricao: string;
  quantidadePecas: number;
  volume: number;
  percentualVolume: number;
};

export function resumirItensVendaPorBitola(itens: ItemParaResumoPorBitolaVenda[]): ResumoPorBitolaVenda[] {
  const porBitola = new Map<string, Omit<ResumoPorBitolaVenda, "percentualVolume">>();

  for (const item of itens) {
    if (item.tipoComercializacao !== "metro_cubico") continue;
    const espessura = Number(item.espessura);
    const largura = Number(item.largura);
    const comprimento = Number(item.comprimento);
    const quantidade = Number(item.quantidade);
    if (![espessura, largura, comprimento, quantidade].every(Number.isFinite) || quantidade <= 0) continue;

    const atual = porBitola.get(item.bitolaDescricao) ?? {
      bitolaDescricao: item.bitolaDescricao,
      quantidadePecas: 0,
      volume: 0,
    };
    atual.quantidadePecas += quantidade;
    atual.volume += (espessura / 1000) * (largura / 1000) * comprimento * quantidade;
    porBitola.set(item.bitolaDescricao, atual);
  }

  const resumo = Array.from(porBitola.values());
  const volumeTotal = resumo.reduce((total, item) => total + item.volume, 0);
  return resumo.map((item) => ({
    ...item,
    percentualVolume: volumeTotal > 0 ? (item.volume / volumeTotal) * 100 : 0,
  }));
}

export function criarItensVendaPorMedida(input: {
  madeiraId?: number | null;
  madeiraNome: string;
  precoM3: string;
  espessuraCm: string;
  larguraCm: string;
  linhas: LinhaComprimentoVenda[];
}): { itens: ItemVendaCalculado[]; erro?: string } {
  const madeiraNome = input.madeiraNome.trim();
  if (!madeiraNome) return { itens: [], erro: "Informe o nome da madeira" };

  const precoM3 = parseDecimalInput(input.precoM3);
  if (!Number.isFinite(precoM3) || precoM3 <= 0) return { itens: [], erro: "Informe um preço por m³ válido" };

  const espessuraCm = parseDecimalInput(input.espessuraCm);
  const larguraCm = parseDecimalInput(input.larguraCm);
  if (!Number.isFinite(espessuraCm) || espessuraCm <= 0 || !Number.isFinite(larguraCm) || larguraCm <= 0) {
    return { itens: [], erro: "Introduza bitola e largura válidas em centímetros" };
  }

  const linhasComQuantidade = input.linhas.filter((linha) => linha.quantidade.trim());
  if (!linhasComQuantidade.length) return { itens: [], erro: "Informe a quantidade de peças em pelo menos um comprimento" };

  const linhasInvalidas = linhasComQuantidade.some((linha) => {
    const comprimento = parseDecimalInput(linha.comprimento);
    const quantidade = Number.parseInt(linha.quantidade, 10);
    return !Number.isFinite(comprimento) || comprimento <= 0 || !Number.isInteger(quantidade) || quantidade <= 0;
  });
  if (linhasInvalidas) return { itens: [], erro: "Revise os comprimentos e as quantidades preenchidas" };

  // As vendas permanecem em milímetros para manter a compatibilidade com os registros e a entrega física existente.
  const espessura = centimetersToMillimeters(espessuraCm);
  const largura = centimetersToMillimeters(larguraCm);
  const precoLinear = calculatePrecoLinear(espessura, largura, precoM3);

  return {
    itens: linhasComQuantidade.map((linha) => {
      const comprimento = parseDecimalInput(linha.comprimento);
      const quantidade = Number.parseInt(linha.quantidade, 10);
      const valorPeca = calculateValorPeca(precoLinear, comprimento);
      const valorTotal = calculateValorTotal(valorPeca, quantidade);
      return {
        madeiraId: input.madeiraId ?? null,
        bitolaId: null,
        produtoComercialId: null,
        madeiraNome,
        bitolaDescricao: `${formatDimensionCm(espessura)}×${formatDimensionCm(largura)} cm`,
        espessura: String(espessura),
        largura: String(largura),
        comprimento: String(comprimento),
        quantidade,
        tipoComercializacao: "metro_cubico",
        unidadesPorComercializacao: 1,
        precoM3: String(precoM3),
        precoLinear: String(parseFloat(precoLinear.toFixed(4))),
        valorPeca: String(parseFloat(valorPeca.toFixed(2))),
        valorTotal: String(parseFloat(valorTotal.toFixed(2))),
        componentesPacote: [],
      };
    }),
  };
}

/**
 * Itens avulsos não usam a métrica física do estoque serrado. O campo
 * precoM3 é mantido por compatibilidade com vendas históricas, mas passa a
 * guardar o preço da unidade comercial escolhida.
 */
export function criarItemVendaComercial(input: {
  madeiraNome: string;
  tipoComercializacao: Exclude<TipoComercializacaoVenda, "metro_cubico">;
  quantidade: string;
  precoComercial: string;
  produtoComercialId?: number | null;
  componentesPacote?: ComponentePacoteVenda[];
}): { item?: ItemVendaCalculado; erro?: string } {
  const madeiraNome = input.madeiraNome.trim();
  if (madeiraNome.length < 2) return { erro: "Informe o produto ou a madeira" };
  const quantidade = Number.parseInt(input.quantidade, 10);
  if (!Number.isInteger(quantidade) || quantidade <= 0) return { erro: "Informe uma quantidade inteira positiva" };
  const precoComercial = parseDecimalInput(input.precoComercial);
  if (!Number.isFinite(precoComercial) || precoComercial < 0) return { erro: "Informe um preço comercial válido" };
  const componentesPacote = input.componentesPacote ?? [];
  if (input.tipoComercializacao === "pacote" && !componentesPacote.length) return { erro: "Informe a composição do pacote" };

  const unidade = input.tipoComercializacao === "unidade" ? "unidade" : "pacote";
  return {
    item: {
      madeiraId: null,
      bitolaId: null,
      produtoComercialId: input.produtoComercialId ?? null,
      madeiraNome,
      bitolaDescricao: `Venda por ${unidade}`,
      espessura: "0",
      largura: "0",
      comprimento: "0",
      quantidade,
      tipoComercializacao: input.tipoComercializacao,
      unidadesPorComercializacao: input.tipoComercializacao === "pacote" ? componentesPacote.reduce((total, componente) => total + componente.quantidade, 0) : 1,
      precoM3: String(precoComercial),
      precoLinear: "0",
      valorPeca: String(parseFloat(precoComercial.toFixed(2))),
      valorTotal: String(parseFloat((precoComercial * quantidade).toFixed(2))),
      componentesPacote,
    },
  };
}
