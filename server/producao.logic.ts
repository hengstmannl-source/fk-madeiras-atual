import { calcularAproveitamentoPorEssencia } from "@shared/aproveitamentoPorEssencia";

export type ItemProducaoEntrada = {
  madeiraNome: string;
  espessura: string | number;
  largura: string | number;
  comprimento: string | number;
  quantidade: number;
};

export type AproveitamentoProducaoEntrada = {
  madeiraNome: string;
  volume: string | number;
};

export type PlaquetaParaConfirmacao = {
  id?: number;
  codigo: string;
  estado: "disponivel" | "consumida" | "cancelada";
  volumeDisponivel: string | number;
  madeiraNome?: string;
  diametro?: string | number | null;
  comprimento?: string | number | null;
};

export type ToraParaRomaneio = {
  madeiraNome: string;
  diametro?: string | number | null;
  espessura?: string | number | null;
  largura?: string | number | null;
  comprimento?: string | number | null;
  volume: string | number;
};

function numero(valor: string | number): number {
  const convertido = typeof valor === "string" ? Number(valor.replace(",", ".")) : valor;
  return Number.isFinite(convertido) ? convertido : 0;
}

export function calcularVolumeToraCilindrica(diametroCm: string | number, comprimentoM: string | number): number {
  const diametro = numero(diametroCm);
  const comprimento = numero(comprimentoM);
  if (diametro <= 0 || comprimento <= 0) {
    throw new Error("Informe diâmetro e comprimento positivos para a tora");
  }
  const raioEmMetros = (diametro / 100) / 2;
  return Math.PI * raioEmMetros ** 2 * comprimento;
}

export function calcularValorTora(volume: string | number, valorMetroCubico: string | number): number {
  const volumeNumerico = numero(volume);
  const preco = numero(valorMetroCubico);
  if (volumeNumerico < 0 || preco < 0) throw new Error("Volume e valor por m³ não podem ser negativos");
  return Number((volumeNumerico * preco).toFixed(2));
}

export function normalizarCodigoPlaqueta(codigo: string): string {
  return codigo.trim().toLocaleUpperCase("pt-BR").replace(/\s+/g, "-");
}

export function calcularItemRomaneio(item: ItemProducaoEntrada) {
  const espessura = numero(item.espessura);
  const largura = numero(item.largura);
  const comprimento = numero(item.comprimento);
  const quantidade = Number(item.quantidade);
  if (!item.madeiraNome.trim()) throw new Error("Informe a madeira produzida");
  if (espessura <= 0 || largura <= 0 || comprimento <= 0 || !Number.isInteger(quantidade) || quantidade <= 0) {
    throw new Error("Informe dimensões positivas e uma quantidade inteira para cada item produzido");
  }
  const metrosLineares = comprimento * quantidade;
  const volume = (espessura * largura * metrosLineares) / 10_000;
  return {
    madeiraNome: item.madeiraNome.trim(),
    espessura,
    largura,
    comprimento,
    quantidade,
    metrosLineares: Number(metrosLineares.toFixed(4)),
    volume: Number(volume.toFixed(6)),
  };
}

export function validarSerragemTerceiros(input: {
  toras: Array<{ referencia?: string; madeiraNome: string; diametro?: string | number | null; comprimento?: string | number | null; volume?: string | number }>;
  itens: ItemProducaoEntrada[];
}) {
  if (!input.toras.length) throw new Error("Informe ao menos uma tora do cliente para a serragem");
  if (!input.itens.length) throw new Error("Adicione ao menos uma peça serrada");
  const referencias = new Set<string>();
  const toras = input.toras.map((tora) => {
    const referencia = tora.referencia?.trim() || "-";
    if (!tora.madeiraNome.trim()) throw new Error("Informe uma essência válida para cada tora");
    const referenciaNormalizada = referencia.toLocaleUpperCase("pt-BR");
    const referenciaNaoInformada = referencia === "-";
    if (!referenciaNaoInformada && referencias.has(referenciaNormalizada)) throw new Error(`A tora ${referencia} foi informada mais de uma vez`);
    if (!referenciaNaoInformada) referencias.add(referenciaNormalizada);
    const volume = calcularVolumeToraCilindrica(tora.diametro ?? 0, tora.comprimento ?? 0);
    return {
      ...tora,
      referencia,
      madeiraNome: tora.madeiraNome.trim(),
      diametro: Number(numero(tora.diametro ?? 0).toFixed(2)),
      comprimento: Number(numero(tora.comprimento ?? 0).toFixed(2)),
      volume: Number(volume.toFixed(6)),
    };
  });
  const itens = input.itens.map(calcularItemRomaneio);
  const volumeToras = Number(toras.reduce((total, tora) => total + tora.volume, 0).toFixed(6));
  const volumeProduzido = Number(itens.reduce((total, item) => total + item.volume, 0).toFixed(6));
  if (volumeProduzido > volumeToras + 0.000001) throw new Error("O volume produzido não pode exceder o volume das toras do cliente");
  const aproveitamentoPorEssencia = calcularAproveitamentoPorEssencia(toras, itens);
  if (aproveitamentoPorEssencia.some((resumo) => resumo.volumeProduzido > resumo.volumeToras + 0.000001)) {
    throw new Error("O volume produzido de uma essência não pode exceder o volume das toras desta essência");
  }
  return { toras, itens, volumeToras, volumeProduzido, aproveitamento: Number(((volumeProduzido / volumeToras) * 100).toFixed(2)), aproveitamentoPorEssencia };
}

