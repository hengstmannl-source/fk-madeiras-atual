export type EstadoTituloFinanceiro = "aberto" | "parcial" | "quitado" | "vencido" | "cancelado";
export type FrequenciaFinanceira = "semanal" | "mensal" | "trimestral" | "semestral" | "anual";
export type TipoAlertaFinanceiro = "vence_em_breve" | "vencido";
export type EstadoAlertaCompensacaoCheque = "atrasada" | "hoje" | "proxima";

export type MovimentoFluxoCaixa = {
  id: number;
  tipo: "receber" | "pagar";
  valor: string | number;
  dataBaixa: Date;
  estornada?: boolean | number | null;
  descricao?: string | null;
  contaNome?: string | null;
  formaPagamento?: string | null;
};

const CENTAVOS_EPSILON = 0.005;

export function decimalParaNumero(valor: string | number | null | undefined): number {
  const texto = String(valor ?? "0").trim();
  const normalizado = texto.includes(",") && texto.includes(".")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto.replace(",", ".");
  const numero = typeof valor === "number" ? valor : Number.parseFloat(normalizado);
  return Number.isFinite(numero) ? numero : 0;
}

export function valorLiquidoTitulo(valorOriginal: string | number, desconto: string | number = 0, juros: string | number = 0): number {
  return Math.max(0, decimalParaNumero(valorOriginal) - decimalParaNumero(desconto) + decimalParaNumero(juros));
}

export function calcularEstadoTitulo(input: {
  valorOriginal: string | number;
  desconto?: string | number;
  juros?: string | number;
  valorBaixado?: string | number;
  dataVencimento: Date;
  cancelado?: boolean;
  agora?: Date;
}): EstadoTituloFinanceiro {
  if (input.cancelado) return "cancelado";

  const valorLiquido = valorLiquidoTitulo(input.valorOriginal, input.desconto, input.juros);
  const valorBaixado = decimalParaNumero(input.valorBaixado);
  if (valorBaixado >= valorLiquido - CENTAVOS_EPSILON) return "quitado";
  if (valorBaixado > CENTAVOS_EPSILON) return "parcial";

  const agora = input.agora ?? new Date();
  const inicioDoDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const vencimento = new Date(
    input.dataVencimento.getFullYear(),
    input.dataVencimento.getMonth(),
    input.dataVencimento.getDate(),
  );
  return vencimento < inicioDoDia ? "vencido" : "aberto";
}

export function calcularParcelas(valorTotal: string | number, quantidadeParcelas: number): string[] {
  if (!Number.isInteger(quantidadeParcelas) || quantidadeParcelas < 1) {
    throw new Error("A quantidade de parcelas deve ser maior que zero");
  }
  const totalEmCentavos = Math.round(decimalParaNumero(valorTotal) * 100);
  if (totalEmCentavos <= 0) throw new Error("O valor total deve ser maior que zero");

  const valorBase = Math.floor(totalEmCentavos / quantidadeParcelas);
  const resto = totalEmCentavos % quantidadeParcelas;
  return Array.from({ length: quantidadeParcelas }, (_, indice) => (
    ((valorBase + (indice < resto ? 1 : 0)) / 100).toFixed(2)
  ));
}

export function proximoVencimento(data: Date, frequencia: FrequenciaFinanceira): Date {
  const proxima = new Date(data);
  if (frequencia === "semanal") proxima.setDate(proxima.getDate() + 7);
  if (frequencia === "mensal") proxima.setMonth(proxima.getMonth() + 1);
  if (frequencia === "trimestral") proxima.setMonth(proxima.getMonth() + 3);
  if (frequencia === "semestral") proxima.setMonth(proxima.getMonth() + 6);
  if (frequencia === "anual") proxima.setFullYear(proxima.getFullYear() + 1);
  return proxima;
}

export function saldoAbertoTitulo(valorOriginal: string | number, desconto: string | number, juros: string | number, valorBaixado: string | number): number {
  return Math.max(0, valorLiquidoTitulo(valorOriginal, desconto, juros) - decimalParaNumero(valorBaixado));
}

export function validarValorBaixaContraSaldo(valor: string | number, saldoAberto: string | number): number {
  const valorBaixa = decimalParaNumero(valor);
  if (valorBaixa <= 0 || valorBaixa > decimalParaNumero(saldoAberto) + 0.005) {
    throw new Error("O valor da baixa deve ser maior que zero e não pode exceder o saldo em aberto");
  }
  return valorBaixa;
}

