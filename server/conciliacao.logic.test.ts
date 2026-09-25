import { describe, expect, it } from "vitest";
import { sugerirConciliacoes, sugerirTransferenciasInternas } from "./conciliacao.logic";

describe("sugerirConciliacoes", () => {
  it("prioriza baixa com mesma natureza, valor, data próxima e descrição relacionada", () => {
    const sugestoes = sugerirConciliacoes({ tipo: "entrada", valor: "1250.00", dataMovimento: "2026-09-03", descricao: "PIX recebido Madeireira Norte" }, [
      { id: 4, tituloId: 8, tipoTitulo: "receber", valor: "1250.00", dataBaixa: "2026-09-02", descricaoTitulo: "Venda Madeireira Norte", contraparteNome: "Madeireira Norte" },
      { id: 5, tituloId: 9, tipoTitulo: "pagar", valor: "1250.00", dataBaixa: "2026-09-02", descricaoTitulo: "Frete", contraparteNome: "Transportadora" },
      { id: 6, tituloId: 10, tipoTitulo: "receber", valor: "1250.00", dataBaixa: "2026-08-01", descricaoTitulo: "Venda antiga", contraparteNome: null },
    ]);

    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ id: 4, pontuacao: 100 });
    expect(sugestoes[0].motivo).toContain("descrição relacionada");
  });
});

describe("sugerirTransferenciasInternas", () => {
  it("sugere somente o lado espelhado de transferência da mesma conta, sentido e valor", () => {
    const sugestoes = sugerirTransferenciasInternas({
      contaFinanceiraId: 4,
      tipo: "saida",
      valor: "1850.00",
      dataMovimento: "2026-09-03",
      descricao: "PIX transferência entre contas",
    }, [
      { id: 12, transferenciaId: 7, contaFinanceiraId: 4, tipo: "saida", valor: "1850.00", dataMovimento: "2026-09-02", descricao: "Transferência para Banco", contaContrapartidaNome: "Banco" },
      { id: 13, transferenciaId: 7, contaFinanceiraId: 8, tipo: "entrada", valor: "1850.00", dataMovimento: "2026-09-02", descricao: "Transferência de Caixa", contaContrapartidaNome: "Caixa" },
      { id: 14, transferenciaId: 8, contaFinanceiraId: 4, tipo: "saida", valor: "850.00", dataMovimento: "2026-09-03", descricao: "Transferência divergente", contaContrapartidaNome: "Caixa" },
    ]);

    expect(sugestoes).toHaveLength(1);
    expect(sugestoes[0]).toMatchObject({ id: 12, transferenciaId: 7 });
    expect(sugestoes[0].motivo).toContain("transferência interna");
    expect(sugestoes[0].motivo).toContain("contrapartida: Banco");
  });
});