export function validarRetiradaSerragemTerceiros(input: { itens: Array<{ loteId: number; quantidade: number }> }) {
  if (!input.itens.length) throw new Error("Selecione ao menos uma peça para retirada");
  const lotes = new Set<number>();
  return input.itens.map((item) => {
    if (!Number.isInteger(item.loteId) || item.loteId <= 0) throw new Error("Selecione uma peça válida para retirada");
    if (!Number.isInteger(item.quantidade) || item.quantidade <= 0) throw new Error("Informe uma quantidade inteira positiva para cada peça retirada");
    if (lotes.has(item.loteId)) throw new Error("A mesma peça foi informada mais de uma vez na retirada");
    lotes.add(item.loteId);
    return item;
  });
}

export function validarConfirmacaoRomaneio(input: {
  plaqueta?: PlaquetaParaConfirmacao | null | undefined;
  tora?: ToraParaRomaneio;
  toras?: Array<{ plaqueta: PlaquetaParaConfirmacao | null | undefined; tora: ToraParaRomaneio }>;
  itens: ItemProducaoEntrada[];
  aproveitamentos?: AproveitamentoProducaoEntrada[];
  incluirAproveitamentoNoRendimento?: boolean;
  permitirPlaquetasConsumidas?: boolean;
}) {
  const entradasToras = input.toras ?? (input.plaqueta && input.tora ? [{ plaqueta: input.plaqueta, tora: input.tora }] : []);
  if (!entradasToras.length) throw new Error("Selecione ao menos uma plaqueta para o romaneio");
  if (!input.itens.length) throw new Error("Adicione ao menos uma peça produzida ao romaneio");
  const codigos = new Set<string>();
  const toras = entradasToras.map(({ plaqueta, tora }) => {
    if (!plaqueta) throw new Error("Selecione uma plaqueta para o romaneio");
    if (!input.permitirPlaquetasConsumidas && plaqueta.estado !== "disponivel") throw new Error(`A plaqueta ${plaqueta.codigo} não está disponível para produção`);
    const codigo = normalizarCodigoPlaqueta(plaqueta.codigo);
    if (codigos.has(codigo)) throw new Error(`A plaqueta ${plaqueta.codigo} foi selecionada mais de uma vez`);
    codigos.add(codigo);
    const volume = numero(tora.volume);
    const volumeDisponivel = numero(plaqueta.volumeDisponivel);
    if (!tora.madeiraNome?.trim() || volume <= 0) throw new Error("Informe a essência e o volume válido de cada tora para o romaneio");
    if (!input.permitirPlaquetasConsumidas && volume > volumeDisponivel + 0.000001) {
      throw new Error(`O volume informado para a plaqueta ${plaqueta.codigo} excede o volume disponível em estoque`);
    }
    return { plaqueta, tora, volume: Number(volume.toFixed(6)) };
  });
  const itens = input.itens.map(calcularItemRomaneio);
  const volumeProduzido = itens.reduce((total, item) => total + item.volume, 0);
  const aproveitamentos = (input.aproveitamentos ?? []).filter((item) => item.madeiraNome.trim() || numero(item.volume) > 0).map((item) => {
    const volume = numero(item.volume);
    if (!item.madeiraNome.trim() || volume <= 0) throw new Error("Informe a essência e o volume positivo para cada aproveitamento");
    return { madeiraNome: item.madeiraNome.trim(), volume: Number(volume.toFixed(6)) };
  });
  const volumeAproveitamento = aproveitamentos.reduce((total, item) => total + item.volume, 0);
  const volumeComAproveitamento = volumeProduzido + volumeAproveitamento;
  const volumeTora = toras.reduce((total, entrada) => total + entrada.volume, 0);
  if (volumeComAproveitamento > volumeTora + 0.000001) {
    throw new Error(`A produção com aproveitamento (${volumeComAproveitamento.toFixed(6)} m³) excede o volume total das toras (${volumeTora.toFixed(6)} m³)`);
  }
  const aproveitamentoPorEssencia = calcularAproveitamentoPorEssencia(toras.map((entrada) => ({ madeiraNome: entrada.tora.madeiraNome, volume: entrada.volume })), itens).map((resumo) => {
    const volumeAproveitamentoEssencia = aproveitamentos.filter((item) => item.madeiraNome.localeCompare(resumo.essencia, "pt-BR", { sensitivity: "accent" }) === 0).reduce((total, item) => total + item.volume, 0);
    return { ...resumo, volumeAproveitamento: Number(volumeAproveitamentoEssencia.toFixed(6)), volumeComAproveitamento: Number((resumo.volumeProduzido + volumeAproveitamentoEssencia).toFixed(6)) };
  });
  if (aproveitamentoPorEssencia.some((resumo) => resumo.volumeComAproveitamento > resumo.volumeToras + 0.000001)) {
    throw new Error("A produção com aproveitamento de uma essência não pode exceder o volume de suas toras");
  }
  const incluirAproveitamentoNoRendimento = Boolean(input.incluirAproveitamentoNoRendimento);
  const volumeParaRendimento = incluirAproveitamentoNoRendimento ? volumeComAproveitamento : volumeProduzido;
  return {
    toras,
    totalToras: toras.length,
    itens,
    aproveitamentos,
    totalPecas: itens.reduce((total, item) => total + item.quantidade, 0),
    metrosLineares: Number(itens.reduce((total, item) => total + item.metrosLineares, 0).toFixed(4)),
    volumeProduzido: Number(volumeProduzido.toFixed(6)),
    volumeAproveitamento: Number(volumeAproveitamento.toFixed(6)),
    volumeComAproveitamento: Number(volumeComAproveitamento.toFixed(6)),
    incluirAproveitamentoNoRendimento,
    volumeTora: Number(volumeTora.toFixed(6)),
    volumeRemanescente: Number((volumeTora - volumeComAproveitamento).toFixed(6)),
    aproveitamento: Number(((volumeParaRendimento / volumeTora) * 100).toFixed(2)),
    aproveitamentoPorEssencia,
  };
}

