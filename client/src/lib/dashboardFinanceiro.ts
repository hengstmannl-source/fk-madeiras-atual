import { chaveDataFinanceira, hojeFinanceiro } from "@shared/financeiro-data-civil";

export type TituloDashboardFinanceiro = {
  tipo: "receber" | "pagar";
  estado: string;
  valorOriginal?: string | number | null;
  /** Compatibilidade com eventuais respostas legadas. */
  valor?: string | number | null;
  valorBaixado?: string | number | null;
  desconto?: string | number | null;
  juros?: string | number | null;
  dataVencimento?: Date | string | null;
};

function numeroFinanceiro(valor: string | number | null | undefined): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  if (!valor) return 0;
  const normalizado = valor.includes(",")
    ? valor.replace(/\./g, "").replace(",", ".")
    : valor;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

/** Calcula o valor ainda pendente, incluindo descontos, juros e baixas parciais. */
export function saldoAbertoDashboard(titulo: TituloDashboardFinanceiro): number {
  const valorOriginal = numeroFinanceiro(titulo.valorOriginal ?? titulo.valor);
  return valorOriginal - numeroFinanceiro(titulo.desconto) + numeroFinanceiro(titulo.juros) - numeroFinanceiro(titulo.valorBaixado);
}

function estaEmAtraso(titulo: TituloDashboardFinanceiro, hoje: string): boolean {
  const vencimento = chaveDataFinanceira(titulo.dataVencimento);
  return vencimento ? vencimento < hoje : titulo.estado === "vencido";
}

export function resumirDashboardFinanceiro(titulos: TituloDashboardFinanceiro[], agora = new Date()) {
  const hoje = hojeFinanceiro(agora);
  return titulos.reduce((acumulado, titulo) => {
    if (["quitado", "cancelado"].includes(titulo.estado)) return acumulado;
    const saldo = saldoAbertoDashboard(titulo);
    if (titulo.tipo === "receber") {
      acumulado.receber += saldo;
      acumulado.quantidadeReceber += 1;
    }
    if (titulo.tipo === "pagar") {
      acumulado.pagar += saldo;
      acumulado.quantidadePagar += 1;
    }
    if (estaEmAtraso(titulo, hoje)) acumulado.vencido += saldo;
    return acumulado;
  }, { receber: 0, pagar: 0, vencido: 0, quantidadeReceber: 0, quantidadePagar: 0 });
}
