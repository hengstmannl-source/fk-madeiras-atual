import { describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql-proxy";
const mocks = vi.hoisted(() => ({ db: null as any, queries: [] as Array<{ sql: string; params: unknown[] }> }));
vi.mock("./repositories/core", () => ({ getDb: async () => mocks.db }));
import { registrarFalhaAutenticacao } from "./repositories/identidade";
describe("bloqueio de conta", () => {
  it("incrementa atomicamente e reinicia após 15 minutos sem falhas, sem gravar bloqueio", async () => {
    mocks.db = drizzle(async (sql, params) => { mocks.queries.push({ sql, params }); return { rows: [{ insertId: 0, affectedRows: 1 }] }; });
    await registrarFalhaAutenticacao(8);
    const { sql, params } = mocks.queries[0];
    expect(sql).toMatch(/CASE\s+WHEN `credenciaisUsuarios`\.`updatedAt` <= DATE_SUB\(NOW\(\), INTERVAL 15 MINUTE\) THEN 1/);
    expect(sql).toContain("ELSE `credenciaisUsuarios`.`tentativasFalhas` + 1 END");
    expect(sql).toContain("`bloqueadoAte` = NULL");
    expect(sql).toContain("`updatedAt` = NOW()");
    expect(sql).toContain("where `credenciaisUsuarios`.`id` = ?");
    expect(params).toEqual([8]);
  });
});
