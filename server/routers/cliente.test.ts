import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", () => ({
  getEmpresaUnica: vi.fn(),
  createCliente: vi.fn(),
  listClientes: vi.fn(),
  listAllClientes: vi.fn(),
  getPerfilCliente: vi.fn(),
  updateCliente: vi.fn(),
  deleteCliente: vi.fn(),
}));

import * as db from "../db";
import { clienteRouter } from "./cliente";

const ctx = {
  user: {
    id: 7,
    openId: "teste-cliente",
    name: "Utilizador de Teste",
    email: "teste@exemplo.com",
    loginMethod: "manus",
    role: "user",
    papel: "proprietario",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  configuracaoEmpresa: { id: 1, nome: "FK Madeiras", ativa: true },
} as unknown as TrpcContext;

describe("cliente.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getEmpresaUnica).mockResolvedValue({ id: 1 } as any);
  });

  it("devolve o id do cliente recém-criado para seleção imediata no orçamento", async () => {
    vi.mocked(db.createCliente).mockResolvedValue({ id: 42 });
    const caller = clienteRouter.createCaller(ctx);

    const result = await caller.create({
      nome: "Madeireira Exemplo Ltda.",
      contacto: "+55 11 99999-9999",
      email: "contato@exemplo.com",
    });

    expect(db.createCliente).toHaveBeenCalledWith({
      nome: "Madeireira Exemplo Ltda.",
      contacto: "+55 11 99999-9999",
      email: "contato@exemplo.com",
      criadoPor: 7,
      empresaId: 1,
    });
    expect(result).toEqual({ success: true, id: 42 });
  });
});

describe("cliente.empresa única", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getEmpresaUnica).mockResolvedValue({ id: 1 } as any);
  });

  it("consulta dados na empresa global do sistema", async () => {
    vi.mocked(db.listClientes).mockResolvedValue([] as any);
    const caller = clienteRouter.createCaller(ctx);

    await caller.list();

    expect(db.listClientes).toHaveBeenCalledWith();
  });

  it("não encontra o perfil quando a busca global não retorna o cliente", async () => {
    vi.mocked(db.getPerfilCliente).mockResolvedValue(undefined as any);
    const caller = clienteRouter.createCaller(ctx);

    await expect(caller.perfil({ id: 91 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.getPerfilCliente).toHaveBeenCalledWith(91);
  });

  it("propaga a empresa global para alterações e exclusões", async () => {
    vi.mocked(db.updateCliente).mockResolvedValue(undefined as any);
    vi.mocked(db.deleteCliente).mockResolvedValue(undefined as any);
    const caller = clienteRouter.createCaller(ctx);

    await caller.update({ id: 91, nome: "Cliente Isolado" });
    await caller.delete({ id: 91 });

    expect(db.updateCliente).toHaveBeenCalledWith(91, expect.objectContaining({ nome: "Cliente Isolado" }));
    expect(db.deleteCliente).toHaveBeenCalledWith(91);
  });

  it("nega acesso quando o utilizador não possui perfil operacional", async () => {
    const caller = clienteRouter.createCaller({ ...ctx, user: { ...ctx.user, papel: null } } as unknown as TrpcContext);

    await expect(caller.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.listClientes).not.toHaveBeenCalled();
  });
});
