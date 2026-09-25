import { describe, expect, it } from "vitest";
import { montarPerfilCliente } from "./clientePerfil.logic";

describe("montarPerfilCliente", () => {
  it("soma apenas pedidos aprovados no total comprado e mantém todos no histórico", () => {
    const perfil = montarPerfilCliente({ id: 8, nome: "Cliente Exemplo" }, [
      { id: 1, numero: "VND-000001", estado: "aprovado", total: "1250.00", pago: true, entregue: false, dataVencimento: null, createdAt: new Date("2026-08-20") },
      { id: 2, numero: null, estado: "enviado", total: "900.00", pago: false, entregue: false, dataVencimento: null, createdAt: new Date("2026-08-19") },
    ], []);

    expect(perfil.resumo).toMatchObject({ totalComprado: 1250, pedidosConfirmados: 1, pedidosRegistrados: 2, totalEmAberto: 0 });
    expect(perfil.historicoPedidos).toHaveLength(2);
    expect(perfil.ultimosPedidos).toHaveLength(2);
  });

  it("calcula somente títulos a receber ainda abertos, com o saldo após baixas", () => {
    const perfil = montarPerfilCliente({ id: 8 }, [], [
      { id: 10, descricao: "Venda VND-1", origem: "orcamento", orcamentoId: 1, valorOriginal: "1000", desconto: "50", juros: "10", valorBaixado: "400", dataVencimento: new Date("2026-08-30"), estado: "parcial" },
      { id: 11, descricao: "Venda quitada", origem: "orcamento", orcamentoId: 2, valorOriginal: "500", desconto: "0", juros: "0", valorBaixado: "500", dataVencimento: new Date("2026-08-15"), estado: "quitado" },
      { id: 12, descricao: "Venda cancelada", origem: "orcamento", orcamentoId: 3, valorOriginal: "100", desconto: "0", juros: "0", valorBaixado: "0", dataVencimento: new Date("2026-08-15"), estado: "cancelado" },
    ]);

    expect(perfil.resumo).toMatchObject({ titulosEmAberto: 1, totalEmAberto: 560 });
    expect(perfil.titulosAbertos[0]).toMatchObject({ id: 10, saldoAberto: 560 });
  });
});