/** Valida uma movimentação patrimonial entre contas sem produzir título, receita ou despesa. */
export function validarTransferenciaFinanceira(input: {
  contaOrigemId: number;
  contaDestinoId: number;
  valor: string | number;
  contaOrigemAtiva: boolean;
  contaDestinoAtiva: boolean;
}) {
  if (input.contaOrigemId === input.contaDestinoId) {
    throw new Error("Selecione contas de origem e destino diferentes");
  }
  const valor = decimalParaNumero(input.valor);
  if (valor <= 0) throw new Error("O valor da transferência deve ser maior que zero");
  if (!input.contaOrigemAtiva) throw new Error("A conta de origem está inativa");
  if (!input.contaDestinoAtiva) throw new Error("A conta de destino está inativa");
  return Math.round(valor * 100) / 100;
}

/** Calcula o reflexo patrimonial de transferências sem misturá-las ao fluxo de receitas e despesas. */
export function calcularSaldoContaComTransferencias(input: {
  saldoBase: string | number;
  movimentos: Array<{ tipo: "entrada" | "saida"; valor: string | number }>;
}) {
  const saldoEmCentavos = Math.round(decimalParaNumero(input.saldoBase) * 100);
  const transferenciasEmCentavos = input.movimentos.reduce((total, movimento) => {
    const valor = Math.round(decimalParaNumero(movimento.valor) * 100);
    return total + (movimento.tipo === "entrada" ? valor : -valor);
  }, 0);
  return (saldoEmCentavos + transferenciasEmCentavos) / 100;
}

export type BaixaParaRecalculo = {
  valor: string | number;
  estornada?: boolean | number | null;
};

/**
 * Reconstrói o ciclo materializado do título exclusivamente pelas baixas ainda válidas.
 * O campo `valorBaixado` continua persistido por desempenho, mas nunca é a fonte de
 * verdade dentro de uma operação financeira: ele é regravado com este resultado.
 */
export function calcularCicloTituloFinanceiro(input: {
  valorOriginal: string | number;
  desconto?: string | number;
  juros?: string | number;
  dataVencimento: Date;
  baixas: BaixaParaRecalculo[];
  cancelado?: boolean;
  agora?: Date;
}) {
  const valorDevidoEmCentavos = Math.max(0, Math.round(
    valorLiquidoTitulo(input.valorOriginal, input.desconto, input.juros) * 100,
  ));
  const valorBaixadoEmCentavos = input.baixas
    .filter((baixa) => !Boolean(baixa.estornada))
    .reduce((total, baixa) => total + Math.round(decimalParaNumero(baixa.valor) * 100), 0);
  const valorBaixado = valorBaixadoEmCentavos / 100;
  const saldoAberto = Math.max(0, (valorDevidoEmCentavos - valorBaixadoEmCentavos) / 100);
  const estado = calcularEstadoTitulo({
    valorOriginal: input.valorOriginal,
    desconto: input.desconto,
    juros: input.juros,
    valorBaixado,
    dataVencimento: input.dataVencimento,
    cancelado: input.cancelado,
    agora: input.agora,
  });

  return {
    valorDevido: valorDevidoEmCentavos / 100,
    valorBaixado,
    saldoAberto,
    estado,
  };
}

export function podeCancelarTituloFinanceiro(valorBaixado: string | number | null | undefined): boolean {
  return decimalParaNumero(valorBaixado) <= CENTAVOS_EPSILON;
}

export function podeEstornarBaixa(estornada: boolean | number | null | undefined): boolean {
  return !Boolean(estornada);
}

/** Garante que os cheques informados cubram exatamente uma baixa financeira. */
export function validarValorDosCheques(valorBaixa: string | number, valoresCheques: Array<string | number>): number {
  const valorEsperadoEmCentavos = Math.round(decimalParaNumero(valorBaixa) * 100);
  const valorChequesEmCentavos = valoresCheques.reduce<number>((total, valor) => total + Math.round(decimalParaNumero(valor) * 100), 0);
  if (valorEsperadoEmCentavos <= 0) throw new Error("O valor da baixa deve ser maior que zero");
  if (valorChequesEmCentavos !== valorEsperadoEmCentavos) {
    throw new Error("A soma dos cheques deve ser exatamente igual ao valor da baixa");
  }
  return valorChequesEmCentavos / 100;
}

