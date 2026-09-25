import { describe, expect, it } from "vitest";
import {
  calcularCicloTituloFinanceiro,
  calcularEstadoTitulo,
  calcularPrevisaoSemanal,
  calcularRelatorioFluxoCaixa,
  calcularParcelas,
  classificarAlertaCompensacaoCheque,
  classificarAlertaVencimento,
  planejarAtualizacaoAlertas,
  podeCancelarTituloFinanceiro,
  podeEstornarBaixa,
  proximoVencimento,
  saldoAbertoTitulo,
  tipoAlertaAtualDoTitulo,
  validarDepositoCheque,
  validarEdicaoTituloFinanceiro,
  validarDevolucaoCheque,
  validarExclusaoTituloFinanceiro,
  validarTransferenciaFinanceira,
  validarValorBaixaContraSaldo,
  validarValorDosCheques,
  calcularSaldoContaComTransferencias,
} from "./financeiro.logic";
import { montarFluxoCaixaGerencial } from "./fluxo-caixa.logic";

describe("regras financeiras", () => {
  it("calcula os estados aberto, parcial, quitado e vencido", () => {
    const hoje = new Date(2026, 7, 11);
    expect(calcularEstadoTitulo({ valorOriginal: "100", dataVencimento: hoje, agora: hoje })).toBe("aberto");
    expect(calcularEstadoTitulo({ valorOriginal: "100", valorBaixado: "30", dataVencimento: hoje, agora: hoje })).toBe("parcial");
    expect(calcularEstadoTitulo({ valorOriginal: "100", valorBaixado: "100", dataVencimento: hoje, agora: hoje })).toBe("quitado");
    expect(calcularEstadoTitulo({ valorOriginal: "100", dataVencimento: new Date(2026, 7, 10), agora: hoje })).toBe("vencido");
  });

  it("reconstrói saldo, valor baixado e estado a partir de baixas válidas", () => {
    const base = {
      valorOriginal: "100.00",
      desconto: "10.00",
      juros: "5.00",
      dataVencimento: new Date(2026, 7, 20, 12),
      agora: new Date(2026, 7, 11, 12),
    };
    expect(calcularCicloTituloFinanceiro({ ...base, baixas: [] })).toMatchObject({
      valorDevido: 95,
      valorBaixado: 0,
      saldoAberto: 95,
      estado: "aberto",
    });
    expect(calcularCicloTituloFinanceiro({ ...base, baixas: [{ valor: "30.00" }, { valor: "20.00" }] })).toMatchObject({
      valorBaixado: 50,
      saldoAberto: 45,
      estado: "parcial",
    });
    expect(calcularCicloTituloFinanceiro({ ...base, baixas: [{ valor: "50.00" }, { valor: "45.00" }] })).toMatchObject({
      valorBaixado: 95,
      saldoAberto: 0,
      estado: "quitado",
    });
  });

  it("desconsidera baixas estornadas e preserva cancelado ou vencido como estados finais", () => {
    const vencimentoPassado = new Date(2026, 7, 10, 12);
    const agora = new Date(2026, 7, 11, 12);
    expect(calcularCicloTituloFinanceiro({
      valorOriginal: "100.00",
      dataVencimento: vencimentoPassado,
      agora,
      baixas: [{ valor: "100.00", estornada: true }],
    })).toMatchObject({ valorBaixado: 0, saldoAberto: 100, estado: "vencido" });
    expect(calcularCicloTituloFinanceiro({
      valorOriginal: "100.00",
      dataVencimento: vencimentoPassado,
      agora,
      cancelado: true,
      baixas: [],
    })).toMatchObject({ valorBaixado: 0, saldoAberto: 100, estado: "cancelado" });
  });

  it("distribui o valor das parcelas sem perder centavos", () => {
    expect(calcularParcelas("100", 3)).toEqual(["33.34", "33.33", "33.33"]);
    expect(calcularParcelas("10.01", 2)).toEqual(["5.01", "5.00"]);
  });

  it("avança o vencimento de uma recorrência conforme sua frequência", () => {
    expect(proximoVencimento(new Date(2026, 0, 15), "mensal")).toEqual(new Date(2026, 1, 15));
    expect(proximoVencimento(new Date(2026, 0, 15), "trimestral")).toEqual(new Date(2026, 3, 15));
  });

  it("calcula o saldo em aberto considerando descontos e juros", () => {
    expect(saldoAbertoTitulo("100", "10", "5", "30")).toBe(65);
  });

  it("bloqueia baixa acima do saldo reconstruído e aceita o fechamento exato", () => {
    expect(validarValorBaixaContraSaldo("65.00", 65)).toBe(65);
    expect(() => validarValorBaixaContraSaldo("65.01", 65)).toThrow("não pode exceder o saldo em aberto");
    expect(() => validarValorBaixaContraSaldo("0", 65)).toThrow("maior que zero");
  });

  it("valida transferências somente entre contas diferentes, ativas e com valor positivo", () => {
    expect(validarTransferenciaFinanceira({
      contaOrigemId: 10,
      contaDestinoId: 11,
      valor: "250,15",
      contaOrigemAtiva: true,
      contaDestinoAtiva: true,
    })).toBe(250.15);
    expect(() => validarTransferenciaFinanceira({ contaOrigemId: 10, contaDestinoId: 10, valor: "1", contaOrigemAtiva: true, contaDestinoAtiva: true })).toThrow("origem e destino diferentes");
    expect(() => validarTransferenciaFinanceira({ contaOrigemId: 10, contaDestinoId: 11, valor: "0", contaOrigemAtiva: true, contaDestinoAtiva: true })).toThrow("maior que zero");
    expect(() => validarTransferenciaFinanceira({ contaOrigemId: 10, contaDestinoId: 11, valor: "1", contaOrigemAtiva: false, contaDestinoAtiva: true })).toThrow("origem está inativa");
    expect(() => validarTransferenciaFinanceira({ contaOrigemId: 10, contaDestinoId: 11, valor: "1", contaOrigemAtiva: true, contaDestinoAtiva: false })).toThrow("destino está inativa");
  });

  it("reconstrói o saldo por conta com pares de transferências sem classificá-los como fluxo de caixa", () => {
    expect(calcularSaldoContaComTransferencias({
      saldoBase: "1000.00",
      movimentos: [{ tipo: "saida", valor: "250.25" }, { tipo: "entrada", valor: "19.90" }],
    })).toBe(769.65);
    expect(calcularSaldoContaComTransferencias({
      saldoBase: "400.00",
      movimentos: [{ tipo: "saida", valor: "75.00" }, { tipo: "entrada", valor: "75.00" }],
    })).toBe(400);
  });

  it("permite cancelar somente títulos sem baixas financeiras", () => {
    expect(podeCancelarTituloFinanceiro("0")).toBe(true);
    expect(podeCancelarTituloFinanceiro("0.004")).toBe(true);
    expect(podeCancelarTituloFinanceiro("0.01")).toBe(false);
    expect(podeCancelarTituloFinanceiro("25")).toBe(false);
  });

  it("permite estornar uma baixa somente uma vez", () => {
    expect(podeEstornarBaixa(false)).toBe(true);
    expect(podeEstornarBaixa(0)).toBe(true);
    expect(podeEstornarBaixa(true)).toBe(false);
    expect(podeEstornarBaixa(1)).toBe(false);
  });

  it("confere a soma dos cheques com precisão de centavos", () => {
    expect(validarValorDosCheques("250,00", ["100,15", "149,85"])).toBe(250);
    expect(() => validarValorDosCheques("250,00", ["100,15", "149,84"])).toThrow("A soma dos cheques deve ser exatamente igual ao valor da baixa");
    expect(() => validarValorDosCheques("0", ["0"])).toThrow("O valor da baixa deve ser maior que zero");
  });

  it("permite devolver somente cheque disponível, não conciliado e com motivo", () => {
    expect(() => validarDevolucaoCheque({ estado: "disponivel", baixaConciliada: false, motivo: "Insuficiência de fundos" })).not.toThrow();
    expect(() => validarDevolucaoCheque({ estado: "utilizado", baixaConciliada: false, motivo: "Devolvido" })).toThrow("já foi utilizado");
    expect(() => validarDevolucaoCheque({ estado: "estornado", baixaConciliada: false, motivo: "Devolvido" })).toThrow("já foi devolvido");
    expect(() => validarDevolucaoCheque({ estado: "disponivel", baixaConciliada: true, motivo: "Devolvido" })).toThrow("Desconcilie");
    expect(() => validarDevolucaoCheque({ estado: "disponivel", baixaConciliada: false, motivo: "x" })).toThrow("Informe o motivo");
  });

  it("permite depositar apenas cheque disponível em conta bancária ativa e bloqueia duplicidade", () => {
    expect(() => validarDepositoCheque({ estado: "disponivel", contaDestinoTipo: "banco", contaDestinoAtiva: true })).not.toThrow();
    expect(() => validarDepositoCheque({ estado: "depositado", contaDestinoTipo: "banco", contaDestinoAtiva: true })).toThrow("já foi depositado");
    expect(() => validarDepositoCheque({ estado: "utilizado", contaDestinoTipo: "banco", contaDestinoAtiva: true })).toThrow("já foi utilizado");
    expect(() => validarDepositoCheque({ estado: "estornado", contaDestinoTipo: "banco", contaDestinoAtiva: true })).toThrow("foi devolvido");
    expect(() => validarDepositoCheque({ estado: "disponivel", contaDestinoTipo: "caixa", contaDestinoAtiva: true })).toThrow("conta bancária");
    expect(() => validarDepositoCheque({ estado: "disponivel", contaDestinoTipo: "banco", contaDestinoAtiva: false })).toThrow("inativa");
  });

  it("permite editar lançamento não conciliado sem reduzir o valor já baixado", () => {
    expect(() => validarEdicaoTituloFinanceiro({
      estado: "parcial",
      possuiBaixaConciliada: false,
      tipoAtual: "receber",
      novoTipo: "receber",
      descricao: "Recebimento revisado",
      valorOriginal: "150,00",
      desconto: "0",
      juros: "0",
      valorBaixado: "50,00",
    })).not.toThrow();
  });

  it("bloqueia a edição de lançamento conciliado e alterações incompatíveis com baixas", () => {
    const base = {
      estado: "parcial" as const,
      possuiBaixaConciliada: false,
      tipoAtual: "receber" as const,
      novoTipo: "receber" as const,
      descricao: "Recebimento",
      valorOriginal: "100,00",
      valorBaixado: "50,00",
    };
    expect(() => validarEdicaoTituloFinanceiro({ ...base, possuiBaixaConciliada: true })).toThrow("Desconcilie o lançamento bancário antes de editar este título");
    expect(() => validarEdicaoTituloFinanceiro({ ...base, valorOriginal: "40,00" })).toThrow("O valor líquido do lançamento não pode ser menor que o total já baixado");
    expect(() => validarEdicaoTituloFinanceiro({ ...base, novoTipo: "pagar" })).toThrow("Não é possível alterar o tipo de um lançamento que já possui baixas");
  });

  it("permite excluir lançamento não conciliado e exige desconciliação quando houver vínculo bancário", () => {
    expect(() => validarExclusaoTituloFinanceiro({ estado: "quitado", possuiBaixaConciliada: false })).not.toThrow();
    expect(() => validarExclusaoTituloFinanceiro({ estado: "quitado", possuiBaixaConciliada: true })).toThrow("Desconcilie o lançamento bancário antes de excluir este título");
    expect(() => validarExclusaoTituloFinanceiro({ estado: "cancelado", possuiBaixaConciliada: false })).toThrow("Este lançamento já foi excluído");
  });

  it("prioriza cheques pela proximidade da data de compensação", () => {
    const hoje = new Date(2026, 7, 14, 12);
    expect(classificarAlertaCompensacaoCheque(new Date(2026, 7, 13, 12), hoje)).toBe("atrasada");
    expect(classificarAlertaCompensacaoCheque(new Date(2026, 7, 14, 12), hoje)).toBe("hoje");
    expect(classificarAlertaCompensacaoCheque(new Date(2026, 7, 17, 12), hoje)).toBe("proxima");
    expect(classificarAlertaCompensacaoCheque(new Date(2026, 7, 18, 12), hoje)).toBeNull();
    expect(classificarAlertaCompensacaoCheque(null, hoje)).toBeNull();
  });

  it("apura entradas, saídas e saldo acumulado somente para o período informado", () => {
    const relatorio = calcularRelatorioFluxoCaixa({
      dataInicio: new Date(2026, 7, 1, 12),
      dataFim: new Date(2026, 7, 3, 12),
      saldoInicialContas: "100.00",
      movimentos: [
        { id: 1, tipo: "receber", valor: "20.00", dataBaixa: new Date(2026, 6, 31, 12) },
        { id: 2, tipo: "receber", valor: "50.00", dataBaixa: new Date(2026, 7, 1, 12) },
        { id: 3, tipo: "pagar", valor: "10.00", dataBaixa: new Date(2026, 7, 1, 12) },
        { id: 4, tipo: "pagar", valor: "30.00", dataBaixa: new Date(2026, 7, 3, 12) },
        { id: 5, tipo: "receber", valor: "999.00", dataBaixa: new Date(2026, 7, 2, 12), estornada: true },
      ],
    });

    expect(relatorio).toMatchObject({
      saldoAbertura: 120,
      entradas: 50,
      saidas: 40,
      saldoLiquido: 10,
      saldoFinal: 130,
      quantidadeMovimentos: 3,
    });
    expect(relatorio.dias).toEqual([
      { data: "2026-08-01", entradas: 50, saidas: 10, saldoLiquido: 40, saldoAcumulado: 160 },
      { data: "2026-08-02", entradas: 0, saidas: 0, saldoLiquido: 0, saldoAcumulado: 160 },
      { data: "2026-08-03", entradas: 0, saidas: 30, saldoLiquido: -30, saldoAcumulado: 130 },
    ]);
  });

  it("mantém o fluxo de caixa neutro quando não há baixa para uma transferência interna de cheque", () => {
    const relatorio = calcularRelatorioFluxoCaixa({
      dataInicio: new Date(2026, 7, 1, 12),
      dataFim: new Date(2026, 7, 1, 12),
      saldoInicialContas: "100.00",
      movimentos: [],
    });

    expect(relatorio).toMatchObject({
      entradas: 0,
      saidas: 0,
      saldoLiquido: 0,
      saldoFinal: 100,
      quantidadeMovimentos: 0,
    });
  });

  it("projeta o saldo por semana com títulos abertos, parciais e vencidos", () => {
    const previsao = calcularPrevisaoSemanal({
      saldoAtual: "100.00",
      semanas: 2,
      agora: new Date(2026, 7, 12, 12),
      titulos: [
        { tipo: "receber", valorOriginal: "200", valorBaixado: "0", dataVencimento: new Date(2026, 7, 13, 12), estado: "aberto" },
        { tipo: "pagar", valorOriginal: "80", valorBaixado: "20", dataVencimento: new Date(2026, 7, 14, 12), estado: "parcial" },
        { tipo: "pagar", valorOriginal: "50", valorBaixado: "0", dataVencimento: new Date(2026, 7, 1, 12), estado: "vencido" },
        { tipo: "receber", valorOriginal: "300", valorBaixado: "0", dataVencimento: new Date(2026, 7, 18, 12), estado: "aberto" },
        { tipo: "receber", valorOriginal: "999", valorBaixado: "0", dataVencimento: new Date(2026, 7, 14, 12), estado: "quitado" },
      ],
    });

    expect(previsao).toHaveLength(2);
    expect(previsao[0]).toMatchObject({
      inicioSemana: "2026-08-10",
      fimSemana: "2026-08-16",
      entradas: 200,
      saidas: 110,
      saldoLiquido: 90,
      saldoProjetado: 190,
      quantidadeTitulos: 3,
    });
    expect(previsao[1]).toMatchObject({
      entradas: 300,
      saidas: 0,
      saldoProjetado: 490,
    });
  });

  it("classifica alertas de vencimento sem alertar títulos quitados", () => {
    const hoje = new Date(2026, 7, 11);
    expect(classificarAlertaVencimento({ estado: "vencido", dataVencimento: new Date(2026, 7, 10), diasAntecedencia: 7, agora: hoje })).toBe("vencido");
    expect(classificarAlertaVencimento({ estado: "aberto", dataVencimento: new Date(2026, 7, 16), diasAntecedencia: 7, agora: hoje })).toBe("vence_em_breve");
    expect(classificarAlertaVencimento({ estado: "aberto", dataVencimento: new Date(2026, 7, 20), diasAntecedencia: 7, agora: hoje })).toBeNull();
    expect(classificarAlertaVencimento({ estado: "quitado", dataVencimento: new Date(2026, 7, 11), diasAntecedencia: 7, agora: hoje })).toBeNull();
  });

  it("não mantém alerta vencido após reagendamento para uma data fora da antecedência", () => {
    const hoje = new Date(2026, 7, 13, 12);
    expect(tipoAlertaAtualDoTitulo({
      valorOriginal: "750.00",
      valorBaixado: "0",
      dataVencimento: new Date(2026, 6, 28, 12),
      estadoPersistido: "aberto",
      diasAntecedencia: 7,
      agora: hoje,
    })).toBe("vencido");
    expect(tipoAlertaAtualDoTitulo({
      valorOriginal: "750.00",
      valorBaixado: "0",
      dataVencimento: new Date(2026, 8, 1, 12),
      estadoPersistido: "aberto",
      diasAntecedencia: 7,
      agora: hoje,
    })).toBeNull();
  });

  it("planeja alertas idempotentes e resolve alertas que deixaram de valer", () => {
    expect(planejarAtualizacaoAlertas("vence_em_breve", [])).toEqual({ criar: "vence_em_breve", resolver: [] });
    expect(planejarAtualizacaoAlertas("vence_em_breve", ["vence_em_breve"])).toEqual({ criar: null, resolver: [] });
    expect(planejarAtualizacaoAlertas("vencido", ["vence_em_breve"])).toEqual({ criar: "vencido", resolver: ["vence_em_breve"] });
    expect(planejarAtualizacaoAlertas(null, ["vence_em_breve", "vencido"])).toEqual({ criar: null, resolver: ["vence_em_breve", "vencido"] });
  });

  it("compõe realizado e saldo residual de título parcial sem duplicar transferências no consolidado", () => {
    const base = {
      contas: [
        { id: 1, nome: "Banco", saldoInicial: "100.00" },
        { id: 2, nome: "Caixa", saldoInicial: "50.00" },
      ],
      titulos: [{
        id: 9,
        tipo: "pagar" as const,
        descricao: "Fornecedor de madeira",
        origem: "manual",
        categoria: "Matéria-prima",
        valorOriginal: "100.00",
        desconto: "0.00",
        juros: "0.00",
        dataVencimento: new Date(2026, 7, 16, 12),
        estado: "parcial" as const,
      }],
      baixas: [{
        id: 4,
        tituloId: 9,
        contaFinanceiraId: 1,
        tipo: "pagar" as const,
        valor: "25.00",
        dataBaixa: new Date(2026, 7, 13, 12),
        descricao: "Fornecedor de madeira",
        origem: "manual",
      }],
      transferencias: [
        { id: 22, contaFinanceiraId: 1, tipo: "entrada" as const, valor: "30.00", dataMovimento: new Date(2026, 7, 15, 12), descricao: "Caixa para banco" },
        { id: 23, contaFinanceiraId: 2, tipo: "saida" as const, valor: "30.00", dataMovimento: new Date(2026, 7, 15, 12), descricao: "Caixa para banco" },
      ],
      dataInicio: new Date(2026, 7, 14, 12),
      dataFim: new Date(2026, 7, 17, 12),
      dataReferencia: new Date(2026, 7, 14, 12),
    };

    const consolidado = montarFluxoCaixaGerencial(base);
    expect(consolidado.saldoAtual).toBe(125);
    expect(consolidado.saidasPrevistas).toBe(75);
    expect(consolidado.saldoProjetado).toBe(50);
    expect(consolidado.itensTransferencias).toEqual([]);
    expect(consolidado.porCategoria).toEqual([expect.objectContaining({ nome: "Matéria-prima", saidas: 75, saldo: -75 })]);

    const banco = montarFluxoCaixaGerencial({ ...base, contaFinanceiraId: 1 });
    expect(banco.saldoAtual).toBe(75);
    expect(banco.saldoProjetado).toBe(105);
    expect(banco.itensPrevistos).toEqual([]);
    expect(banco.itensTransferencias).toEqual([expect.objectContaining({ natureza: "entrada", valor: 30 })]);
  });

  it("desconsidera títulos cancelados, baixas estornadas e sinaliza pendências de extrato", () => {
    const fluxo = montarFluxoCaixaGerencial({
      contas: [{ id: 1, nome: "Banco", saldoInicial: "10.00" }],
      titulos: [{
        id: 2,
        tipo: "receber",
        descricao: "Venda cancelada",
        origem: "orcamento",
        valorOriginal: "500.00",
        desconto: "0.00",
        juros: "0.00",
        dataVencimento: new Date(2026, 7, 16, 12),
        estado: "cancelado",
      }],
      baixas: [{
        id: 3,
        tituloId: 2,
        contaFinanceiraId: 1,
        tipo: "receber",
        valor: "500.00",
        dataBaixa: new Date(2026, 7, 14, 12),
        descricao: "Venda cancelada",
        origem: "orcamento",
        estornada: true,
      }],
      transferencias: [],
      dataInicio: new Date(2026, 7, 14, 12),
      dataFim: new Date(2026, 7, 17, 12),
      dataReferencia: new Date(2026, 7, 14, 12),
      movimentosBancariosNaoConciliados: 2,
    });
    expect(fluxo.saldoAtual).toBe(10);
    expect(fluxo.entradasRealizadas).toBe(0);
    expect(fluxo.entradasPrevistas).toBe(0);
    expect(fluxo.movimentosBancariosNaoConciliados).toBe(2);
  });
});
