import { calcularCicloTituloFinanceiro, decimalParaNumero } from "./financeiro.logic";

export type NaturezaFluxoGerencial = "entrada" | "saida";
export type ClassificacaoFluxoGerencial = "realizado" | "previsto" | "transferencia";
export type FonteFluxoGerencial = "baixa" | "titulo" | "transferencia";

export type ContaFluxoGerencial = {
  id: number;
  nome: string;
  saldoInicial: string | number;
};

export type BaixaFluxoGerencial = {
  id: number;
  tituloId: number;
  contaFinanceiraId: number;
  tipo: "receber" | "pagar";
  valor: string | number;
  dataBaixa: Date;
  estornada?: boolean | number | null;
  descricao: string;
  origem: string;
  categoria?: string | null;
  contraparte?: string | null;
};

export type TituloFluxoGerencial = {
  id: number;
  tipo: "receber" | "pagar";
  descricao: string;
  origem: string;
  categoria?: string | null;
  contraparte?: string | null;
  valorOriginal: string | number;
  desconto: string | number;
  juros: string | number;
  dataVencimento: Date;
  estado: "aberto" | "parcial" | "quitado" | "vencido" | "cancelado";
};

export type TransferenciaFluxoGerencial = {
  id: number;
  contaFinanceiraId: number;
  tipo: "entrada" | "saida";
  valor: string | number;
  dataMovimento: Date;
  descricao: string;
};

export type ItemFluxoGerencial = {
  id: string;
  fonte: FonteFluxoGerencial;
  classificacao: ClassificacaoFluxoGerencial;
  natureza: NaturezaFluxoGerencial;
  valor: number;
  dataImpacto: Date;
  descricao: string;
  origem: string;
  categoria?: string | null;
  contraparte?: string | null;
  contaFinanceiraId?: number | null;
  tituloId?: number | null;
  baixaId?: number | null;
  transferenciaId?: number | null;
};

export type ResumoCategoriaFluxoGerencial = {
  nome: string;
  entradas: number;
  saidas: number;
  saldo: number;
  quantidade: number;
};

export type DiaFluxoGerencial = {
  data: Date;
  entradasRealizadas: number;
  saidasRealizadas: number;
  entradasPrevistas: number;
  saidasPrevistas: number;
  transferenciasEntrada: number;
  transferenciasSaida: number;
  saldoProjetado: number;
  itens: ItemFluxoGerencial[];
};

export type FluxoCaixaGerencial = {
  contaFinanceiraId?: number;
  saldoAtual: number;
  saldoInicialPeriodo: number;
  entradasRealizadas: number;
  saidasRealizadas: number;
  entradasPrevistas: number;
  saidasPrevistas: number;
  saldoProjetado: number;
  menorSaldoProjetado: number;
  dataMenorSaldoProjetado: Date | null;
  possuiAlertaSaldoNegativo: boolean;
  movimentosBancariosNaoConciliados: number;
  dias: DiaFluxoGerencial[];
  itensRealizados: ItemFluxoGerencial[];
  itensPrevistos: ItemFluxoGerencial[];
  itensTransferencias: ItemFluxoGerencial[];
  porCategoria: ResumoCategoriaFluxoGerencial[];
};

export type EntradaFluxoCaixaGerencial = {
  contas: ContaFluxoGerencial[];
  titulos: TituloFluxoGerencial[];
  baixas: BaixaFluxoGerencial[];
  transferencias: TransferenciaFluxoGerencial[];
  dataInicio: Date;
  dataFim: Date;
  dataReferencia: Date;
  contaFinanceiraId?: number;
  movimentosBancariosNaoConciliados?: number;
};

const CENTAVOS_EPSILON = 0.005;

function inicioDoDia(data: Date) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function fimDoDia(data: Date) {
  const fim = inicioDoDia(data);
  fim.setHours(23, 59, 59, 999);
  return fim;
}