/** Um cheque só pode ser devolvido enquanto ainda estiver em carteira e sem conciliação bancária. */
export function validarDevolucaoCheque(input: {
  estado: "disponivel" | "utilizado" | "estornado" | "depositado";
  baixaConciliada: boolean;
  motivo: string;
}) {
  if (input.estado === "utilizado") throw new Error("Este cheque já foi utilizado em um pagamento e não pode ser devolvido");
  if (input.estado === "estornado") throw new Error("Este cheque já foi devolvido");
  if (input.estado === "depositado") throw new Error("Este cheque já foi depositado em uma conta bancária e não pode ser devolvido");
  if (input.baixaConciliada) throw new Error("Desconcilie o recebimento bancário antes de registrar a devolução deste cheque");
  if (input.motivo.trim().length < 3) throw new Error("Informe o motivo da devolução do cheque");
}

/** Um cheque em carteira só pode ser depositado uma vez, exclusivamente em uma conta bancária ativa. */
export function validarDepositoCheque(input: {
  estado: "disponivel" | "utilizado" | "estornado" | "depositado";
  contaDestinoTipo: "caixa" | "caixa_cheque" | "banco" | "carteira" | "outro";
  contaDestinoAtiva: boolean;
}) {
  if (input.estado === "depositado") throw new Error("Este cheque já foi depositado em uma conta bancária");
  if (input.estado === "utilizado") throw new Error("Este cheque já foi utilizado em um pagamento e não pode ser depositado");
  if (input.estado === "estornado") throw new Error("Este cheque foi devolvido e não pode ser depositado");
  if (input.contaDestinoTipo !== "banco") throw new Error("Selecione uma conta bancária como destino do depósito");
  if (!input.contaDestinoAtiva) throw new Error("A conta bancária de destino está inativa");
}

/** Impede alterações que comprometam uma baixa já conciliada ou o saldo realizado do título. */
export function validarEdicaoTituloFinanceiro(input: {
  estado: EstadoTituloFinanceiro;
  possuiBaixaConciliada: boolean;
  tipoAtual: "receber" | "pagar";
  novoTipo: "receber" | "pagar";
  descricao: string;
  valorOriginal: string | number;
  desconto?: string | number;
  juros?: string | number;
  valorBaixado: string | number;
}) {
  if (input.estado === "cancelado") throw new Error("Lançamentos cancelados não podem ser editados");
  if (input.possuiBaixaConciliada) throw new Error("Desconcilie o lançamento bancário antes de editar este título");
  if (!input.descricao.trim()) throw new Error("Informe uma descrição para o lançamento");
  if (decimalParaNumero(input.valorOriginal) <= 0) throw new Error("O valor do título deve ser maior que zero");
  if (valorLiquidoTitulo(input.valorOriginal, input.desconto, input.juros) < decimalParaNumero(input.valorBaixado)) {
    throw new Error("O valor líquido do lançamento não pode ser menor que o total já baixado");
  }
  if (input.tipoAtual !== input.novoTipo && decimalParaNumero(input.valorBaixado) > CENTAVOS_EPSILON) {
    throw new Error("Não é possível alterar o tipo de um lançamento que já possui baixas");
  }
}

/** Impede exclusões enquanto houver vínculo de conciliação bancária ativo. */
export function validarExclusaoTituloFinanceiro(input: { estado: EstadoTituloFinanceiro; possuiBaixaConciliada: boolean }) {
  if (input.estado === "cancelado") throw new Error("Este lançamento já foi excluído");
  if (input.possuiBaixaConciliada) throw new Error("Desconcilie o lançamento bancário antes de excluir este título");
}

function inicioDoDia(data: Date): Date {
  const resultado = new Date(data);
  resultado.setHours(0, 0, 0, 0);
  return resultado;
}

/** Classifica a prioridade operacional de um cheque disponível conforme sua compensação. */
export function classificarAlertaCompensacaoCheque(
  dataCompensacao: Date | string | null | undefined,
  agora: Date = new Date(),
  diasDeAntecedencia = 3,
): EstadoAlertaCompensacaoCheque | null {
  if (!dataCompensacao) return null;
  const compensacao = inicioDoDia(new Date(dataCompensacao));
  if (Number.isNaN(compensacao.getTime())) return null;
  const hoje = inicioDoDia(agora);
  const dias = Math.round((compensacao.getTime() - hoje.getTime()) / 86_400_000);
  if (dias < 0) return "atrasada";
  if (dias === 0) return "hoje";
  return dias <= diasDeAntecedencia ? "proxima" : null;
}

