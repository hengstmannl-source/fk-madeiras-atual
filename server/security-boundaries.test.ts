import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { z } from "zod";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), writes: vi.fn(), company: { id: 7 } }));
vi.mock("./repositories/core", () => ({ getDb: mocks.getDb }));
vi.mock("./repositories/identidade", () => ({ getEmpresaUnica: async () => mocks.company }));
import { validarReferenciasEmpresa } from "./repositories/referencias";
import { protectedProcedure, router } from "./_core/trpc";
import { updateRecorrenciaFinanceira, listRecorrenciasFinanceiras } from "./repositories/financeiro";
import { publicUser } from "./_core/publicUser";
import { dataCalendarioValida } from "../shared/validacaoData";

describe("limites de autorização e persistência", () => {
  const conditions: Array<{ sql: string; params: unknown[] }> = [];
  beforeEach(() => {
    vi.clearAllMocks(); conditions.length = 0;
    mocks.getDb.mockResolvedValue({
      select: () => ({ from: () => ({ where: (condition: any) => {
        const query = new MySqlDialect().sqlToQuery(condition); conditions.push(query);
        const rows = query.params.includes(99) ? [] : [{ id: 10 }];
        return Object.assign(Promise.resolve(rows), { orderBy: async () => rows });
      } }) }),
      update: () => ({ set: (value: any) => ({ where: async (condition: any) => {
        const query = new MySqlDialect().sqlToQuery(condition); conditions.push(query);
        // Simulated row belongs to company 99; the company-7 update must not reach it.
        if (query.params.includes(99)) mocks.writes(value);
        expect(value).not.toHaveProperty("empresaId"); expect(value).not.toHaveProperty("criadoPor"); expect(value).not.toHaveProperty("id");
      } }) }),
    });
  });
  it("recorrência usa id + empresa e ignora campos privilegiados", async () => {
    await updateRecorrenciaFinanceira(123, { descricao: "Permitida", empresaId: 99, criadoPor: 99, id: 99 } as any);
    expect(conditions[0].sql).toContain("`recorrenciasFinanceiras`.`empresaId`");
    expect(conditions[0].params).toEqual([123, 7]); expect(mocks.writes).not.toHaveBeenCalled();
    await listRecorrenciasFinanceiras(); expect(conditions[1].params).toEqual([7]);
  });
  it("rejeita vínculo externo mesmo com empresaId falsificado", async () => {
    await expect(validarReferenciasEmpresa({ empresaId: 99, clienteId: 99 }, 7, "orcamento.create")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(conditions[0].params).toEqual([7, 99]);
    await expect(validarReferenciasEmpresa({ clienteId: 10 }, 7, "orcamento.create")).resolves.toBeUndefined();
  });
  it("middleware protege mutações e mantém Zod contra mass assignment", async () => {
    const save = vi.fn();
    const api = router({ financeiro: router({ salvar: protectedProcedure.input(z.object({ descricao: z.string() })).mutation(({ input }) => { save(input); return input; }) }) });
    const ctx = { user: { id: 1, papel: "financeiro", role: "user" }, configuracaoEmpresa: { id: 7 } } as any;
    await api.createCaller(ctx).financeiro.salvar({ descricao: "A", empresaId: 99, papel: "administrador" } as any);
    expect(save).toHaveBeenCalledWith({ descricao: "A" });
    await expect(api.createCaller({ ...ctx, user: null }).financeiro.salvar({ descricao: "A" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.createCaller({ ...ctx, user: { ...ctx.user, papel: "vendas" } }).financeiro.salvar({ descricao: "A" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("projeção de usuário não transmite identificadores de autenticação", () => {
    const user = publicUser({ id: 1, name: "A", email: "a@example.com", role: "user", papel: "rh", openId: "internal", senhaHash: "secret" } as any);
    expect(user).toEqual({ id: 1, name: "A", email: "a@example.com", role: "user", papel: "rh" });
  });
  it("valida o calendário sem normalizar datas inexistentes", () => {
    expect(dataCalendarioValida("2024-02-29")).toBe(true);
    expect(dataCalendarioValida("2026-02-29")).toBe(false);
    expect(dataCalendarioValida("2026-13-01")).toBe(false);
  });
});
