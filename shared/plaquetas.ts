const DIGITOS_SOBRESCRITOS: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
};

export type PlaquetaComIdentificacao = {
  id: number;
  codigo: string;
  codigoFisico?: string | null;
  situacaoIdentificacao?: string | null;
  createdAt?: Date | string | null;
};

export function numeroSobrescrito(numero: number): string {
  return String(numero).split("").map((digito) => DIGITOS_SOBRESCRITOS[digito] ?? digito).join("");
}

export function numerarDuplicidadesPlaquetas<T extends PlaquetaComIdentificacao>(itens: T[]) {
  const grupos = new Map<string, T[]>();
  itens.forEach((item) => {
    const codigoFisico = item.codigoFisico?.trim();
    if (!codigoFisico) return;
    grupos.set(codigoFisico, [...(grupos.get(codigoFisico) ?? []), item]);
  });

  const dadosPorId = new Map<number, { indiceDuplicidade: number | null; totalDuplicidades: number }>();
  grupos.forEach((grupo) => {
    const ordenado = [...grupo].sort((a, b) => {
      const dataA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dataB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dataA - dataB || a.id - b.id;
    });
    ordenado.forEach((item, indice) => dadosPorId.set(item.id, {
      indiceDuplicidade: ordenado.length > 1 ? indice + 1 : null,
      totalDuplicidades: ordenado.length,
    }));
  });

  return itens.map((item) => {
    const dados = dadosPorId.get(item.id) ?? { indiceDuplicidade: null, totalDuplicidades: 0 };
    return {
      ...item,
      situacaoIdentificacao: !item.codigoFisico ? "sem_plaqueta" : dados.totalDuplicidades > 1 ? "duplicada" : "identificada",
      ...dados,
    };
  });
}

export function etiquetaPlaqueta(item: Pick<PlaquetaComIdentificacao, "codigo" | "codigoFisico" | "situacaoIdentificacao"> & { indiceDuplicidade?: number | null }): string {
  if (!item.codigoFisico?.trim()) return item.codigo;
  if (item.situacaoIdentificacao === "duplicada" && (item.indiceDuplicidade ?? 0) > 1) {
    return `${item.codigoFisico}${numeroSobrescrito(item.indiceDuplicidade!)}`;
  }
  return item.codigoFisico;
}
