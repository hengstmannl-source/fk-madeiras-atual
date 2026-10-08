import type { ItemVendaCalculado, TipoComercializacaoVenda } from "./vendaItemGroup";
import type { TaxaAdicionalComercial } from "./acertoComercial";

export type FormularioOrcamentoInicial = {
  clienteId: string;
  desconto: string;
  frete: string;
  pesoCargaToneladas: string;
  comissaoTipo: "percentual" | "fixo";
  comissaoValor: string;
  observacoes: string;
  vendedor: string;
  dataValidade: string;
  dataVencimento: string;
  competencia: string;
  itens: ItemVendaCalculado[];
  aproveitamentos: Array<{ madeiraNome: string; volume: string; precoM3: string }>;
  taxasAdicionais: TaxaAdicionalComercial[];
};

type OrigemDuplicacao = {
  orcamento: {
    clienteId: number;
    desconto: string | number;
    fretePorTonelada: string | number | null;
    pesoCargaToneladas: string | number | null;
    comissaoTipo: "percentual" | "fixo";
    comissaoValor: string | number | null;
    taxaDescricao: string | null;
    taxaTipo: "percentual" | "fixo";
    taxaValor: string | number | null;
    observacoes: string | null;
    vendedor: string | null;
    dataValidade: Date | string | null;
    dataVencimento: Date | string | null;
    competencia: Date | string | null;
  };
  itens: Array<{
    madeiraId: number | null;
    bitolaId: number | null;
    produtoComercialId: number | null;
    madeiraNome: string;
    bitolaDescricao: string;
    espessura: string | number;
    largura: string | number;
    comprimento: string | number;
    quantidade: number;
    tipoComercializacao: TipoComercializacaoVenda;
    unidadesPorComercializacao: number;
    precoM3: string | number;
    precoLinear: string | number;
    valorPeca: string | number;
    valorTotal: string | number;
    componentesPacote: Array<{
      descricao: string;
      madeiraNome: string | null;
      espessura: string | number | null;
      largura: string | number | null;
      comprimento: string | number | null;
      quantidadePorPacote: number;
    }>;
  }>;
  aproveitamentos: Array<{ madeiraNome: string; volume: string | number; precoM3: string | number }>;
  taxasAdicionais: Array<{ descricao: string; tipo: "percentual" | "fixo"; valor: string | number }>;
};

function dataParaInput(data: Date | string | null): string {
  if (!data) return "";
  const valor = data instanceof Date ? data : new Date(data);
  if (!Number.isFinite(valor.getTime())) return "";
  const local = new Date(valor.getTime() - valor.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Copia somente valores comerciais; identidade e estado operacional nunca fazem parte do formulário. */
export function mapearOrcamentoParaDuplicacao(origem: OrigemDuplicacao): FormularioOrcamentoInicial {
  const taxas = origem.taxasAdicionais.length
    ? origem.taxasAdicionais.map((taxa) => ({ descricao: taxa.descricao, tipo: taxa.tipo, valor: String(taxa.valor) }))
    : origem.orcamento.taxaDescricao
      ? [{ descricao: origem.orcamento.taxaDescricao, tipo: origem.orcamento.taxaTipo, valor: String(origem.orcamento.taxaValor ?? "0") }]
      : [];

  return {
    clienteId: String(origem.orcamento.clienteId),
    desconto: String(origem.orcamento.desconto),
    frete: String(origem.orcamento.fretePorTonelada ?? "0"),
    pesoCargaToneladas: String(origem.orcamento.pesoCargaToneladas ?? "0"),
    comissaoTipo: origem.orcamento.comissaoTipo,
    comissaoValor: String(origem.orcamento.comissaoValor ?? "0"),
    observacoes: origem.orcamento.observacoes ?? "",
    vendedor: origem.orcamento.vendedor ?? "",
    dataValidade: dataParaInput(origem.orcamento.dataValidade),
    dataVencimento: dataParaInput(origem.orcamento.dataVencimento),
    competencia: dataParaInput(origem.orcamento.competencia),
    itens: origem.itens.map((item) => ({
      madeiraId: item.madeiraId,
      bitolaId: item.bitolaId,
      produtoComercialId: item.produtoComercialId,
      madeiraNome: item.madeiraNome,
      bitolaDescricao: item.bitolaDescricao,
      espessura: String(item.espessura),
      largura: String(item.largura),
      comprimento: String(item.comprimento),
      quantidade: item.quantidade,
      tipoComercializacao: item.tipoComercializacao,
      unidadesPorComercializacao: item.unidadesPorComercializacao,
      precoM3: String(item.precoM3),
      precoLinear: String(item.precoLinear),
      valorPeca: String(item.valorPeca),
      valorTotal: String(item.valorTotal),
      componentesPacote: item.componentesPacote.map((componente) => ({
        descricao: componente.descricao,
        madeiraNome: componente.madeiraNome,
        espessura: componente.espessura == null ? null : String(componente.espessura),
        largura: componente.largura == null ? null : String(componente.largura),
        comprimento: componente.comprimento == null ? null : String(componente.comprimento),
        quantidade: componente.quantidadePorPacote,
      })),
    })),
    aproveitamentos: origem.aproveitamentos.map((item) => ({ madeiraNome: item.madeiraNome, volume: String(item.volume), precoM3: String(item.precoM3) })),
    taxasAdicionais: taxas,
  };
}
