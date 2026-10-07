import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  criarConviteEmpresa: vi.fn(),
  getConviteValidoPorHash: vi.fn(),
  aceitarConviteCriandoUsuario: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({
  criarSessaoLocal: vi.fn(() => "session"),
  gerarHashSenha: vi.fn(async () => "hash"),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./autenticacao-local", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./autenticacao-local")>()),
  criarSessaoLocal: authMocks.criarSessaoLocal,
  gerarHashSenha: authMocks.gerarHashSenha,
}));

import { appRouter } from "./routers";

function contexto() {
  return {
    user: { id: 1, role: "user", papel: "proprietario" },
    configuracaoEmpresa: { id: 1, nome: "FK Madeiras", ativa: true },
    req: { protocol: "https", headers: {} },
    res: { cookie: vi.fn() },
  } as unknown as TrpcContext;
}

function convite(papel: string) {
  return { convite: { emailNormalizado: "pessoa@example.com", papel }, empresa: { ativa: true } };
}

describe("equipe.convites sem papéis removidos", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["consulta", "perfil_inexistente"])("rejeita a criação de convite com papel %s", async (papel) => {
    const caller = appRouter.createCaller(contexto());
    await expect(caller.equipe.criarConvite({ email: "pessoa@example.com", papel } as never)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.criarConviteEmpresa).not.toHaveBeenCalled();
  });

  it.each(["consulta", "perfil_inexistente"])("não apresenta convite persistido com papel %s como válido", async (papel) => {
    dbMocks.getConviteValidoPorHash.mockResolvedValue(convite(papel));
    const caller = appRouter.createCaller(contexto());
    await expect(caller.equipe.consultarConvite({ token: "token-de-teste-longo-o-bastante" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it.each(["consulta", "perfil_inexistente"])("não aceita convite persistido com papel %s", async (papel) => {
    dbMocks.getConviteValidoPorHash.mockResolvedValue(convite(papel));
    const caller = appRouter.createCaller(contexto());
    await expect(caller.equipe.aceitarConvite({ token: "token-de-teste-longo-o-bastante", nome: "Pessoa Teste", senha: "SenhaTeste123" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.aceitarConviteCriandoUsuario).not.toHaveBeenCalled();
  });

  it("continua aceitando convite com papel válido", async () => {
    dbMocks.getConviteValidoPorHash.mockResolvedValue(convite("vendas"));
    dbMocks.aceitarConviteCriandoUsuario.mockResolvedValue({ usuarioId: 42 });
    const ctx = contexto();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.equipe.aceitarConvite({ token: "token-de-teste-longo-o-bastante", nome: "Pessoa Teste", senha: "SenhaTeste123" })).resolves.toEqual({ success: true });
    expect(dbMocks.aceitarConviteCriandoUsuario).toHaveBeenCalledWith(expect.objectContaining({ tokenHash: expect.any(String) }));
    expect(ctx.res.cookie).toHaveBeenCalledOnce();
  });
});