export function validarExclusaoRomaneioProducao(input: {
  possuiMovimentacoesPosteriores: boolean;
  saldoDasPecasFoiAlterado: boolean;
}) {
  if (input.possuiMovimentacoesPosteriores || input.saldoDasPecasFoiAlterado) {
    throw new Error("Esta produção diária possui peças já movimentadas no estoque e não pode ser removida. Estorne as saídas ou os ajustes vinculados antes de excluir o romaneio.");
  }
}

export function agruparEstoquePecas(lotes: Array<{
  madeiraNome: string;
  espessura: string | number;
  largura: string | number;
  comprimento: string | number;
  quantidadeDisponivel: number;
  quantidadeProduzida?: number;
  volume: string | number;
  propriedade?: "proprio" | "terceiro";
  clienteProprietarioId?: number | null;
}>) {
  const grupos = new Map<string, { madeiraNome: string; espessura: number; largura: number; comprimento: number; propriedade: "proprio" | "terceiro"; clienteProprietarioId: number | null; quantidadeEntrada: number; quantidadeSaida: number; quantidadeDisponivel: number; volumeDisponivel: number }>();
  lotes.forEach((lote) => {
    const espessura = numero(lote.espessura);
    const largura = numero(lote.largura);
    const comprimento = numero(lote.comprimento);
    const propriedade = lote.propriedade ?? "proprio";
    const clienteProprietarioId = lote.clienteProprietarioId ?? null;
    const chave = [lote.madeiraNome.trim().toLocaleUpperCase("pt-BR"), espessura, largura, comprimento, propriedade, clienteProprietarioId ?? ""].join("|");
    const existente = grupos.get(chave) ?? { madeiraNome: lote.madeiraNome, espessura, largura, comprimento, propriedade, clienteProprietarioId, quantidadeEntrada: 0, quantidadeSaida: 0, quantidadeDisponivel: 0, volumeDisponivel: 0 };
    existente.quantidadeDisponivel += lote.quantidadeDisponivel;
    const quantidadeProduzida = Math.abs(Number(lote.quantidadeProduzida ?? 0));
    const quantidadeEntrada = quantidadeProduzida > 0 ? quantidadeProduzida : Math.max(lote.quantidadeDisponivel, 0);
    const quantidadeSaida = quantidadeProduzida > 0
      ? Math.max(0, quantidadeProduzida - lote.quantidadeDisponivel)
      : Math.max(0, -lote.quantidadeDisponivel);
    existente.quantidadeEntrada += quantidadeEntrada;
    existente.quantidadeSaida += quantidadeSaida;
    const quantidadeDeReferencia = quantidadeProduzida > 0 ? quantidadeProduzida : Math.max(Math.abs(lote.quantidadeDisponivel), 1);
    const volumeUnitario = numero(lote.volume) / quantidadeDeReferencia;
    existente.volumeDisponivel += volumeUnitario * lote.quantidadeDisponivel;
    grupos.set(chave, existente);
  });
  return Array.from(grupos.values()).map((grupo) => ({ ...grupo, volumeDisponivel: Number(grupo.volumeDisponivel.toFixed(6)) }));
}

