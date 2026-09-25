import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getConfiguracaoFinanceiraByTaskUid: vi.fn(),
  processarRecorrenciasFinanceiras: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest: vi.fn() },
}));

import * as db from "./db";
import { sdk } from "./_core/sdk";
import { registerFinanceiroScheduleRoutes } from "./scheduledFinanceiro";

function registrarRota() {
  let handler: ((req: any, res: any) => Promise<unknown>) | undefined;
  registerFinanceiroScheduleRoutes({
    post: (_caminho: string, callback: (req: any, res: any) => Promise<unknown>) => { handler = callback; },
  } as any);
  if (!handler) throw new Error("Rota agendada não foi registrada");
  return handler;
}

function criarResposta() {
  const resposta: any = {
    status: vi.fn(),
    json: vi.fn(),
  };
  resposta.status.mockImplementation((codigo: number) => {
    resposta.codigo = codigo;
    return resposta;
  });
  resposta.json.mockImplementation((corpo: unknown) => {
    resposta.corpo = corpo;
    return resposta;
  });
  return resposta;
}

describe("rota agendada do financeiro", () => {
  beforeEach(() => vi.clearAllMocks());

  it("bloqueia requisições que não pertencem a uma tarefa autorizada", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ isCron: false } as any);
    const resposta = criarResposta();

    await registrarRota()({} as any, resposta);

    expect(resposta.status).toHaveBeenCalledWith(403);
    expect(resposta.json).toHaveBeenCalledWith({ error: "cron-only" });
    expect(db.processarRecorrenciasFinanceiras).not.toHaveBeenCalled();
  });

  it("executa o processamento autorizado e devolve as contagens de alertas", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ isCron: true, taskUid: "financeiro-diario" } as any);
    vi.mocked(db.getConfiguracaoFinanceiraByTaskUid).mockResolvedValue({ id: 1 } as any);
    vi.mocked(db.processarRecorrenciasFinanceiras).mockResolvedValue({
      titulosGerados: 2,
      recorrenciasAnalisadas: 3,
      alertasCriados: 1,
      alertasResolvidos: 1,
    });
    const resposta = criarResposta();

    await registrarRota()({} as any, resposta);

    expect(db.processarRecorrenciasFinanceiras).toHaveBeenCalledTimes(1);
    expect(resposta.json).toHaveBeenCalledWith({
      ok: true,
      titulosGerados: 2,
      recorrenciasAnalisadas: 3,
      alertasCriados: 1,
      alertasResolvidos: 1,
    });
  });
});
