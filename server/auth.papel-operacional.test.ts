import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getCredencialPorEmail: vi.fn(),
  limparFalhasAutenticacao: vi.fn(),
  registrarFalhaAutenticacao: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({
  criarSessaoLocal: vi.fn(() => "session"),
  normalizarEmail: vi.fn((email: string) => email.trim().toLowerCase()),
  validarSenha: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./autenticacao-local", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./autenticacao-local")>()),
  criarSessaoLocal: authMocks.criarSessaoLocal,
  normalizarEmail: authMocks.normalizarEmail,
  validarSenha: authMocks.validarSenha,
}));

import { appRouter } from "./routers";

function contexto() {
  return {
    user: null,
    configuracaoEmpresa: { id: 1, nome: "FK Madeiras", ativa: true },
    req: { protocol: "https", headers: {} },
    res: { cookie: vi.fn() },
  } as unknown as TrpcContext;
}

describe("papéis operacionais inválidos na autenticação", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["consulta", "perfil_inexistente"])("não cria sessão para papel %s", async (papel) => {
    dbMocks.getCredencialPorEmail.mockResolvedValue({
      credencial: { id: 8, senhaHash: "hash", bloqueadoAte: null, tentativasFalhas: 0 },
      usuario: { id: 34, papel },
    });
    authMocks.validarSenha.mockResolvedValue(true);
    const ctx = contexto();

    await expect(appRouter.createCaller(ctx).auth.entrar({ email: "usuario@example.com", senha: "SenhaForte2026" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(authMocks.criarSessaoLocal).not.toHaveBeenCalled();
    expect(dbMocks.limparFalhasAutenticacao).not.toHaveBeenCalled();
    expect(ctx.res.cookie).not.toHaveBeenCalled();
  });

  it.each(["consulta", "perfil_inexistente"])("auth.me rejeita sessão com papel %s", async (papel) => {
    const ctx = { ...contexto(), user: { id: 34, papel, role: "user" } } as unknown as TrpcContext;
    await expect(appRouter.createCaller(ctx).auth.me()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
