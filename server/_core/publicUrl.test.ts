import { describe, expect, it } from "vitest";
import { criarUrlPublica } from "./publicUrl";

describe("URLs públicas de convite", () => {
  it("gera links HTTPS usando a origem configurada", () => {
    expect(criarUrlPublica("https://fkmadeiras.com.br", "/convite/token-teste")).toBe(
      "https://fkmadeiras.com.br/convite/token-teste",
    );
  });

  it("permite HTTP somente para loopback local", () => {
    expect(criarUrlPublica("http://localhost:3000", "/convite/token-teste")).toBe(
      "http://localhost:3000/convite/token-teste",
    );
    expect(criarUrlPublica("http://127.0.0.1:3000", "/convite/token-teste")).toBe(
      "http://127.0.0.1:3000/convite/token-teste",
    );
  });

  it("rejeita HTTP em hosts públicos e origens inválidas", () => {
    expect(() => criarUrlPublica("http://fkmadeiras.com.br", "/convite/token-teste")).toThrow(
      "A origem pública precisa usar HTTPS",
    );
    expect(() => criarUrlPublica("valor-inválido", "/convite/token-teste")).toThrow(
      "A origem pública do sistema não está configurada corretamente",
    );
  });
});