function chaveData(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function arredondarValor(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function aplicarItem(saldo: number, item: ItemFluxoGerencial) {
  return arredondarValor(saldo + (item.natureza === "entrada" ? item.valor : -item.valor));
}

function pertenceAConta(contaFinanceiraId: number | undefined, contaId: number | null | undefined) {
  return !contaFinanceiraId || contaFinanceiraId === contaId;
}

function estaNoPeriodo(data: Date, inicio: Date, fim: Date) {
  return data >= inicio && data <= fim;
}

function totalPorNatureza(itens: ItemFluxoGerencial[], natureza: NaturezaFluxoGerencial) {
  return arredondarValor(itens.filter((item) => item.natureza === natureza).reduce((total, item) => total + item.valor, 0));
}

function criarItensDeBaixa(input: EntradaFluxoCaixaGerencial, inicio: Date, fim: Date, referencia: Date) {
  const tituloPorId = new Map(input.titulos.map((titulo) => [titulo.id, titulo]));
  const validas = input.baixas.filter((baixa) => !Boolean(baixa.estornada));
  const realizadas: ItemFluxoGerencial[] = [];
  const futuras: ItemFluxoGerencial[] = [];

  for (const baixa of validas) {
    if (!pertenceAConta(input.contaFinanceiraId, baixa.contaFinanceiraId)) continue;
    const titulo = tituloPorId.get(baixa.tituloId);
    if (!titulo || titulo.estado === "cancelado") continue;
    const item: ItemFluxoGerencial = {
      id: `baixa-${baixa.id}`,
      fonte: "baixa",
      classificacao: baixa.dataBaixa <= referencia ? "realizado" : "previsto",
      natureza: baixa.tipo === "receber" ? "entrada" : "saida",
      valor: arredondarValor(decimalParaNumero(baixa.valor)),
      dataImpacto: baixa.dataBaixa,
      descricao: baixa.descricao,
      origem: baixa.origem,
      categoria: baixa.categoria,
      contraparte: baixa.contraparte,
      contaFinanceiraId: baixa.contaFinanceiraId,
      tituloId: baixa.tituloId,
      baixaId: baixa.id,
    };
    if (item.classificacao === "realizado") realizadas.push(item);
    else futuras.push(item);
  }

  return {
    validas,
    realizadas: realizadas.filter((item) => estaNoPeriodo(item.dataImpacto, inicio, fim)),
    futuras: futuras.filter((item) => estaNoPeriodo(item.dataImpacto, inicio, fim)),
    realizadasAntesInicio: realizadas.filter((item) => item.dataImpacto < inicio),
    futurasAntesInicio: futuras.filter((item) => item.dataImpacto > referencia && item.dataImpacto < inicio),
    realizadasAteReferencia: realizadas.filter((item) => item.dataImpacto <= referencia),
  };
}

function criarPrevisaoResidualDosTitulos(input: EntradaFluxoCaixaGerencial, baixasValidas: BaixaFluxoGerencial[], inicio: Date, fim: Date, referencia: Date) {
  const previstos: ItemFluxoGerencial[] = [];
  const baixasPorTitulo = new Map<number, BaixaFluxoGerencial[]>();
  for (const baixa of baixasValidas) {
    const existentes = baixasPorTitulo.get(baixa.tituloId) ?? [];
    existentes.push(baixa);
    baixasPorTitulo.set(baixa.tituloId, existentes);
  }

  for (const titulo of input.titulos) {
    if (titulo.estado === "cancelado") continue;
    const baixasDoTitulo = baixasPorTitulo.get(titulo.id) ?? [];
    const cicloNaReferencia = calcularCicloTituloFinanceiro({
      valorOriginal: titulo.valorOriginal,
      desconto: titulo.desconto,
      juros: titulo.juros,
      dataVencimento: titulo.dataVencimento,
      baixas: baixasDoTitulo.filter((baixa) => baixa.dataBaixa <= referencia),
      agora: referencia,
    });
    const baixasFuturas = baixasDoTitulo.filter((baixa) => baixa.dataBaixa > referencia);
    const totalFuturoAgendado = baixasFuturas.reduce((total, baixa) => total + decimalParaNumero(baixa.valor), 0);
    const saldoSemBaixasAgendadas = arredondarValor(Math.max(0, cicloNaReferencia.saldoAberto - totalFuturoAgendado));
    if (saldoSemBaixasAgendadas <= CENTAVOS_EPSILON) continue;

    // Títulos não possuem conta prevista obrigatória. Só entram em uma visão individual
    // quando há uma baixa futura em tal conta; o saldo residual sem conta é consolidado.
    if (input.contaFinanceiraId && !baixasFuturas.some((baixa) => baixa.contaFinanceiraId === input.contaFinanceiraId)) {
      continue;
    }
    if (!estaNoPeriodo(titulo.dataVencimento, inicio, fim)) continue;
    previstos.push({
      id: `titulo-${titulo.id}-saldo`,
      fonte: "titulo",
      classificacao: "previsto",
      natureza: titulo.tipo === "receber" ? "entrada" : "saida",
      valor: saldoSemBaixasAgendadas,
      dataImpacto: titulo.dataVencimento,
      descricao: titulo.descricao,
      origem: titulo.origem,
      categoria: titulo.categoria,
      contraparte: titulo.contraparte,
      contaFinanceiraId: input.contaFinanceiraId ?? null,
      tituloId: titulo.id,
    });
  }
  return previstos;
}

function criarItensTransferencia(input: EntradaFluxoCaixaGerencial, inicio: Date, fim: Date, referencia: Date) {
  if (!input.contaFinanceiraId) return { realizados: [] as ItemFluxoGerencial[], previstos: [] as ItemFluxoGerencial[], realizadosAntesInicio: [] as ItemFluxoGerencial[], previstosAntesInicio: [] as ItemFluxoGerencial[], realizadosAteReferencia: [] as ItemFluxoGerencial[] };
  const itens = input.transferencias
    .filter((movimento) => movimento.contaFinanceiraId === input.contaFinanceiraId)
    .map<ItemFluxoGerencial>((movimento) => ({
      id: `transferencia-${movimento.id}`,
      fonte: "transferencia",
      classificacao: movimento.dataMovimento <= referencia ? "realizado" : "previsto",
      natureza: movimento.tipo,
      valor: arredondarValor(decimalParaNumero(movimento.valor)),
      dataImpacto: movimento.dataMovimento,
      descricao: movimento.descricao,
      origem: "transferencia_interna",
      contaFinanceiraId: movimento.contaFinanceiraId,
      transferenciaId: movimento.id,
    }));
  const realizadas = itens.filter((item) => item.classificacao === "realizado");
  const previstos = itens.filter((item) => item.classificacao === "previsto");
  return {
    realizados: realizadas.filter((item) => estaNoPeriodo(item.dataImpacto, inicio, fim)),
    previstos: previstos.filter((item) => estaNoPeriodo(item.dataImpacto, inicio, fim)),
    realizadosAntesInicio: realizadas.filter((item) => item.dataImpacto < inicio),
    previstosAntesInicio: previstos.filter((item) => item.dataImpacto > referencia && item.dataImpacto < inicio),
    realizadosAteReferencia: realizadas.filter((item) => item.dataImpacto <= referencia),
  };
}

function agruparCategorias(itens: ItemFluxoGerencial[]) {
  const categorias = new Map<string, ResumoCategoriaFluxoGerencial>();
  for (const item of itens) {
    if (item.fonte === "transferencia") continue;
    const nome = item.categoria || item.origem || "Sem categoria";
    const atual = categorias.get(nome) ?? { nome, entradas: 0, saidas: 0, saldo: 0, quantidade: 0 };
    if (item.natureza === "entrada") atual.entradas = arredondarValor(atual.entradas + item.valor);
    else atual.saidas = arredondarValor(atual.saidas + item.valor);
    atual.saldo = arredondarValor(atual.entradas - atual.saidas);
    atual.quantidade += 1;
    categorias.set(nome, atual);
  }
  return Array.from(categorias.values()).sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo) || a.nome.localeCompare(b.nome));
}

