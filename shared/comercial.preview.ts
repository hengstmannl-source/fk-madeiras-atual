import { calcularComercial, type AjusteComercialCalculo, type ItemComercialCalculo, type ResultadoCalculoComercial } from "./comercial.calculator";

export type ItemPreviaComercial = {
  madeiraNome: string;
  espessura: string;
  largura: string;
  comprimento: string;
  quantidade: number;
  tipoComercializacao: ItemComercialCalculo["tipoComercializacao"];
  precoM3: string;
  componentesPacote?: NonNullable<ItemComercialCalculo["componentesPacote"]>;
};

export type AjustePreviaComercial = AjusteComercialCalculo;

/** Browser-safe adapter for the exact same calculation used by the backend. */
export function calcularPreviaComercial(input: {
  itens: ItemPreviaComercial[];
  aproveitamentos: Array<{ madeiraNome: string; volume: string; precoM3: string }>;
  desconto: string;
  fretePorTonelada: string;
  pesoCargaToneladas: string;
  comissao: AjusteComercialCalculo;
  taxas: Array<AjustePreviaComercial & { descricao: string }>;
}): ResultadoCalculoComercial {
  const resultado = calcularComercial({
    itens: input.itens.map((item) => ({
      tipoComercializacao: item.tipoComercializacao,
      madeiraNome: item.madeiraNome,
      espessuraMm: item.espessura,
      larguraMm: item.largura,
      comprimentoMetros: item.comprimento,
      quantidade: item.quantidade,
      preco: item.precoM3,
      componentesPacote: item.componentesPacote,
    })),
    aproveitamentos: input.aproveitamentos,
    desconto: input.desconto,
    fretePorTonelada: input.fretePorTonelada,
    pesoCargaToneladas: input.pesoCargaToneladas,
    comissao: input.comissao,
    taxas: input.taxas,
  });
  return {
    ...resultado,
    // Preserve the persisted display convention: m³ items store zero here;
    // this field is not an input to the commercial calculation.
    itens: resultado.itens.map((item) => ({
      ...item,
      unidadesPorComercializacao: item.tipoComercializacao === "metro_cubico"
        ? 0
        : item.unidadesPorComercializacao,
    })),
  };
}
