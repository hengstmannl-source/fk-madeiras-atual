export type VolumePorEssencia = {
  essencia: string;
  volumeToras: number;
  volumeProduzido: number;
  aproveitamento: number;
  perdaVolume: number;
  perdaPercentual: number;
};

type VolumeEntrada = { madeiraNome: string; volume: string | number | null | undefined };

function numero(valor: string | number | null | undefined): number {
  const convertido = typeof valor === "string" ? Number(valor.replace(",", ".")) : Number(valor ?? 0);
  return Number.isFinite(convertido) ? convertido : 0;
}

function chaveEssencia(essencia: string): string {
  return essencia.trim().toLocaleUpperCase("pt-BR");
}

/** Agrupa os volumes de entrada e de produção por essência, ignorando linhas ainda vazias. */
export function calcularAproveitamentoPorEssencia(toras: VolumeEntrada[], itens: VolumeEntrada[]): VolumePorEssencia[] {
  const totais = new Map<string, VolumePorEssencia>();
  const adicionar = (entrada: VolumeEntrada, campo: "volumeToras" | "volumeProduzido") => {
    const essencia = entrada.madeiraNome.trim();
    const volume = numero(entrada.volume);
    if (!essencia || volume <= 0) return;
    const chave = chaveEssencia(essencia);
    const atual = totais.get(chave) ?? { essencia, volumeToras: 0, volumeProduzido: 0, aproveitamento: 0, perdaVolume: 0, perdaPercentual: 0 };
    atual[campo] += volume;
    totais.set(chave, atual);
  };

  toras.forEach((tora) => adicionar(tora, "volumeToras"));
  itens.forEach((item) => adicionar(item, "volumeProduzido"));

  return Array.from(totais.values())
    .map((item) => ({
      ...item,
      volumeToras: Number(item.volumeToras.toFixed(6)),
      volumeProduzido: Number(item.volumeProduzido.toFixed(6)),
      aproveitamento: item.volumeToras > 0 ? Number(((item.volumeProduzido / item.volumeToras) * 100).toFixed(2)) : 0,
      perdaVolume: Number(Math.max(0, item.volumeToras - item.volumeProduzido).toFixed(6)),
      perdaPercentual: item.volumeToras > 0 ? Number((Math.max(0, 1 - (item.volumeProduzido / item.volumeToras)) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => a.essencia.localeCompare(b.essencia, "pt-BR"));
}
