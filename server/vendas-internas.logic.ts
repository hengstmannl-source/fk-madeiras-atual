import { converterDimensoesVendaParaEstoque } from "./producao.logic";

export type ItemReservaVenda = {
  id: number;
  tipoComercializacao: "metro_cubico" | "unidade" | "pacote";
  madeiraNome: string;
  espessura: string | number;
  largura: string | number;
  comprimento: string | number;
  quantidade: number;
};

export type LoteReservaVenda = {
  id: number;
  madeiraNome: string;
  espessura: string | number;
  largura: string | number;
  comprimento: string | number;
  quantidadeDisponivel: number;
  createdAt?: Date | null;
};

export type ReservaAtivaVenda = { loteId: number | null; quantidade: string | number };

export type AlocacaoReservaVenda = {
  itemOrcamentoId: number;
  loteId: number | null;
  chaveReserva: string;
  madeiraNome: string;
  espessura: string;
  largura: string;
  comprimento: string;
  quantidade: string;
};

function quantidadeNumerica(value: string | number): number {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error("Quantidade de reserva inválida");
  return result;
}

function chave(item: Pick<LoteReservaVenda, "madeiraNome" | "espessura" | "largura" | "comprimento">): string {
  return [item.madeiraNome.trim().toLocaleUpperCase("pt-BR"), Number(item.espessura).toFixed(2), Number(item.largura).toFixed(2), Number(item.comprimento).toFixed(2)].join("|");
}

/** Reserva exclusivamente madeira serrada vendida por m³. Unidade e pacote são comerciais, sem estoque serrado. */
export function planejarReservasVendaInterna(input: {
  itens: ItemReservaVenda[];
  lotes: LoteReservaVenda[];
  reservasAtivas: ReservaAtivaVenda[];
}): AlocacaoReservaVenda[] {
  const reservadoPorLote = new Map<number, number>();
  for (const reserva of input.reservasAtivas) {
    if (reserva.loteId != null) reservadoPorLote.set(reserva.loteId, (reservadoPorLote.get(reserva.loteId) ?? 0) + quantidadeNumerica(reserva.quantidade));
  }

  const lotesDisponiveis = input.lotes
    .filter((lote) => lote.quantidadeDisponivel > 0)
    .sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0) || a.id - b.id)
    .map((lote) => ({ ...lote, restante: Math.max(0, lote.quantidadeDisponivel - (reservadoPorLote.get(lote.id) ?? 0)) }));

  const resultado: AlocacaoReservaVenda[] = [];
  for (const item of input.itens) {
    if (item.tipoComercializacao !== "metro_cubico") continue;
    if (!Number.isSafeInteger(item.id) || item.id <= 0 || !Number.isInteger(item.quantidade) || item.quantidade <= 0) {
      throw new Error("Item de madeira serrada inválido para reserva");
    }
    const dimensoesEstoque = converterDimensoesVendaParaEstoque(item);
    const geometria = {
      madeiraNome: dimensoesEstoque.madeiraNome,
      espessura: dimensoesEstoque.espessura,
      largura: dimensoesEstoque.largura,
      comprimento: dimensoesEstoque.comprimento,
    };
    const candidatos = lotesDisponiveis.filter((lote) => chave(lote) === chave(geometria));
    let restante = item.quantidade;
    for (const lote of candidatos) {
      if (restante <= 0) break;
      const alocado = Math.min(restante, lote.restante);
      if (alocado <= 0) continue;
      resultado.push({
        itemOrcamentoId: item.id,
        loteId: lote.id,
        chaveReserva: `item-${item.id}-lote-${lote.id}`,
        madeiraNome: geometria.madeiraNome,
        espessura: Number(geometria.espessura).toFixed(2),
        largura: Number(geometria.largura).toFixed(2),
        comprimento: Number(geometria.comprimento).toFixed(2),
        quantidade: alocado.toFixed(6),
      });
      lote.restante -= alocado;
      restante -= alocado;
    }
    if (restante > 0) {
      resultado.push({
        itemOrcamentoId: item.id,
        loteId: null,
        chaveReserva: `item-${item.id}-deficit`,
        madeiraNome: geometria.madeiraNome,
        espessura: Number(geometria.espessura).toFixed(2),
        largura: Number(geometria.largura).toFixed(2),
        comprimento: Number(geometria.comprimento).toFixed(2),
        quantidade: restante.toFixed(6),
      });
    }
  }
  return resultado;
}