export type ItemVendaParaEntrega = {
  id: number;
  madeiraNome: string;
  espessura: string | number;
  largura: string | number;
  comprimento: string | number;
  quantidade: number;
};

/**
 * Vendas históricas guardam espessura e largura em milímetros, enquanto a
 * produção e o estoque serrado trabalham em centímetros. Esta adaptação só
 * é aplicada ao entregar a venda, antes da comparação com os lotes.
 */
export function converterDimensoesVendaParaEstoque(item: ItemVendaParaEntrega): ItemVendaParaEntrega {
  return {
    ...item,
    espessura: numero(item.espessura) / 10,
    largura: numero(item.largura) / 10,
  };
}

export type LoteParaEntrega = {
  id: number;
  madeiraNome: string;
  espessura: string | number;
  largura: string | number;
  comprimento: string | number;
  quantidadeDisponivel: number;
  createdAt?: Date;
};

export type DeficitParaEntrega = {
  itemVendaId: number;
  madeiraNome: string;
  espessura: string | number;
  largura: string | number;
  comprimento: string | number;
  quantidade: number;
};

function chaveDimensao(item: Pick<ItemVendaParaEntrega, "madeiraNome" | "espessura" | "largura" | "comprimento">): string {
  return [
    item.madeiraNome.trim().toLocaleUpperCase("pt-BR"),
    numero(item.espessura).toFixed(2),
    numero(item.largura).toFixed(2),
    numero(item.comprimento).toFixed(2),
  ].join("|");
}

export function alocarPecasPermitindoNegativo(itens: ItemVendaParaEntrega[], lotes: LoteParaEntrega[]) {
  const lotesPorDimensao = new Map<string, LoteParaEntrega[]>();
  [...lotes]
    .filter((lote) => lote.quantidadeDisponivel > 0)
    .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) || a.id - b.id)
    .forEach((lote) => {
      const chave = chaveDimensao(lote);
      const disponiveis = lotesPorDimensao.get(chave) ?? [];
      disponiveis.push(lote);
      lotesPorDimensao.set(chave, disponiveis);
    });

  const consumoLocal = new Map<number, number>();
  const alocacoes: Array<{ itemVendaId: number; loteId: number; quantidade: number }> = [];
  const deficits: DeficitParaEntrega[] = [];
  for (const item of itens) {
    if (!Number.isInteger(item.quantidade) || item.quantidade <= 0) throw new Error("A quantidade do item de venda precisa ser um número inteiro positivo");
    let restante = item.quantidade;
    const disponiveis = lotesPorDimensao.get(chaveDimensao(item)) ?? [];
    for (const lote of disponiveis) {
      const jaConsumido = consumoLocal.get(lote.id) ?? 0;
      const saldo = Math.max(0, lote.quantidadeDisponivel - jaConsumido);
      if (!saldo) continue;
      const quantidade = Math.min(restante, saldo);
      alocacoes.push({ itemVendaId: item.id, loteId: lote.id, quantidade });
      consumoLocal.set(lote.id, jaConsumido + quantidade);
      restante -= quantidade;
      if (!restante) break;
    }
    if (restante) deficits.push({ itemVendaId: item.id, madeiraNome: item.madeiraNome, espessura: item.espessura, largura: item.largura, comprimento: item.comprimento, quantidade: restante });
  }
  return { alocacoes, deficits };
}

export function alocarPecasParaEntrega(itens: ItemVendaParaEntrega[], lotes: LoteParaEntrega[]) {
  const resultado = alocarPecasPermitindoNegativo(itens, lotes);
  if (resultado.deficits.length) {
    const deficit = resultado.deficits[0];
    const descricao = `${deficit.madeiraNome} ${numero(deficit.espessura)}×${numero(deficit.largura)}×${numero(deficit.comprimento)} m`;
    throw new Error(`Estoque insuficiente para entregar ${deficit.quantidade} peça(s) de ${descricao}`);
  }
  return resultado.alocacoes;
}
