export type ComposicaoRomaneioProducao = {
  itens: Array<{
    madeiraNome: string;
    espessura: string | number;
    largura: string | number;
    comprimento: string | number;
    quantidade: string | number;
  }>;
  aproveitamentos: Array<{ madeiraNome: string; volume: string | number }>;
  incluirAproveitamentoNoRendimento: boolean;
};

/**
 * Mantém uma assinatura da parte operacional do romaneio. Se ela não mudou,
 * a edição pode atualizar somente o cabeçalho sem recriar lotes ou movimentos.
 */
export function assinaturaComposicaoRomaneioProducao(composicao: ComposicaoRomaneioProducao) {
  return JSON.stringify({
    itens: composicao.itens.map((item) => ({
      madeiraNome: item.madeiraNome.trim(),
      espessura: String(item.espessura),
      largura: String(item.largura),
      comprimento: String(item.comprimento),
      quantidade: String(item.quantidade),
    })),
    aproveitamentos: composicao.aproveitamentos.map((item) => ({
      madeiraNome: item.madeiraNome.trim(),
      volume: String(item.volume),
    })),
    incluirAproveitamentoNoRendimento: Boolean(composicao.incluirAproveitamentoNoRendimento),
  });
}