function valorEmCentavos(value: string | number, label: string): bigint {
  const text = String(value).trim().replace(",", ".");
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error(`${label} inválido`);
  const cents = BigInt(match[2]) * BigInt(100) + BigInt((match[3] ?? "").padEnd(2, "0") || "0");
  return match[1] ? -cents : cents;
}

export function valorMonetarioEmCentavos(value: string | number, label: string): bigint {
  return valorEmCentavos(value, label);
}

function formatarCentavos(value: bigint): string {
  const sinal = value < BigInt(0) ? "-" : "";
  const absoluto = value < BigInt(0) ? -value : value;
  return `${sinal}${absoluto / BigInt(100)}.${String(absoluto % BigInt(100)).padStart(2, "0")}`;
}

export type TituloParaAjusteVenda = {
  id: number;
  valorDevido: string;
  valorPago: string;
  ordem: number;
};

export type AjusteTituloVenda = { tituloId: number; valorAjuste: string; novoValorDevido: string };

/** Planeja ajustes sem apagar baixas: aumentos viram um recebível separado; reduções só diminuem saldo ainda aberto. */
export function planejarAjusteFinanceiroRevisao(input: {
  totalNovo: string;
  titulos: TituloParaAjusteVenda[];
}): { delta: string; novosValores: AjusteTituloVenda[]; saldoPago: string } {
  const novoTotal = valorEmCentavos(input.totalNovo, "Total revisado");
  if (novoTotal < BigInt(0)) throw new Error("Total revisado não pode ser negativo");
  const titulos = input.titulos.map((titulo) => ({
    ...titulo,
    devido: valorEmCentavos(titulo.valorDevido, "Saldo do título"),
    pago: valorEmCentavos(titulo.valorPago, "Total recebido"),
  }));
  if (titulos.some((titulo) => titulo.pago < BigInt(0) || titulo.devido < titulo.pago)) throw new Error("Estado financeiro inconsistente; regularize os títulos antes da revisão");
  const pago = titulos.reduce((sum, titulo) => sum + titulo.pago, BigInt(0));
  const devido = titulos.reduce((sum, titulo) => sum + titulo.devido, BigInt(0));
  if (novoTotal < pago) throw new Error("O novo total não pode ficar abaixo do valor já recebido; regularize manualmente primeiro");
  const delta = novoTotal - devido;
  if (delta >= BigInt(0)) return { delta: formatarCentavos(delta), novosValores: [], saldoPago: formatarCentavos(pago) };

  let reducao = -delta;
  const novosValores: AjusteTituloVenda[] = [];
  for (const titulo of [...titulos].sort((a, b) => b.ordem - a.ordem || b.id - a.id)) {
    if (reducao === BigInt(0)) break;
    const aberto = titulo.devido - titulo.pago;
    const aplicado = aberto < reducao ? aberto : reducao;
    if (aplicado <= BigInt(0)) continue;
    const novoDevido = titulo.devido - aplicado;
    novosValores.push({ tituloId: titulo.id, valorAjuste: formatarCentavos(-aplicado), novoValorDevido: formatarCentavos(novoDevido) });
    reducao -= aplicado;
  }
  if (reducao !== BigInt(0)) throw new Error("Saldo financeiro aberto insuficiente para aplicar a redução revisada");
  return { delta: formatarCentavos(delta), novosValores, saldoPago: formatarCentavos(pago) };
}
