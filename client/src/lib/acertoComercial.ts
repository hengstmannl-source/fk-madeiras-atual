export type TipoAjusteComercial = "percentual" | "fixo";

export type TaxaAdicionalComercial = {
  descricao: string;
  tipo: TipoAjusteComercial;
  valor: string;
};

function numero(valor: string) {
  return Number(valor.replace(",", ".")) || 0;
}

export function calcularAcertoComercial(input: {
  subtotal: number;
  desconto: string;
  fretePorTonelada: string;
  pesoCargaToneladas: string;
  comissaoTipo: TipoAjusteComercial;
  comissaoValor: string;
  taxas?: TaxaAdicionalComercial[];
  /** Compatibilidade com a taxa única dos pedidos criados antes do novo modelo. */
  taxaTipo?: TipoAjusteComercial;
  taxaValor?: string;
}) {
  const desconto = numero(input.desconto);
  const fretePorTonelada = numero(input.fretePorTonelada);
  const pesoCargaToneladas = numero(input.pesoCargaToneladas);
  const abatimentoFrete = fretePorTonelada * pesoCargaToneladas;
  const baseAposFrete = Math.max(0, input.subtotal - desconto - abatimentoFrete);
  const comissaoInformada = numero(input.comissaoValor);
  const comissaoCalculada = input.comissaoTipo === "percentual" ? baseAposFrete * comissaoInformada / 100 : comissaoInformada;
  const taxasInformadas = input.taxas ?? [{ descricao: "", tipo: input.taxaTipo ?? "percentual", valor: input.taxaValor ?? "0" }];
  const taxasCalculadas = taxasInformadas.map((taxa) => {
    const valor = numero(taxa.valor);
    return {
      ...taxa,
      calculado: taxa.tipo === "percentual" ? baseAposFrete * valor / 100 : valor,
    };
  });
  const taxaCalculada = taxasCalculadas.reduce((total, taxa) => total + taxa.calculado, 0);
  return {
    abatimentoFrete,
    baseAposFrete,
    comissaoCalculada,
    taxaCalculada,
    taxasCalculadas,
    // Taxas comerciais são cobradas do cliente como acréscimos. Comissão,
    // desconto e frete permanecem como deduções da base da venda.
    total: Math.max(0, baseAposFrete - comissaoCalculada + taxaCalculada),
  };
}
