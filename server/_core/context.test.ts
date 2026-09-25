import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  getEmpresaUnica: vi.fn(),
}));

const localAuthMocks = vi.hoisted(() => ({ lerSessaoLocal: vi.fn() }));
const sdkMocks = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));

vi.mock("../db", () => dbMocks);
vi.mock("../autenticacao-local", () => ({
  COOKIE_SESSAO_LOCAL: "fk_sessao_local",
  lerSessaoLocal: localAuthMocks.lerSessaoLocal,
}));
vi.mock("./sdk", () => ({ sdk: sdkMocks }));

import { createContext } from "./context";

function request(cookie?: string) {
  return {
    req: { headers: cookie ? { cookie } : {}, protocol: "http" },
    res: {},
  } as Parameters<typeof createContext>[0];
}

describe("contexto autenticado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deriva a empresa única e o perfil direto do usuário autenticado pela sessão local", async () => {
    const user = { id: 34, openId: "local:34", role: "user", papel: "vendas" };
    const empresa = { id: 1, nome: "FK Madeiras", ativa: true };
    localAuthMocks.lerSessaoLocal.mockReturnValue({ usuarioId: 34, expiraEm: Date.now() + 1000 });
    dbMocks.getUserById.mockResolvedValue(user);
    dbMocks.getEmpresaUnica.mockResolvedValue(empresa);

    const ctx = await createContext(request("fk_sessao_local=sessao-valida"));

    expect(ctx.user).toBe(user);
    expect(ctx.configuracaoEmpresa).toBe(empresa);
    expect(dbMocks.getEmpresaUnica).toHaveBeenCalledOnce();
    expect(sdkMocks.authenticateRequest).not.toHaveBeenCalled();
  });

  it("usa o usuário da sessão OAuth quando não há sessão local e preserva seu perfil direto", async () => {
    const user = { id: 51, openId: "oauth:51", role: "user", papel: "financeiro" };
    const empresa = { id: 1, nome: "FK Madeiras", ativa: true };
    localAuthMocks.lerSessaoLocal.mockReturnValue(undefined);
    sdkMocks.authenticateRequest.mockResolvedValue(user);
    dbMocks.getEmpresaUnica.mockResolvedValue(empresa);

    const ctx = await createContext(request());

    expect(ctx.user).toBe(user);
    expect(ctx.configuracaoEmpresa).toBe(empresa);
    expect(dbMocks.getEmpresaUnica).toHaveBeenCalledOnce();
  });
});
