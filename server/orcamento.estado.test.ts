import { describe, expect, it, vi } from "vitest";
import { atribuirNumeroVendaAprovada, atualizarDatasOrcamento, cancelarRecebivelDeVendaExcluida, configurarCondicaoPagamentoVenda, entregarVendaFisicamente, formatarNumeroDocumentoPadronizado, listTitulosFinanceiros, updateOrcamentoEstado } from "./db";
import { formatReceivableSaleReference } from "../client/src/lib/utils";

function criarBancoDeOrcamentoFalso() {
  const historicos: any[] = [];
  const db = {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({ limit: async () => [{ id: 150001, pago: false }] }),
      }),
    })),
    update: vi.fn(() => ({
      set: () => ({ where: async () => undefined }),
    })),
    insert: vi.fn(() => ({
      values: async (valor: any) => {
        historicos.push(valor);
        return [{ insertId: 1 }];
      },
    })),
  };
  return { db, historicos };
}

describe("mudança de estado de orçamento", () => {
  it("envia o orçamento e grava o histórico de estado", async () => {
    const { db, historicos } = criarBancoDeOrcamentoFalso();

    await updateOrcamentoEstado(150001, "enviado", 1, false, { database: db });

    expect(historicos).toEqual([{
      orcamentoId: 150001,
      usuarioId: 1,
      tipo: "estado",
      detalhes: JSON.stringify({ novoEstado: "enviado" }),
    }]);
  });

  it("aprova o orçamento, grava o histórico e cria o recebível", async () => {
    const { db, historicos } = criarBancoDeOrcamentoFalso();
    const criarTituloReceber = vi.fn().mockResolvedValue({ id: 101 });
    const atribuirNumero = vi.fn().mockResolvedValue("VND-000123");

    await updateOrcamentoEstado(150001, "aprovado", 1, false, { database: db, criarTituloReceber, atribuirNumero });

    expect(historicos[0]).toMatchObject({
      orcamentoId: 150001,
      usuarioId: 1,
      tipo: "estado",
      detalhes: JSON.stringify({ novoEstado: "aprovado", numero: "VND-000123" }),
    });
    expect(atribuirNumero).toHaveBeenCalledWith(150001);
    expect(criarTituloReceber).toHaveBeenCalledWith(150001, 1);
  });

  it("apresenta o número definitivo da venda no recebível listado após a aprovação", async () => {
    const { db } = criarBancoDeOrcamentoFalso();
    const tituloAprovado = {
      id: 101,
      origem: "orcamento",
      descricao: "Venda VND-000123",
      tipo: "receber",
      estado: "aberto",
      dataVencimento: new Date(2030, 0, 15),
    };
    const criarTituloReceber = vi.fn().mockResolvedValue(tituloAprovado);

    await updateOrcamentoEstado(150001, "aprovado", 1, false, {
      database: db,
      criarTituloReceber,
      atribuirNumero: vi.fn().mockResolvedValue("VND-000123"),
    });

    const bancoFinanceiro = {
      select: vi.fn(() => ({
        from: () => ({
          where: () => ({ orderBy: async () => [tituloAprovado] }),
        }),
      })),
    };
    const recebiveis = await listTitulosFinanceiros({ tipo: "receber" }, { database: bancoFinanceiro, atualizarEstado: async (titulo) => titulo });

    expect(criarTituloReceber).toHaveBeenCalledWith(150001, 1);
    expect(recebiveis).toHaveLength(1);
    expect(formatReceivableSaleReference(recebiveis[0].origem, recebiveis[0].descricao)).toBe("Venda vinculada · VND-000123");
  });

  it("reserva uma numeração padronizada e sequencial ao aprovar a venda", async () => {
    const atualizacoes: any[] = [];
    const reservas: any[] = [];
    const db = {
      select: vi.fn()
        .mockImplementationOnce(() => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 150001, empresaId: 77, numero: null }] }) }) }))
        .mockImplementationOnce(() => ({ from: () => ({ where: () => ({ limit: async () => [{ ultimoNumero: 1 }] }) }) })),
      insert: vi.fn(() => ({ values: (dados: any) => {
        reservas.push(dados);
        return { onDuplicateKeyUpdate: async () => undefined };
      } })),
      update: vi.fn(() => ({ set: (dados: any) => { atualizacoes.push(dados); return { where: async () => undefined }; } })),
    };
    await expect(atribuirNumeroVendaAprovada(150001, db)).resolves.toBe("VEN-000001");
    expect(reservas).toEqual([
      { empresaId: 1, tipo: "venda", ultimoNumero: 1 },
      { empresaId: 1, orcamentoId: 150001, numero: "VEN-000001" },
    ]);
    expect(atualizacoes).toEqual([{ numero: "VEN-000001" }]);
  });

  it("formata os números futuros de venda e romaneio de entrada a partir de um", () => {
    expect(formatarNumeroDocumentoPadronizado("venda", 1)).toBe("VEN-000001");
    expect(formatarNumeroDocumentoPadronizado("venda", 23)).toBe("VEN-000023");
    expect(formatarNumeroDocumentoPadronizado("romaneio_entrada", 1)).toBe("ROM-000001");
    expect(() => formatarNumeroDocumentoPadronizado("venda", 0)).toThrow("inteiro positivo");
  });

  it("cancela o recebível sem baixa antes de excluir uma venda aprovada", async () => {
    const atualizacoes: any[] = [];
    const db = {
      select: vi.fn(() => ({ from: () => ({ where: async () => [{ id: 101, valorBaixado: "0", estado: "aberto" }] }) })),
      update: vi.fn(() => ({ set: (dados: any) => { atualizacoes.push(dados); return { where: async () => undefined }; } })),
    };
    await expect(cancelarRecebivelDeVendaExcluida(150001, 1, db)).resolves.toMatchObject({ cancelado: true, tituloId: 101 });
    expect(atualizacoes[0]).toMatchObject({ estado: "cancelado", canceladoPor: 1 });
    expect(atualizacoes[1]).toHaveProperty("resolvidoEm");
  });

  it("atualiza vencimento e competência da venda e do recebível vinculado", async () => {
    const atualizacoes: any[] = [];
    const venda = { id: 150001, pago: false };
    const titulo = {
      id: 101,
      valorOriginal: "1500.00",
      desconto: "0",
      juros: "0",
      valorBaixado: "0",
      estado: "aberto",
    };
    const db = {
      select: vi.fn()
        .mockImplementationOnce(() => ({ from: () => ({ where: () => ({ limit: async () => [venda] }) }) }))
        .mockImplementationOnce(() => ({ from: () => ({ where: async () => [titulo] }) })),
      update: vi.fn(() => ({
        set: (dados: any) => {
          atualizacoes.push(dados);
          return { where: async () => undefined };
        },
      })),
    };
    const dataVencimento = new Date(2030, 4, 15, 12);
    const competencia = new Date(2030, 4, 1, 12);

    const resultado = await atualizarDatasOrcamento(150001, { dataVencimento, competencia }, false, db);

    expect(resultado).toEqual({ success: true, tituloAtualizado: true, parcelasPreservadas: false });
    expect(atualizacoes[0]).toEqual({ dataVencimento, competencia });
    expect(atualizacoes[1]).toMatchObject({ dataVencimento, competencia, estado: "aberto" });
  });

  it("substitui o recebível único por parcelas rastreáveis sem perder centavos", async () => {
    const atualizacoes: any[] = [];
    const insercoes: any[] = [];
    const parcelasCriadas = [
      { id: 201, numeroParcela: 1, totalParcelas: 3, dataVencimento: new Date("2030-01-30T12:00:00"), valorOriginal: "333.34" },
      { id: 202, numeroParcela: 2, totalParcelas: 3, dataVencimento: new Date("2030-03-01T12:00:00"), valorOriginal: "333.33" },
      { id: 203, numeroParcela: 3, totalParcelas: 3, dataVencimento: new Date("2030-03-31T12:00:00"), valorOriginal: "333.33" },
    ];
    let selecao = 0;
    const tx = {
      select: vi.fn(() => ({
        from: () => ({
          where: () => {
            selecao += 1;
            if (selecao === 1) return { limit: async () => [{ id: 150001, estado: "aprovado", pago: false, total: "1000.00", numero: "VND-000123", clienteId: 11, competencia: new Date("2030-01-01T12:00:00") }] };
            if (selecao === 2) return [{ id: 101, estado: "aberto", valorBaixado: "0" }];
            if (selecao === 3) return [];
            if (selecao <= 9) return { limit: async () => [] };
            return { orderBy: async () => parcelasCriadas };
          },
        }),
      })),
      update: vi.fn(() => ({ set: (dados: any) => { atualizacoes.push(dados); return { where: async () => undefined }; } })),
      insert: vi.fn(() => ({ values: async (dados: any) => { insercoes.push(dados); return [{ insertId: 1 }]; } })),
    };
    const database = { transaction: async (executar: (transacao: typeof tx) => unknown) => executar(tx) };

    const resultado = await configurarCondicaoPagamentoVenda(150001, [
      { dataVencimento: new Date("2030-03-31T12:00:00") },
      { dataVencimento: new Date("2030-01-30T12:00:00") },
      { dataVencimento: new Date("2030-03-01T12:00:00") },
    ], 9, { database, obterCategoriaReceita: async () => 70 });

    expect(atualizacoes).toContainEqual(expect.objectContaining({ estado: "cancelado" }));
    expect(atualizacoes).toContainEqual(expect.objectContaining({ canceladoPor: 9 }));
    const insercoesParcelas = insercoes.filter((titulo) => titulo.numeroParcela != null);
    expect(insercoesParcelas).toHaveLength(3);
    expect(insercoesParcelas.map((parcela: any) => parcela.valorOriginal)).toEqual(["333.34", "333.33", "333.33"]);
    expect(insercoesParcelas.map((parcela: any) => [parcela.numeroParcela, parcela.totalParcelas])).toEqual([[1, 3], [2, 3], [3, 3]]);
    expect(resultado.parcelas.map((parcela) => parcela.id)).toEqual([201, 202, 203]);
  });

  it("impede alterar a condição quando uma parcela já possui baixa", async () => {
    let selecao = 0;
    const tx = {
      select: vi.fn(() => ({
        from: () => ({
          where: () => {
            selecao += 1;
            if (selecao === 1) return { limit: async () => [{ id: 150001, estado: "aprovado", pago: false, total: "1000.00" }] };
            return [{ id: 101, estado: "parcial", valorBaixado: "100.00" }];
          },
        }),
      })),
      update: vi.fn(),
      insert: vi.fn(),
    };
    const database = { transaction: async (executar: (transacao: typeof tx) => unknown) => executar(tx) };

    await expect(configurarCondicaoPagamentoVenda(150001, [{ dataVencimento: new Date("2030-01-30T12:00:00") }], 9, {
      database,
      obterCategoriaReceita: async () => 70,
    })).rejects.toThrow("possui parcelas baixadas");
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("baixa peças serradas vendidas por metro cúbico ao confirmar a entrega", async () => {
    const atualizacoes: any[] = [];
    const insercoes: any[] = [];
    const venda = { id: 150001, empresaId: 7, estado: "aprovado", entregue: false, numero: "VND-000123" };
    const itemM3 = { id: 91, madeiraNome: "Cedrinho", espessura: "25", largura: "150", comprimento: "3", quantidade: "5", tipoComercializacao: "metro_cubico" };
    const lote = { id: 301, madeiraNome: "Cedrinho", espessura: "2.50", largura: "15.00", comprimento: "3.00", quantidadeDisponivel: 12, propriedade: "proprio", tipo: "peca" };
    const tx = {
      select: vi.fn()
        .mockImplementationOnce(() => ({ from: () => ({ where: () => ({ limit: async () => [venda] }) }) }))
        .mockImplementationOnce(() => ({ from: () => ({ where: async () => [itemM3] }) }))
        .mockImplementationOnce(() => ({ from: () => ({ where: async () => [lote] }) })),
      update: vi.fn(() => ({ set: (dados: any) => { atualizacoes.push(dados); return { where: async () => undefined }; } })),
      insert: vi.fn(() => ({ values: async (dados: any) => { insercoes.push(dados); return [{ insertId: 1 }]; } })),
    };
    const database = { transaction: async (executar: (transacao: typeof tx) => unknown) => executar(tx) };
    const entregueEm = new Date("2030-01-15T12:00:00");

    const resultado = await entregarVendaFisicamente(150001, 9, {
      entregueEm,
      modalidadeEntrega: "retirada",
      responsavelEntrega: "Expedição",
    }, { database });

    expect(resultado).toMatchObject({ success: true, pecasEntregues: 5, pecasSemEstoque: 0 });
    expect(atualizacoes[0]).toMatchObject({ quantidadeDisponivel: 7, estado: "disponivel" });
    expect(insercoes[0]).toMatchObject({ tipo: "saida_entrega", loteId: 301, itemVendaId: 91, quantidade: 5 });
  });

  it("cria um lote negativo vinculado à empresa quando a entrega supera o saldo", async () => {
    const insercoes: any[] = [];
    const venda = { id: 150001, empresaId: 7, estado: "aprovado", entregue: false, numero: "VEN-000001" };
    const itemM3 = { id: 91, madeiraNome: "Cedrinho", espessura: "25", largura: "150", comprimento: "3", quantidade: "5", tipoComercializacao: "metro_cubico" };
    const tx = {
      select: vi.fn()
        .mockImplementationOnce(() => ({ from: () => ({ where: () => ({ limit: async () => [venda] }) }) }))
        .mockImplementationOnce(() => ({ from: () => ({ where: async () => [itemM3] }) }))
        .mockImplementationOnce(() => ({ from: () => ({ where: async () => [] }) })),
      update: vi.fn(() => ({ set: () => ({ where: async () => undefined }) })),
      insert: vi.fn(() => ({ values: async (dados: any) => { insercoes.push(dados); return [{ insertId: 401 }]; } })),
    };
    const database = { transaction: async (executar: (transacao: typeof tx) => unknown) => executar(tx) };

    const resultado = await entregarVendaFisicamente(150001, 9, {
      entregueEm: new Date("2030-01-15T12:00:00"),
      modalidadeEntrega: "retirada",
      responsavelEntrega: "Expedição",
    }, { database });

    expect(resultado).toMatchObject({ success: true, pecasEntregues: 5, pecasSemEstoque: 5 });
    expect(insercoes[0]).toMatchObject({ empresaId: 7, quantidadeDisponivel: -5, estado: "negativo" });
    expect(insercoes[1]).toMatchObject({ empresaId: 7, loteId: 401, tipo: "saida_entrega", quantidade: 5 });
  });
});