function fimDoDia(data: Date): Date {
  const resultado = new Date(data);
  resultado.setHours(23, 59, 59, 999);
  return resultado;
}

function chaveData(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function calcularRelatorioFluxoCaixa(input: {
  dataInicio: Date;
  dataFim: Date;
  saldoInicialContas: string | number;
  movimentos: MovimentoFluxoCaixa[];
}) {
  const inicio = inicioDoDia(input.dataInicio);
  const fim = fimDoDia(input.dataFim);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || inicio > fim) {
    throw new Error("Informe um período de fluxo de caixa válido");
  }

  const movimentosValidos = input.movimentos.filter((movimento) => !Boolean(movimento.estornada));
  const calcularLiquido = (movimentos: MovimentoFluxoCaixa[]) => movimentos.reduce((total, movimento) => (
    total + (movimento.tipo === "receber" ? decimalParaNumero(movimento.valor) : -decimalParaNumero(movimento.valor))
  ), 0);
  const movimentosAnteriores = movimentosValidos.filter((movimento) => new Date(movimento.dataBaixa) < inicio);
  const movimentosPeriodo = movimentosValidos
    .filter((movimento) => {
      const data = new Date(movimento.dataBaixa);
      return data >= inicio && data <= fim;
    })
    .sort((a, b) => new Date(a.dataBaixa).getTime() - new Date(b.dataBaixa).getTime() || a.id - b.id);
  const saldoAbertura = decimalParaNumero(input.saldoInicialContas) + calcularLiquido(movimentosAnteriores);
  const entradas = movimentosPeriodo
    .filter((movimento) => movimento.tipo === "receber")
    .reduce((total, movimento) => total + decimalParaNumero(movimento.valor), 0);
  const saidas = movimentosPeriodo
    .filter((movimento) => movimento.tipo === "pagar")
    .reduce((total, movimento) => total + decimalParaNumero(movimento.valor), 0);
  const porDia = new Map<string, { entradas: number; saidas: number }>();
  movimentosPeriodo.forEach((movimento) => {
    const chave = chaveData(new Date(movimento.dataBaixa));
    const acumulado = porDia.get(chave) ?? { entradas: 0, saidas: 0 };
    if (movimento.tipo === "receber") acumulado.entradas += decimalParaNumero(movimento.valor);
    else acumulado.saidas += decimalParaNumero(movimento.valor);
    porDia.set(chave, acumulado);
  });

  let saldoAcumulado = saldoAbertura;
  const dias = [] as Array<{ data: string; entradas: number; saidas: number; saldoLiquido: number; saldoAcumulado: number }>;
  for (let cursor = new Date(inicio); cursor <= fim; cursor.setDate(cursor.getDate() + 1)) {
    const data = chaveData(cursor);
    const valores = porDia.get(data) ?? { entradas: 0, saidas: 0 };
    const saldoLiquido = valores.entradas - valores.saidas;
    saldoAcumulado += saldoLiquido;
    dias.push({ data, ...valores, saldoLiquido, saldoAcumulado });
  }

  return {
    dataInicio: chaveData(inicio),
    dataFim: chaveData(fim),
    saldoAbertura,
    entradas,
    saidas,
    saldoLiquido: entradas - saidas,
    saldoFinal: saldoAbertura + entradas - saidas,
    quantidadeMovimentos: movimentosPeriodo.length,
    dias,
    movimentos: movimentosPeriodo,
  };
}

export type TituloPrevisaoSemanal = {
  tipo: "receber" | "pagar";
  valorOriginal: string | number;
  valorBaixado: string | number;
  desconto?: string | number | null;
  juros?: string | number | null;
  dataVencimento: Date;
  estado: EstadoTituloFinanceiro;
};

function inicioDaSemana(data: Date): Date {
  const inicio = inicioDoDia(data);
  const deslocamento = (inicio.getDay() + 6) % 7;
  inicio.setDate(inicio.getDate() - deslocamento);
  return inicio;
}

/**
 * Projeta o caixa a partir do saldo efetivamente realizado e dos títulos ainda em aberto.
 * Títulos vencidos são concentrados na primeira semana exibida para evidenciar o impacto imediato.
 */
