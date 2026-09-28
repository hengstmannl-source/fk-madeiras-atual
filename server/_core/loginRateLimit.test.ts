import { describe, expect, it, vi } from "vitest";
import { chaveIp, criarLimitadorLogin } from "./loginRateLimit";
describe("limite de autenticação", () => {
  it("permite tentativas legítimas, retorna 429, isola IP e expira", () => {
    let now = 0; const limit = criarLimitadorLogin(() => now);
    const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();
    const req = { path: "/auth.entrar", ip: "192.0.2.1", socket: {}, headers: {} } as any;
    for (let i = 0; i < 120; i++) limit(req, res, next);
    expect(next).toHaveBeenCalledTimes(120);
    req.headers["x-forwarded-for"] = "198.51.100.20";
    limit(req, res, next); expect(res.status).toHaveBeenCalledWith(429); expect(next).toHaveBeenCalledTimes(120);
    limit({ ...req, ip: "192.0.2.2" }, res, next); expect(next).toHaveBeenCalledTimes(121);
    now = 900_001; limit(req, res, next); expect(next).toHaveBeenCalledTimes(122);
  });
  it("contabiliza login em batch e com path codificado", () => {
    const limit = criarLimitadorLogin(); const next = vi.fn();
    const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    limit({ path: "/" + Array(121).fill("auth%2eentrar").join(","), ip: "192.0.2.1", socket: {} } as any, res, next);
    expect(res.status).toHaveBeenCalledWith(429); expect(next).not.toHaveBeenCalled();
  });
  it("agrupa IPv6 /64 e IPv4 mapeado", () => {
    expect(chaveIp("2001:db8:abcd:1234::1")).toBe(chaveIp("2001:db8:abcd:1234::ffff"));
    expect(chaveIp("::ffff:192.0.2.1")).toBe("192.0.2.1");
  });
});
