export const TIPOS_CENTRO_CUSTO = ["industrial", "comercial_administrativo", "nao_apropriavel"] as const;

export type TipoCentroCusto = (typeof TIPOS_CENTRO_CUSTO)[number];

export function validarTipoCentroCusto(valor: unknown): asserts valor is TipoCentroCusto {
  if (!TIPOS_CENTRO_CUSTO.includes(valor as TipoCentroCusto)) {
    throw new Error("Tipo de centro de custo inválido.");
  }
}

export function normalizarCodigoCentroCusto(nome: string): string {
  const base = nome.trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 72);
  return base || "CENTRO";
}

export function validarNomeCentroCusto(nome: string): string {
  const normalizado = nome.trim();
  if (!normalizado) throw new Error("Nome do centro de custo é obrigatório.");
  if (normalizado.length > 150) throw new Error("Nome do centro de custo excede o tamanho permitido.");
  return normalizado;
}
