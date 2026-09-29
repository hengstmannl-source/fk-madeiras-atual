/** Data civil usada para vencimentos financeiros do FK Madeiras. */
export type DataFinanceira = Date | string | null | undefined;

export const TIMEZONE_FINANCEIRO = "America/Sao_Paulo";

const DATA_CIVIL = /^\d{4}-\d{2}-\d{2}$/;

export function chaveDataFinanceira(data: DataFinanceira): string | null {
  if (!data) return null;

  if (typeof data === "string" && DATA_CIVIL.test(data)) {
    const [ano, mes, dia] = data.split("-").map(Number);
    const validada = new Date(Date.UTC(ano, mes - 1, dia));
    if (validada.getUTCFullYear() !== ano || validada.getUTCMonth() !== mes - 1 || validada.getUTCDate() !== dia) return null;
    return data;
  }

  const instante = data instanceof Date ? data : new Date(data);
  return Number.isNaN(instante.getTime()) ? null : instante.toISOString().slice(0, 10);
}

export function hojeFinanceiro(agora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE_FINANCEIRO,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]));
  return `${valores.year}-${valores.month}-${valores.day}`;
}

export function somarDiasFinanceiros(data: string, quantidade: number): string {
  const [ano, mes, dia] = data.split("-").map(Number);
  const resultado = new Date(Date.UTC(ano, mes - 1, dia + quantidade));
  return resultado.toISOString().slice(0, 10);
}

export function diasEntreDatasFinanceiras(inicio: string, fim: string): number {
  const [anoInicio, mesInicio, diaInicio] = inicio.split("-").map(Number);
  const [anoFim, mesFim, diaFim] = fim.split("-").map(Number);
  const inicioMs = Date.UTC(anoInicio, mesInicio - 1, diaInicio);
  const fimMs = Date.UTC(anoFim, mesFim - 1, diaFim);
  return Math.round((fimMs - inicioMs) / 86_400_000);
}
