import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({
  regularizarVolumePlaquetaConsumida: vi.fn(),
}));

import * as db from "../db";
import { producaoRouter } from "./producao";

function contexto(papel: string) {
  return {
    user: {
      id: 52,
      openId: "teste-regularizacao-volume",
      name: "Responsável de teste",
      email: "regularizacao@exemplo.com",
      loginMethod: "manus",
      role: "user",
      papel,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    configuracaoEmpresa: { id: 7, nome: "FK Madeiras", ativa: true },
  } as unknown as TrpcContext;
}

describe("producaoRouter.plaquetas.regularizarVolumeConsumido", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restringe a regularização de volume a administradores", async () => {
    const caller = producaoRouter.createCaller(contexto("financeiro"));

    await expect(caller.plaquetas.regularizarVolumeConsumido({
      plaquetaId: 31,
      volumeConfirmado: "3,250",
      justificativa: "Medição conferida na tora já processada.",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.regularizarVolumePlaquetaConsumida).not.toHaveBeenCalled();
  });

  it("encaminha a regularização com volume normalizado, usuário e empresa ativos", async () => {
    vi.mocked(db.regularizarVolumePlaquetaConsumida).mockResolvedValue({ regularizacaoId: 9 } as never);
    const caller = producaoRouter.createCaller(contexto("administrador"));

    await caller.plaquetas.regularizarVolumeConsumido({
      plaquetaId: 31,
      volumeConfirmado: "3,250",
      justificativa: "Medição conferida na tora já processada.",
    });

    expect(db.regularizarVolumePlaquetaConsumida).toHaveBeenCalledWith({
      plaquetaId: 31,
      volumeConfirmado: "3.250",
      justificativa: "Medição conferida na tora já processada.",
      criadoPor: 52,
      empresaId: 7,
    });
  });

  it("recusa volume não positivo e justificativa insuficiente antes de alterar qualquer registro", async () => {
    const caller = producaoRouter.createCaller(contexto("administrador"));

    await expect(caller.plaquetas.regularizarVolumeConsumido({
      plaquetaId: 31,
      volumeConfirmado: "0",
      justificativa: "curta",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.regularizarVolumePlaquetaConsumida).not.toHaveBeenCalled();
  });
});
