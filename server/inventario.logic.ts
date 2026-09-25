export type LoteInventarioSerrado = {
  id: number;
  madeiraNome: string;
  espessura: string | number;
  largura: string | number;
  comprimento: string | number;
  quantidadeProduzida: number;
  quantidadeDisponivel: number;
  volume: string | number;
};

export type MovimentoInventarioSerrado = {
  loteId: number;
  tipo: "entrada_producao" | "saida_entrega" | "estorno_entrega" | "retirada_terceiro" | "ajuste";
  quantidade: number;
  createdAt: Date | string;
};

const numero = (valor: string | number | null | undefined) => Number(String(valor ?? 0).replace(",", ".")) || 0;
const chaveMedida = (lote: Pick<LoteInventarioSerrado, "madeiraNome" | "espessura" | "largura" | "comprimento">) => [
  lote.madeiraNome.trim().toLocaleUpperCase("pt-BR"),
  numero(lote.espessura).toFixed(2),
  numero(lote.largura).toFixed(2),
  numero(lote.comprimento).toFixed(2),
].join("|");

export type LinhaRelatorioInventario = {
  chave: string;
  madeiraNome: string;
  espessura: number;
  largura: number;
  comprimento: number;
  saldoAtual: number;
  volumeAtual: number;
  entradas: number;
  saidas: number;
  estornos: number;
  ajustes: number;
  saldoInicialEstimado: number;
  estoqueMedio: number;
  rotacao: number | null;
  coberturaDias: number | null;
  situacao: "rutura" | "critico" | "baixo" | "adequado";
};

export function calcularRelatorioInventarioSerrado(
  lotes: LoteInventarioSerrado[],
  movimentos: MovimentoInventarioSerrado[],
  diasNoPeriodo: number,
) {
  const lotesPorId = new Map(lotes.map((lote) => [lote.id, lote]));
  const grupos = new Map<string, LinhaRelatorioInventario>();

  for (const lote of lotes) {
    const chave = chaveMedida(lote);
    const grupo = grupos.get(chave) ?? {
      chave,
      madeiraNome: lote.madeiraNome.trim(),
      espessura: numero(lote.espessura),
      largura: numero(lote.largura),
      comprimento: numero(lote.comprimento),
      saldoAtual: 0,
      volumeAtual: 0,
      entradas: 0,
      saidas: 0,
      estornos: 0,
      ajustes: 0,
      saldoInicialEstimado: 0,
      estoqueMedio: 0,
      rotacao: null,
      coberturaDias: null,
      situacao: "adequado" as const,
    };
    const quantidadeReferencia = Math.abs(numero(lote.quantidadeProduzida)) || Math.max(Math.abs(numero(lote.quantidadeDisponivel)), 1);
    grupo.saldoAtual += numero(lote.quantidadeDisponivel);
    grupo.volumeAtual += (numero(lote.volume) / quantidadeReferencia) * numero(lote.quantidadeDisponivel);
    grupos.set(chave, grupo);
  }

  for (const movimento of movimentos) {
    const lote = lotesPorId.get(movimento.loteId);
    if (!lote) continue;
    const grupo = grupos.get(chaveMedida(lote));
    if (!grupo) continue;
    if (movimento.tipo === "entrada_producao") grupo.entradas += movimento.quantidade;
    if (movimento.tipo === "saida_entrega") grupo.saidas += movimento.quantidade;
    if (movimento.tipo === "estorno_entrega") grupo.estornos += movimento.quantidade;
    if (movimento.tipo === "ajuste") grupo.ajustes += movimento.quantidade;
  }

  const linhas = Array.from(grupos.values()).map((grupo) => {
    const saldoInicialEstimado = grupo.saldoAtual - grupo.entradas + grupo.saidas - grupo.estornos - grupo.ajustes;
    const estoqueMedio = Math.max((saldoInicialEstimado + grupo.saldoAtual) / 2, 0);
    const rotacao = estoqueMedio > 0 ? grupo.saidas / estoqueMedio : null;
    const coberturaDias = grupo.saidas > 0 && grupo.saldoAtual > 0 ? grupo.saldoAtual / (grupo.saidas / Math.max(diasNoPeriodo, 1)) : grupo.saldoAtual <= 0 ? 0 : null;
    const situacao: LinhaRelatorioInventario["situacao"] = grupo.saldoAtual <= 0
      ? "rutura"
      : coberturaDias !== null && coberturaDias < 7
        ? "critico"
        : coberturaDias !== null && coberturaDias < 30
          ? "baixo"
          : "adequado";
    return {
      ...grupo,
      saldoAtual: Math.round(grupo.saldoAtual),
      volumeAtual: Number(grupo.volumeAtual.toFixed(6)),
      saldoInicialEstimado: Number(saldoInicialEstimado.toFixed(2)),
      estoqueMedio: Number(estoqueMedio.toFixed(2)),
      rotacao: rotacao === null ? null : Number(rotacao.toFixed(2)),
      coberturaDias: coberturaDias === null ? null : Number(coberturaDias.toFixed(1)),
      situacao,
    };
  }).sort((primeira, segunda) => {
    const ordemSituacao = { rutura: 0, critico: 1, baixo: 2, adequado: 3 };
    return ordemSituacao[primeira.situacao] - ordemSituacao[segunda.situacao]
      || primeira.madeiraNome.localeCompare(segunda.madeiraNome, "pt-BR")
      || primeira.espessura - segunda.espessura
      || primeira.largura - segunda.largura
      || primeira.comprimento - segunda.comprimento;
  });

  return {
    linhas,
    resumo: {
      itensAnalisados: linhas.length,
      itensEmRutura: linhas.filter((linha) => linha.situacao === "rutura").length,
      itensCriticos: linhas.filter((linha) => linha.situacao === "critico" || linha.situacao === "baixo").length,
      pecasEmDeficit: linhas.reduce((total, linha) => total + Math.abs(Math.min(linha.saldoAtual, 0)), 0),
      saidasNoPeriodo: linhas.reduce((total, linha) => total + linha.saidas, 0),
    },
  };
}
