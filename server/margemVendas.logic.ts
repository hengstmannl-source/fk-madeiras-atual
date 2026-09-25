export type TaxaMargemComercial = { calculado: string | number | null | undefined };

function numeroSeguro(valor: string | number | null | undefined) {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

/**
 * Separa a receita da madeira da composição de cobrança do pedido. Frete
 * comercial e comissão reduzem o valor efetivamente retido da venda de
 * madeira; taxas adicionais permanecem fora dessa receita, pois são valores
 * acrescidos ao pedido e cobrados do cliente. Nenhum custo é inferido aqui.
 */
export function calcularReceitaLiquidaMadeiraVenda(input: {
  subtotal: string | number | null | undefined;
  desconto: string | number | null | undefined;
  abatimentoFrete: string | number | null | undefined;
  comissaoCalculada: string | number | null | undefined;
  totalVolumeM3: string | number | null | undefined;
  taxas?: TaxaMargemComercial[];
}) {
  const receitaBrutaMadeira = numeroSeguro(input.subtotal);
  const descontoComercial = numeroSeguro(input.desconto);
  const freteComercial = numeroSeguro(input.abatimentoFrete);
  const comissao = numeroSeguro(input.comissaoCalculada);
  const volumeVendidoM3 = numeroSeguro(input.totalVolumeM3);
  const taxasCobradasAoCliente = (input.taxas ?? []).reduce((acumulado, taxa) => acumulado + numeroSeguro(taxa.calculado), 0);
  const deducoesDaReceitaMadeira = descontoComercial + freteComercial + comissao;
  const receitaLiquidaMadeira = receitaBrutaMadeira - deducoesDaReceitaMadeira;

  return {
    receitaBrutaMadeira,
    descontoComercial,
    freteComercial,
    comissao,
    deducoesDaReceitaMadeira,
    receitaLiquidaMadeira,
    volumeVendidoM3,
    precoLiquidoMadeiraPorM3: volumeVendidoM3 > 0 ? receitaLiquidaMadeira / volumeVendidoM3 : null,
    taxasCobradasAoCliente,
  };
}

/**
 * Calcula a margem comercial líquida perante o valor bruto da venda. Como o
 * sistema não associa ainda o custo de aquisição a cada venda, este indicador
 * mede o valor final da venda após descontos e acréscimos comerciais, e não a
 * margem contábil de lucro baseada em custo de mercadoria vendida.
 */
export function calcularIndicadoresMargemVenda(input: {
  subtotal: string | number | null | undefined;
  desconto: string | number | null | undefined;
  abatimentoFrete: string | number | null | undefined;
  comissaoCalculada: string | number | null | undefined;
  taxas: TaxaMargemComercial[];
  total: string | number | null | undefined;
}) {
  const subtotal = numeroSeguro(input.subtotal);
  const desconto = numeroSeguro(input.desconto);
  const abatimentoFrete = numeroSeguro(input.abatimentoFrete);
  const comissao = numeroSeguro(input.comissaoCalculada);
  const totalTaxas = input.taxas.reduce((acumulado, taxa) => acumulado + numeroSeguro(taxa.calculado), 0);
  const valorLiquido = numeroSeguro(input.total);
  const deducoesComerciais = desconto + abatimentoFrete + comissao;
  const margemPercentual = subtotal > 0 ? (valorLiquido / subtotal) * 100 : 0;

  return { subtotal, desconto, abatimentoFrete, comissao, totalTaxas, acrescimosComerciais: totalTaxas, valorLiquido, deducoesComerciais, margemPercentual };
}