export function calcularPrevisaoSemanal(input: {
  saldoAtual: string | number;
  titulos: TituloPrevisaoSemanal[];
  semanas?: number;
  agora?: Date;
}) {
  const semanas = input.semanas ?? 8;
  if (!Number.isInteger(semanas) || semanas < 1) {
    throw new Error("Informe pelo menos uma semana para a previsão");
  }

  const hoje = inicioDoDia(input.agora ?? new Date());
  const semanaAtual = inicioDaSemana(hoje);
  const titulosPendentes = input.titulos.filter((titulo) => (
    ["aberto", "parcial", "vencido"].includes(titulo.estado)
  ));
  let saldoProjetado = decimalParaNumero(input.saldoAtual);

  return Array.from({ length: semanas }, (_, indice) => {
    const inicio = new Date(semanaAtual);
    inicio.setDate(inicio.getDate() + (indice * 7));
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 6);
    fim.setHours(23, 59, 59, 999);

    const titulosDaSemana = titulosPendentes.filter((titulo) => {
      const vencimento = inicioDoDia(new Date(titulo.dataVencimento));
      if (vencimento > fim) return false;
      return indice === 0 || vencimento >= inicio;
    });

    const entradas = titulosDaSemana
      .filter((titulo) => titulo.tipo === "receber")
      .reduce((total, titulo) => total + saldoAbertoTitulo(
        titulo.valorOriginal,
        titulo.desconto ?? 0,
        titulo.juros ?? 0,
        titulo.valorBaixado,
      ), 0);
    const saidas = titulosDaSemana
      .filter((titulo) => titulo.tipo === "pagar")
      .reduce((total, titulo) => total + saldoAbertoTitulo(
        titulo.valorOriginal,
        titulo.desconto ?? 0,
        titulo.juros ?? 0,
        titulo.valorBaixado,
      ), 0);
    const saldoLiquido = entradas - saidas;
    saldoProjetado += saldoLiquido;

    return {
      semana: `Semana de ${chaveData(inicio)}`,
      inicioSemana: chaveData(inicio),
      fimSemana: chaveData(fim),
      entradas,
      saidas,
      saldoLiquido,
      saldoProjetado,
      quantidadeTitulos: titulosDaSemana.length,
    };
  });
}

export function classificarAlertaVencimento(input: {
  estado: EstadoTituloFinanceiro;
  dataVencimento: Date;
  diasAntecedencia: number;
  agora?: Date;
}): TipoAlertaFinanceiro | null {
  if (input.estado === "vencido") return "vencido";
  if (!["aberto", "parcial"].includes(input.estado)) return null;

  const agora = input.agora ?? new Date();
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const inicioVencimento = new Date(
    input.dataVencimento.getFullYear(),
    input.dataVencimento.getMonth(),
    input.dataVencimento.getDate(),
  );
  const diasRestantes = Math.round((inicioVencimento.getTime() - inicioHoje.getTime()) / 86_400_000);
  return diasRestantes >= 0 && diasRestantes <= input.diasAntecedencia ? "vence_em_breve" : null;
}

/**
 * Recalcula o alerta aplicável a partir dos dados atuais do título. Assim, um
 * alerta persistido antes de um reagendamento não continua visível como se o
 * vencimento antigo ainda estivesse vigente.
 */
export function tipoAlertaAtualDoTitulo(input: {
  valorOriginal: string | number;
  desconto?: string | number | null;
  juros?: string | number | null;
  valorBaixado?: string | number | null;
  dataVencimento: Date;
  estadoPersistido?: EstadoTituloFinanceiro | null;
  diasAntecedencia: number;
  agora?: Date;
}): TipoAlertaFinanceiro | null {
  const estado = calcularEstadoTitulo({
    valorOriginal: input.valorOriginal,
    desconto: input.desconto ?? 0,
    juros: input.juros ?? 0,
    valorBaixado: input.valorBaixado ?? 0,
    dataVencimento: input.dataVencimento,
    cancelado: input.estadoPersistido === "cancelado",
    agora: input.agora,
  });
  return classificarAlertaVencimento({
    estado,
    dataVencimento: input.dataVencimento,
    diasAntecedencia: input.diasAntecedencia,
    agora: input.agora,
  });
}

export function planejarAtualizacaoAlertas(tipoAtual: TipoAlertaFinanceiro | null, alertasAtivos: TipoAlertaFinanceiro[]) {
  return {
    criar: tipoAtual !== null && !alertasAtivos.includes(tipoAtual) ? tipoAtual : null,
    resolver: alertasAtivos.filter((tipo) => tipo !== tipoAtual),
  };
}
