// Business-rule unit tests use an explicit server-side company fixture.
vi.mock("./identidade", async (importOriginal) => ({ ...await importOriginal<typeof import("./identidade")>(), getEmpresaUnica: vi.fn(async () => ({ id: 1, ativa: true })) }));
import { describe, expect, it, vi } from "vitest";
import { getContasOperacionais, listTitulosFinanceiros } from "./financeiro";

const agora = new Date(2026, 7, 11, 12);

function titulo(id: number, dados: Record<string, unknown> = {}) {
  return {
    id,
    empresaId: 1,
    tipo: "receber",
    origem: "manual",
    chaveImportacao: null,
    descricao: `Título ${id}`,
    clienteId: 1,
    fornecedorId: null,
    contraparteNome: null,
    orcamentoId: null,
    romaneioCargaId: null,
    notaDieselId: null,
    serragemTerceirosId: null,
    categoriaId: 10,
    recorrenciaId: null,
    grupoParcelamento: null,
    numeroParcela: null,
    totalParcelas: null,
    valorOriginal: "100.00",
    desconto: "0.00",
    juros: "0.00",
    valorBaixado: "0.00",
    dataEmissao: agora,
    dataVencimento: new Date(2026, 7, 10, 12),
    competencia: null,
    estado: "aberto",
    codigoBarrasBoleto: null,
    linhaDigitavelBoleto: null,
    boletoConfirmadoEm: null,
    observacoes: null,
    canceladoEm: null,
    canceladoPor: null,
    criadoPor: 1,
    createdAt: agora,
    updatedAt: agora,
    ...dados,
  } as any;
}

function baixa(id: number, tituloId: number, dados: Record<string, unknown> = {}) {
  return {
    id,
    tituloId,
    contaFinanceiraId: 5,
    valor: "40.00",
    dataBaixa: agora,
    formaPagamento: "pix",
    conciliada: false,
    estornada: false,
    ...dados,
  } as any;
}

function dependencias(titulos: any[], baixas: any[] = []) {
  return {
    empresaId: 1,
    agora,
    titulos,
    baixas,
    categorias: [{ id: 10, nome: "Vendas" }],
    clientes: [{ id: 1, nome: "Cliente A" }, { id: 2, nome: "Cliente B" }],
    fornecedores: [],
    contas: [{ id: 5, nome: "Banco principal" }, { id: 9, nome: "Caixa" }],
  };
}