/**
 * Compõe a leitura gerencial a partir das fontes financeiras existentes. Não grava dados,
 * não altera títulos ou baixas e não classifica extratos pendentes como receita/despesa.
 */
export function montarFluxoCaixaGerencial(input: EntradaFluxoCaixaGerencial): FluxoCaixaGerencial {
  const inicio = inicioDoDia(input.dataInicio);
  const fim = fimDoDia(input.dataFim);
  const referencia = fimDoDia(input.dataReferencia);
  if (inicio > fim) throw new Error("A data inicial não pode ser posterior à data final");
  const contasSelecionadas = input.contaFinanceiraId
    ? input.contas.filter((conta) => conta.id === input.contaFinanceiraId)
    : input.contas;
  if (input.contaFinanceiraId && contasSelecionadas.length === 0) throw new Error("Conta financeira não encontrada");

  const saldoBase = arredondarValor(contasSelecionadas.reduce((total, conta) => total + decimalParaNumero(conta.saldoInicial), 0));
  const baixas = criarItensDeBaixa(input, inicio, fim, referencia);
  const previsoesResiduo = criarPrevisaoResidualDosTitulos(input, baixas.validas, inicio, fim, referencia);
  const transferencias = criarItensTransferencia(input, inicio, fim, referencia);

  const itensRealizados = baixas.realizadas;
  const itensPrevistos = [...baixas.futuras, ...previsoesResiduo];
  const itensTransferencias = [...transferencias.realizados, ...transferencias.previstos];
  const saldoAtual = [...baixas.realizadasAteReferencia, ...transferencias.realizadosAteReferencia]
    .reduce((saldo, item) => aplicarItem(saldo, item), saldoBase);

  let saldoInicialPeriodo: number;
  if (inicio > referencia) {
    saldoInicialPeriodo = [...baixas.realizadasAteReferencia, ...transferencias.realizadosAteReferencia, ...baixas.futurasAntesInicio, ...transferencias.previstosAntesInicio]
      .reduce((saldo, item) => aplicarItem(saldo, item), saldoBase);
  } else {
    saldoInicialPeriodo = [...baixas.realizadasAntesInicio, ...transferencias.realizadosAntesInicio]
      .reduce((saldo, item) => aplicarItem(saldo, item), saldoBase);
  }

  const itensPorDia = new Map<string, ItemFluxoGerencial[]>();
  for (const item of [...itensRealizados, ...itensPrevistos, ...itensTransferencias]) {
    const chave = chaveData(item.dataImpacto);
    itensPorDia.set(chave, [...(itensPorDia.get(chave) ?? []), item]);
  }
  const dias: DiaFluxoGerencial[] = [];
  let saldoCorrente = saldoInicialPeriodo;
  let menorSaldo = saldoInicialPeriodo;
  let dataMenorSaldo: Date | null = null;
  for (let cursor = new Date(inicio); cursor <= fim; cursor.setDate(cursor.getDate() + 1)) {
    const data = new Date(cursor);
    const itens = (itensPorDia.get(chaveData(data)) ?? []).sort((a, b) => a.id.localeCompare(b.id));
    for (const item of itens) saldoCorrente = aplicarItem(saldoCorrente, item);
    if (saldoCorrente < menorSaldo - CENTAVOS_EPSILON) {
      menorSaldo = saldoCorrente;
      dataMenorSaldo = data;
    }
    const realizados = itens.filter((item) => item.classificacao === "realizado");
    const previstos = itens.filter((item) => item.classificacao === "previsto" && item.fonte !== "transferencia");
    const movimentosTransferencia = itens.filter((item) => item.fonte === "transferencia");
    dias.push({
      data,
      entradasRealizadas: totalPorNatureza(realizados, "entrada"),
      saidasRealizadas: totalPorNatureza(realizados, "saida"),
      entradasPrevistas: totalPorNatureza(previstos, "entrada"),
      saidasPrevistas: totalPorNatureza(previstos, "saida"),
      transferenciasEntrada: totalPorNatureza(movimentosTransferencia, "entrada"),
      transferenciasSaida: totalPorNatureza(movimentosTransferencia, "saida"),
      saldoProjetado: saldoCorrente,
      itens,
    });
  }
  const saldoProjetado = dias.length ? dias[dias.length - 1].saldoProjetado : saldoInicialPeriodo;
  return {
    contaFinanceiraId: input.contaFinanceiraId,
    saldoAtual,
    saldoInicialPeriodo,
    entradasRealizadas: totalPorNatureza(itensRealizados, "entrada"),
    saidasRealizadas: totalPorNatureza(itensRealizados, "saida"),
    entradasPrevistas: totalPorNatureza(itensPrevistos, "entrada"),
    saidasPrevistas: totalPorNatureza(itensPrevistos, "saida"),
    saldoProjetado,
    menorSaldoProjetado: menorSaldo,
    dataMenorSaldoProjetado: dataMenorSaldo,
    possuiAlertaSaldoNegativo: dias.some((dia) => dia.saldoProjetado < -CENTAVOS_EPSILON),
    movimentosBancariosNaoConciliados: input.movimentosBancariosNaoConciliados ?? 0,
    dias,
    itensRealizados,
    itensPrevistos,
    itensTransferencias,
    porCategoria: agruparCategorias([...itensRealizados, ...itensPrevistos]),
  };
}
