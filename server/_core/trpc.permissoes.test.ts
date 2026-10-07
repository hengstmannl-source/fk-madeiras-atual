import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./context";
import { adminProcedure, mensagemDeBloqueioPorPerfil, protectedProcedure, router } from "./trpc";

const callerRouter = router({
  financeiro: router({ read: protectedProcedure.query(({ ctx }) => ctx.user.papel) }),
  rh: router({ read: protectedProcedure.query(({ ctx }) => ctx.user.papel) }),
  orcamento: router({ read: protectedProcedure.query(({ ctx }) => ctx.user.papel) }),
  producao: router({ read: protectedProcedure.query(({ ctx }) => ctx.user.papel) }),
  outro: router({ read: protectedProcedure.query(({ ctx }) => ctx.user.papel), write: protectedProcedure.mutation(({ ctx }) => ctx.user.papel) }),
  administracao: adminProcedure.query(({ ctx }) => ctx.user.papel),
});

function contexto(papel: string | null, role = "user") {
  return {
    user: papel === null ? null : { id: 1, role, papel },
    configuracaoEmpresa: { id: 1 },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  } as unknown as TrpcContext;
}

describe("autorização fail-closed por perfil operacional", () => {
  it.each([
    ["proprietario", "financeiro"],
    ["administrador", "financeiro"],
    ["financeiro", "financeiro"],
    ["rh", "rh"],
    ["vendas", "orcamento"],
    ["producao", "producao"],
  ])("permite %s no módulo esperado", async (papel, modulo) => {
    const caller = callerRouter.createCaller(contexto(papel));
    const result = await caller[modulo as "financeiro" | "rh" | "orcamento" | "producao"].read();
    expect(result).toBe(papel);
  });

  it("rejeita consulta em query e mutation", async () => {
    const caller = callerRouter.createCaller(contexto("consulta"));
    await expect(caller.financeiro.read()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.outro.write()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each([
    ["perfil_inexistente", "user", "financeiro"],
    ["perfil_inexistente", "user", "outro"],
    ["perfil_inexistente", "admin", "financeiro"],
    ["perfil_inexistente", "admin", "outro"],
    ["consulta", "admin", "outro"],
  ])("rejeita papel %s com role %s em %s", async (papel, role, rota) => {
    const caller = callerRouter.createCaller(contexto(papel, role));
    const result = rota === "financeiro" ? caller.financeiro.read() : caller.outro.read();
    await expect(result).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejeita usuário sem papel operacional", async () => {
    await expect(callerRouter.createCaller(contexto(null)).outro.read()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const semPapel = callerRouter.createCaller({ ...contexto("proprietario"), user: { id: 1, role: "user", papel: null } } as unknown as TrpcContext);
    await expect(semPapel.outro.read()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("preserva o bypass de módulo para role admin com papel válido", async () => {
    const caller = callerRouter.createCaller(contexto("financeiro", "admin"));
    await expect(caller.producao.read()).resolves.toBe("financeiro");
  });

  it.each(["proprietario", "administrador"])("mantém %s em adminProcedure", async (papel) => {
    await expect(callerRouter.createCaller(contexto(papel)).administracao()).resolves.toBe(papel);
  });

  it.each(["financeiro", "rh", "vendas", "producao", "consulta", "perfil_inexistente"])("nega %s em adminProcedure", async (papel) => {
    await expect(callerRouter.createCaller(contexto(papel)).administracao()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("não permite que role admin torne papel operacional inválido em adminProcedure", async () => {
    await expect(callerRouter.createCaller(contexto("perfil_inexistente", "admin")).administracao()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("helper central rejeita valores inválidos antes de qualquer bypass", () => {
    expect(mensagemDeBloqueioPorPerfil({ papel: "consulta", papelPlataforma: "admin", caminho: "empresa.get", tipo: "query" })).not.toBeNull();
    expect(mensagemDeBloqueioPorPerfil({ papel: "perfil_inexistente", papelPlataforma: "admin", caminho: "financeiro.titulos.list", tipo: "query" })).not.toBeNull();
    expect(mensagemDeBloqueioPorPerfil({ papel: "financeiro", papelPlataforma: "user", caminho: "financeiro.titulos.list", tipo: "query" })).toBeNull();
    expect(mensagemDeBloqueioPorPerfil({ papel: "vendas", papelPlataforma: "user", caminho: "producao.romaneios.list", tipo: "query" })).not.toBeNull();
  });
});