describe("getContasOperacionais", () => {
  it("reconstrói o saldo pelas baixas válidas e compartilha o conjunto entre lista, cards e aging", async () => {
    const resultado = await getContasOperacionais({ tipo: "receber" }, dependencias([
      titulo(1),
      titulo(2, { estado: "quitado", valorBaixado: "100.00" }),
      titulo(3, { estado: "cancelado" }),
    ], [
      baixa(1, 1),
      baixa(2, 1, { valor: "20.00", estornada: true }),
      baixa(3, 2, { valor: "100.00" }),
    ]));

    expect(resultado.itens).toHaveLength(1);
    expect(resultado.itens[0]).toMatchObject({ id: 1, saldoAberto: 60, valorBaixado: 40, prioridade: "vencido" });
    expect(resultado.resumo).toMatchObject({ quantidade: 1, saldoAberto: 60, vencido: 60 });
    expect(resultado.resumo.aging["1_7"]).toBe(60);
  });

  it("trata conta financeira apenas como histórico de baixa e preserva títulos sem conta prevista", async () => {
    const dados = dependencias([
      titulo(1, { dataVencimento: new Date(2026, 7, 11, 12) }),
      titulo(2, { clienteId: 2, dataVencimento: new Date(2026, 7, 20, 12) }),
    ], [baixa(1, 1, { contaFinanceiraId: 5, conciliada: true })]);
    const porConta = await getContasOperacionais({ tipo: "receber", contaFinanceiraId: 5 }, dados);
    const semFiltro = await getContasOperacionais({ tipo: "receber" }, dados);

    expect(porConta.itens.map((item) => item.id)).toEqual([1]);
    expect(semFiltro.itens.map((item) => item.id)).toEqual([1, 2]);
    expect(semFiltro.itens[0].temBaixaConciliada).toBe(true);
    expect(semFiltro.convecaoContaFinanceira).toBeUndefined();
    expect(semFiltro.convencaoContaFinanceira).toContain("baixa válida");
  });

  it("aplica situação operacional e agrupamento aos mesmos títulos filtrados", async () => {
    const resultado = await getContasOperacionais({ tipo: "receber", situacao: "vence_hoje" }, dependencias([
      titulo(1, { dataVencimento: new Date(2026, 7, 11, 12), clienteId: 1 }),
      titulo(2, { dataVencimento: new Date(2026, 7, 10, 12), clienteId: 2 }),
    ]));

    expect(resultado.itens.map((item) => item.id)).toEqual([1]);
    expect(resultado.agrupamentos).toEqual([{ contraparte: "Cliente A", clienteId: 1, fornecedorId: null, quantidade: 1, saldoAberto: 100, vencido: 0 }]);
    expect(resultado.top5Contrapartes).toEqual(resultado.agrupamentos);
  });
  it("keeps the full aging summary while the operational list is filtered by band", async () => {
    const dados = dependencias([
      titulo(1, { origem: "manual", dataVencimento: new Date(2026, 7, 13, 12), valorOriginal: "300.00" }),
      titulo(2, { origem: "manual", dataVencimento: new Date(2026, 7, 11, 12), valorOriginal: "250.00" }),
      titulo(3, { origem: "manual", dataVencimento: new Date(2026, 6, 7, 12), valorOriginal: "500.00" }),
      titulo(4, { origem: "manual", dataVencimento: new Date(2026, 6, 20, 12), valorOriginal: "700.00" }),
      titulo(5, { origem: "orcamento", estado: "parcial", dataVencimento: new Date(2026, 6, 7, 12), valorOriginal: "125.00" }),
    ], [baixa(1, 5, { valor: "25.00" })]);

    const completo = await getContasOperacionais({ tipo: "receber" }, dados);
    const atraso31a60 = await getContasOperacionais({ tipo: "receber", aging: "31_60" }, dados);
    const faixaVazia = await getContasOperacionais({ tipo: "receber", aging: "61_90" }, dados);
    const parciaisAtraso31a60 = await getContasOperacionais({ tipo: "receber", estado: "parcial", aging: "31_60" }, dados);
    const semFaixa = await getContasOperacionais({ tipo: "receber" }, dados);

    expect(completo.resumo.aging).toMatchObject({ a_vencer: 300, vence_hoje: 250, "8_30": 700, "31_60": 600, "61_90": 0 });
    expect(atraso31a60.itens.map((item) => item.id)).toEqual([3, 5]);
    expect(atraso31a60.resumo.aging).toEqual(completo.resumo.aging);
    expect(faixaVazia.itens).toEqual([]);
    expect(faixaVazia.resumo.aging).toEqual(completo.resumo.aging);
    expect(parciaisAtraso31a60.itens.map((item) => item.id)).toEqual([5]);
    expect(parciaisAtraso31a60.resumo.aging).toMatchObject({ a_vencer: 0, vence_hoje: 0, "8_30": 0, "31_60": 100, "61_90": 0 });
    expect(semFaixa.itens).toHaveLength(5);
    expect(semFaixa.resumo.aging).toEqual(completo.resumo.aging);
  });
});

describe("listTitulosFinanceiros", () => {
  it("encontra recebível de serragem quitado pela data efetiva da baixa, mesmo com vencimento fora do período", async () => {
    const resultado = await listTitulosFinanceiros({
      tipo: "receber",
      estado: "quitado",
      origem: "serragem_terceiros",
      criterioData: "baixa",
      dataInicio: new Date(2026, 7, 11, 0, 0, 0),
      dataFim: new Date(2026, 7, 11, 23, 59, 59),
    }, {
      ...dependencias([
        titulo(1, {
          origem: "serragem_terceiros",
          estado: "quitado",
          serragemTerceirosId: 41,
          dataVencimento: new Date(2026, 6, 31, 12),
          valorBaixado: "100.00",
        }),
      ], [baixa(1, 1, { dataBaixa: new Date(2026, 7, 11, 12) })]),
      atualizarEstado: async (item) => item,
    });

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      id: 1,
      origem: "serragem_terceiros",
      dataUltimaBaixa: new Date(2026, 7, 11, 12),
    });
  });

  it("não inclui baixa estornada na pesquisa histórica", async () => {
    const resultado = await listTitulosFinanceiros({
      tipo: "receber",
      estado: "quitado",
      criterioData: "baixa",
      dataInicio: new Date(2026, 7, 11, 0, 0, 0),
      dataFim: new Date(2026, 7, 11, 23, 59, 59),
    }, {
      ...dependencias([titulo(1, { estado: "quitado", valorBaixado: "100.00" })], [
        baixa(1, 1, { dataBaixa: new Date(2026, 7, 11, 12), estornada: true }),
      ]),
      atualizarEstado: async (item) => item,
    });

    expect(resultado).toHaveLength(0);
  });
});
