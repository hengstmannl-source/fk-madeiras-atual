import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getCredencialPorEmail: vi.fn(),
  limparFalhasAutenticacao: vi.fn(),
  registrarFalhaAutenticacao: vi.fn(),
}));

const authMocks = vi.hoisted(() => ({
  criarSessaoLocal: vi.fn(() => "sessao-local-assinada"),
  normalizarEmail: vi.fn((email: string) => email.trim().toLowerCase()),
  validarSenha: vi.fn(),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./autenticacao-local", () => ({
  COOKIE_SESSAO_LOCAL: "fk_sessao_local",
  DURACAO_SESSAO_LOCAL_MS: 12 * 60 * 60 * 1000,
  criarSessaoLocal: authMocks.criarSessaoLocal,
  gerarHashSenha: vi.fn(),
  normalizarEmail: authMocks.normalizarEmail,
  validarSenha: authMocks.validarSenha,
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext() {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const ctx: TrpcContext = {
    user: null,
    configuracaoEmpresa: { id: 1, nome: "FK Madeiras", ativa: true },
    req: { protocol: "http", headers: {} } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, cookies };
}

describe("auth.entrar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria uma sessão HttpOnly com o perfil operacional direto do utilizador", async () => {
    dbMocks.getCredencialPorEmail.mockResolvedValue({
      credencial: { id: 8, senhaHash: "hash", bloqueadoAte: null, tentativasFalhas: 0 },
      usuario: { id: 34, papel: "vendas" },
    });
    authMocks.validarSenha.mockResolvedValue(true);
    const { ctx, cookies } = createPublicContext();

    const result = await appRouter.createCaller(ctx).auth.entrar({
      email: "VENDAS@FKMADEIRAS.COM",
      senha: "SenhaForte2026",
    });

    expect(result).toEqual({ success: true, empresa: { id: 1, nome: "FK Madeiras", ativa: true }, papel: "vendas" });
    expect(authMocks.normalizarEmail).toHaveBeenCalledWith("VENDAS@FKMADEIRAS.COM");
    expect(cookies).toEqual([
      expect.objectContaining({
        name: "fk_sessao_local",
        value: "sessao-local-assinada",
        options: expect.objectContaining({
          httpOnly: true,
          sameSite: "lax",
          secure: false,
          path: "/",
        }),
      }),
    ]);
  });

  it("não cria sessão quando a senha é inválida", async () => {
    dbMocks.getCredencialPorEmail.mockResolvedValue({
      credencial: { id: 8, senhaHash: "hash", bloqueadoAte: null, tentativasFalhas: 0 },
      usuario: { id: 34 },
    });
    authMocks.validarSenha.mockResolvedValue(false);
    const { ctx, cookies } = createPublicContext();

    await expect(
      appRouter.createCaller(ctx).auth.entrar({ email: "vendas@fkmadeiras.com", senha: "SenhaIncorreta2026" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(cookies).toHaveLength(0);
    expect(authMocks.criarSessaoLocal).not.toHaveBeenCalled();
  });
});
