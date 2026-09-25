export type ItemPdfProducao = {
  madeiraNome?: string | null;
  espessura?: string | number | null;
  largura?: string | number | null;
  comprimento?: string | number | null;
  quantidade?: string | number | null;
  metrosLineares?: string | number | null;
  volume?: string | number | null;
};

export type GrupoBitolaPdfProducao = {
  espessura: number;
  largura: number;
  comprimentos: Map<number, number>;
  totalPecas: number;
  volume: number;
  percentualDaEssencia: number;
};

export type ResumoEssenciaPdfProducao = {
  essencia: string;
  totalPecas: number;
  totalMetros: number;
  totalVolume: number;
  comprimentos: number[];
  gruposPorBitola: GrupoBitolaPdfProducao[];
};

function numero(valor: string | number | null | undefined): number {
  const resultado = Number(valor ?? 0);
  return Number.isFinite(resultado) ? resultado : 0;
}

function normalizarEssencia(valor: string | null | undefined): { chave: string; nome: string } {
  const nome = String(valor ?? "").replace(/\s+/g, " ").trim() || "Não informada";
  return {
    nome,
    chave: nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"),
  };
}

/**
 * Separa as peças por essência antes de calcular a participação de cada bitola.
 * Assim, o percentual de uma bitola sempre usa somente o volume produzido
 * daquela mesma essência como denominador.
 */
export function resumirPecasPdfPorEssencia(itens: ItemPdfProducao[]): ResumoEssenciaPdfProducao[] {
  const porEssencia = new Map<string, { essencia: string; itens: ItemPdfProducao[] }>();

  for (const item of itens) {
    const { chave, nome } = normalizarEssencia(item.madeiraNome);
    const grupo = porEssencia.get(chave) ?? { essencia: nome, itens: [] };
    grupo.itens.push(item);
    porEssencia.set(chave, grupo);
  }

  return Array.from(porEssencia.values())
    .map(({ essencia, itens: itensDaEssencia }) => {
      const totalPecas = itensDaEssencia.reduce((total, item) => total + numero(item.quantidade), 0);
      const totalMetros = itensDaEssencia.reduce((total, item) => total + numero(item.metrosLineares), 0);
      const totalVolume = itensDaEssencia.reduce((total, item) => total + numero(item.volume), 0);
      const porBitola = new Map<string, Omit<GrupoBitolaPdfProducao, "percentualDaEssencia">>();

      for (const item of itensDaEssencia) {
        const espessura = numero(item.espessura);
        const largura = numero(item.largura);
        const chave = `${espessura}|${largura}`;
        const grupo = porBitola.get(chave) ?? { espessura, largura, comprimentos: new Map<number, number>(), totalPecas: 0, volume: 0 };
        const comprimento = numero(item.comprimento);
        const quantidade = numero(item.quantidade);
        grupo.comprimentos.set(comprimento, (grupo.comprimentos.get(comprimento) ?? 0) + quantidade);
        grupo.totalPecas += quantidade;
        grupo.volume += numero(item.volume);
        porBitola.set(chave, grupo);
      }

      return {
        essencia,
        totalPecas,
        totalMetros,
        totalVolume,
        comprimentos: Array.from(new Set(itensDaEssencia.map((item) => numero(item.comprimento)).filter((comprimento) => comprimento > 0))).sort((a, b) => a - b),
        gruposPorBitola: Array.from(porBitola.values())
          .sort((a, b) => a.espessura - b.espessura || a.largura - b.largura)
          .map((grupo) => ({ ...grupo, percentualDaEssencia: totalVolume > 0 ? (grupo.volume / totalVolume) * 100 : 0 })),
      };
    })
    .sort((primeiro, segundo) => primeiro.essencia.localeCompare(segundo.essencia, "pt-BR", { sensitivity: "base" }));
}
