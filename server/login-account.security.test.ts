import { describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql-proxy";
const mocks = vi.hoisted(() => ({ db: null as any, queries: [] as Array<{ sql: string; params: unknown[] }> }));
vi.mock("./repositories/core", () => ({ getDb: async () => mocks.db }));
import { registrarFalhaAutenticacao } from "./repositories/identidade";
describe("bloqueio de conta", () => {
  it("calcula o limiar atomicamente no banco antes de incrementar o contador", async () => {
    mocks.db = drizzle(async (sql, params) => { mocks.queries.push({ sql, params }); return { rows: [{ insertId: 0, affectedRows: 1 }] }; });
    await registrarFalhaAutenticacao(8, null);
    const { sql, params } = mocks.queries[0];
    expect(sql).toContain("CASE WHEN `credenciaisUsuarios`.`tentativasFalhas` + 1 >= 5");
    expect(sql).toContain("DATE_ADD(NOW(), INTERVAL 15 MINUTE)");
    expect(sql.indexOf("`bloqueadoAte` =")).toBeLessThan(sql.indexOf("`tentativasFalhas` ="));
    expect(sql).toContain("where `credenciaisUsuarios`.`id` = ?");
    expect(params).toEqual([null, 8]);
  });
});
