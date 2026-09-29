import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
const mocks = vi.hoisted(() => ({ context: vi.fn(), getDb: vi.fn(), sign: vi.fn() }));
vi.mock("./context", () => ({ createContext: mocks.context }));
vi.mock("../repositories/core", () => ({ getDb: mocks.getDb }));
vi.mock("../storage", () => ({ storageGetSignedUrl: mocks.sign }));
import { registerStorageProxy } from "./storageProxy";

function request(key = "financeiro/legado.pdf") {
  let handler: any;
  registerStorageProxy({ get: (_: string, fn: any) => { handler = fn; } } as any);
  const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), send: vi.fn(), redirect: vi.fn() };
  return { res, run: () => handler({ params: { 0: key }, headers: {} }, res) };
}
describe("download privado", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.context.mockResolvedValue({ user: { id: 1, papel: "financeiro", role: "user" }, configuracaoEmpresa: { id: 7 } });
    mocks.sign.mockResolvedValue("https://storage.example/signed");
    mocks.getDb.mockReturnValue({ select: () => {
      const query: any = { from: () => query, innerJoin: (_: any, condition: any) => {
        const sql = new MySqlDialect().sqlToQuery(condition);
        expect(sql.sql).toContain("`titulosFinanceiros`.`empresaId`"); expect(sql.params).toContain(7);
        return query;
      }, where: (condition: any) => {
        const sql = new MySqlDialect().sqlToQuery(condition);
        expect(sql.sql).toContain("`empresaId`"); expect(sql.params).toContain(7);
        return { limit: async () => sql.params.includes("financeiro/legado.pdf") ? [{ id: 1 }] : [] };
      } }; return query;
    } });
  });
  it("nega sessão ausente antes de consultar storage", async () => {
    mocks.context.mockResolvedValue({ user: null }); const r = request(); await r.run();
    expect(r.res.status).toHaveBeenCalledWith(401); expect(mocks.getDb).not.toHaveBeenCalled(); expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("nega perfil de outro módulo", async () => {
    mocks.context.mockResolvedValue({ user: { id: 2, papel: "vendas", role: "user" }, configuracaoEmpresa: { id: 7 } });
    const r = request(); await r.run(); expect(r.res.status).toHaveBeenCalledWith(403); expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("nega chave inexistente ou de outra empresa", async () => {
    const r = request("financeiro/outra-empresa.pdf"); await r.run();
    expect(r.res.status).toHaveBeenCalledWith(404); expect(mocks.sign).not.toHaveBeenCalled();
  });
  it("preserva download autorizado com chave legada", async () => {
    const r = request(); await r.run(); expect(mocks.sign).toHaveBeenCalledWith("financeiro/legado.pdf");
    expect(r.res.redirect).toHaveBeenCalledWith(307, "https://storage.example/signed");
    expect(r.res.set).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });
  it("não expõe resposta interna em erros", async () => {
    mocks.sign.mockRejectedValue(new Error("secret/internal bucket")); const r = request(); await r.run();
    expect(r.res.status).toHaveBeenCalledWith(502); expect(JSON.stringify(r.res.send.mock.calls)).not.toContain("secret");
  });
});
