import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: string | number | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num || 0)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(num || 0);
}

export function formatNumber(value: string | number | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num || 0)) return "0";
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num || 0);
}

/** Formata medidas físicas sem zeros desnecessários e com no máximo três casas decimais. */
export function formatMeasurement(value: string | number | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : Number(value);
  if (!Number.isFinite(num)) return "0";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(num);
}

export function formatReceivableSaleReference(origem: string | null | undefined, descricao: string | null | undefined): string {
  if (origem !== "orcamento") return "Lançamento não programado";
  const numeroVenda = descricao?.match(/^Venda\s+(.+)$/i)?.[1]?.trim();
  return numeroVenda ? `Venda vinculada · ${numeroVenda}` : "Venda vinculada";
}

/** Converte a dimensão introduzida em centímetros para a unidade interna em milímetros. */
export function centimetersToMillimeters(value: number): number {
  return value * 10;
}

/** Converte a dimensão interna em milímetros para apresentação em centímetros. */
export function millimetersToCentimeters(value: string | number): number {
  const numericValue = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(numericValue) ? numericValue / 10 : 0;
}

export function formatDimensionCm(valueInMillimeters: string | number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(millimetersToCentimeters(valueInMillimeters));
}

/** Aceita notação decimal brasileira, como "2,5", para campos numéricos da interface. */
export function parseDecimalInput(value: string): number {
  return parseFloat(value.trim().replace(",", "."));
}

export function calculatePrecoLinear(espessura: number, largura: number, precoM3: number): number {
  return (espessura / 1000) * (largura / 1000) * precoM3;
}

/** Calcula o preço linear quando as dimensões já estão informadas em centímetros. */
export function calculatePrecoLinearCm(espessuraCm: number, larguraCm: number, precoM3: number): number {
  return (espessuraCm / 100) * (larguraCm / 100) * precoM3;
}

export function calculateValorPeca(precoLinear: number, comprimento: number): number {
  return precoLinear * comprimento;
}

export function calculateValorTotal(valorPeca: number, quantidade: number): number {
  return valorPeca * quantidade;
}

export function calculateVolume(espessura: number, largura: number, comprimento: number, quantidade: number): number {
  return (espessura / 1000) * (largura / 1000) * comprimento * quantidade;
}

/** Calcula o volume quando espessura e largura já estão em centímetros. */
export function calculateVolumeCm(espessuraCm: number, larguraCm: number, comprimento: number, quantidade: number): number {
  return (espessuraCm / 100) * (larguraCm / 100) * comprimento * quantidade;
}

export function calculateMetroLinear(comprimento: number, quantidade: number): number {
  return comprimento * quantidade;
}
