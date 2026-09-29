import { describe, expect, it } from "vitest";
import { criarBackoffCredencial, JANELA_FALHAS_CREDENCIAL_MS, MAX_ATRASO_FALHA_CREDENCIAL_MS } from "./loginCredentialBackoff";

describe("backoff progressivo por credencial", () => {
  it("agrega falhas da mesma conta independentemente da origem e não bloqueia o login correto", () => {
    const backoff = criarBackoffCredencial();
    expect(backoff.registrarFalha(" Admin@Example.com ", 0)).toBe(100);
    expect(backoff.registrarFalha("admin@example.com", 1)).toBe(200);
    expect(backoff.registrarFalha("admin@example.com", 2)).toBe(400);
    expect(backoff.registrarFalha("admin@example.com", 3)).toBe(800);
    expect(backoff.registrarFalha("admin@example.com", 4)).toBe(1600);
    expect(backoff.registrarFalha("admin@example.com", 5)).toBe(MAX_ATRASO_FALHA_CREDENCIAL_MS);
    backoff.limpar("ADMIN@example.com");
    expect(backoff.registrarFalha("admin@example.com", 6)).toBe(100);
  });

  it("expira as falhas após a janela de inatividade", () => {
    const backoff = criarBackoffCredencial();
    backoff.registrarFalha("a@example.com", 0);
    backoff.registrarFalha("a@example.com", 1);
    expect(backoff.registrarFalha("a@example.com", JANELA_FALHAS_CREDENCIAL_MS + 1)).toBe(100);
  });

  it("mantém incrementos concorrentes consistentes e limita memória", async () => {
    const backoff = criarBackoffCredencial(2);
    const delays = await Promise.all(Array.from({ length: 12 }, (_, index) => Promise.resolve().then(() => backoff.registrarFalha("a@example.com", index))));
    expect(delays).toEqual([100, 200, 400, 800, 1600, 2000, 2000, 2000, 2000, 2000, 2000, 2000]);
    expect(backoff.registrarFalha("b@example.com", 20)).toBe(100);
    expect(backoff.registrarFalha("c@example.com", 21)).toBe(MAX_ATRASO_FALHA_CREDENCIAL_MS);
  });
});
