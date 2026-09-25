import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({
  importarExtratoBancario: vi.fn(),
  listConciliacaoBancaria: vi.fn(),
  confirmarConciliacaoBancaria: vi.fn(),
  desfazerConciliacaoBancaria: vi.fn(),
  criarLancamentoDaConciliacao: vi.fn(),
  definirEstadoMovimentoBancario: vi.fn(),
  getRelatorioFluxoCaixa: vi.fn(),
  getPrevisaoSemanalCaixa: vi.fn(),
}));

import * as db from "../db";
import { financeiroRouter } from "./financeiro";

const ctxSistema = {
  user: {
    id: 7,
    openId: "teste-financeiro",
    name: "Utilizador de Teste",
    email: "teste@exemplo.com",
    loginMethod: "manus",
    role: "user",
    papel: "financeiro",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  configuracaoEmpresa: { id: 1, nome: "FK Madeiras", ativa: true },
} as unknown as TrpcContext;

describe("financeiro.conciliacao - empresa única", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.importarExtratoBancario).mockResolvedValue({ importados: 1, erros: [] });
    vi.mocked(db.listConciliacaoBancaria).mockResolvedValue([]);
    vi.mocked(db.confirmarConciliacaoBancaria).mockResolvedValue({ success: true });
    vi.mocked(db.desfazerConciliacaoBancaria).mockResolvedValue({ success: true });
    vi.mocked(db.criarLancamentoDaConciliacao).mockResolvedValue({ success: true });
    vi.mocked(db.definirEstadoMovimentoBancario).mockResolvedValue({ success: true });
    vi.mocked(db.getRelatorioFluxoCaixa).mockResolvedValue({ saldoInicial: 0, entradas: 0, saidas: 0, saldoFinal: 0, movimentacoes: [] });
    vi.mocked(db.getPrevisaoSemanalCaixa).mockResolvedValue([]);
  });

  it("usa a configuração empresarial global nas operações de conciliação", async () => {
    const caller = financeiroRouter.createCaller(ctxSistema);

    await caller.conciliacao.importar({
      contaFinanceiraId: 12,
      nomeArquivo: "extrato.csv",
      formato: "csv",
      conteudo: "data;descricao;valor",
    });
    await caller.conciliacao.list({ estado: "pendente" });
    await caller.conciliacao.confirmar({ movimentoId: 21, baixaFinanceiraId: 34 });
    await caller.conciliacao.desfazer({ movimentoId: 21 });
    await caller.conciliacao.criarLancamento({ movimentoId: 21, categoriaId: 5, descricao: "Ajuste de extrato" });
    await caller.conciliacao.definirEstado({ movimentoId: 21, estado: "ignorado", observacoes: "Duplicado" });

    expect(db.importarExtratoBancario).toHaveBeenCalledWith(expect.objectContaining({ contaFinanceiraId: 12 }), 7);
    expect(db.listConciliacaoBancaria).toHaveBeenCalledWith({ estado: "pendente" });
    expect(db.confirmarConciliacaoBancaria).toHaveBeenCalledWith({ movimentoId: 21, baixaFinanceiraId: 34 }, 7);
    expect(db.desfazerConciliacaoBancaria).toHaveBeenCalledWith(21, 7, undefined);
    expect(db.criarLancamentoDaConciliacao).toHaveBeenCalledWith(expect.objectContaining({ movimentoId: 21, categoriaId: 5 }), 7);
    expect(db.definirEstadoMovimentoBancario).toHaveBeenCalledWith(expect.objectContaining({ movimentoId: 21, estado: "ignorado" }), 7);
  });

  it("não recebe empresa escolhida pelo utilizador nos relatórios de fluxo e previsão", async () => {
    const caller = financeiroRouter.createCaller(ctxSistema);

    await caller.relatorios.fluxoCaixa({ dataInicio: "2026-08-01", dataFim: "2026-08-31" });
    await caller.relatorios.previsaoSemanal({ semanas: 4 });

    expect(db.getRelatorioFluxoCaixa).toHaveBeenCalledWith({
      dataInicio: expect.any(Date),
      dataFim: expect.any(Date),
    });
    expect(db.getPrevisaoSemanalCaixa).toHaveBeenCalledWith(4);
  });
});
