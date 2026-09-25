import { describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: { cookieSecret: "chave-de-teste-local-com-mais-de-trinta-e-dois-caracteres" },
}));

import { criarSessaoLocal, gerarHashSenha, lerSessaoLocal, normalizarEmail, validarSenha } from "./autenticacao-local";

describe("autenticação local", () => {
  it("normaliza o e-mail e valida somente a senha correspondente", async () => {
    expect(normalizarEmail("  Financeiro@FKMadeiras.COM.BR ")).toBe("financeiro@fkmadeiras.com.br");

    const hash = await gerarHashSenha("SenhaForte2026");
    expect(await validarSenha("SenhaForte2026", hash)).toBe(true);
    expect(await validarSenha("SenhaIncorreta2026", hash)).toBe(false);
    expect(await validarSenha("SenhaForte2026", "hash-inválido")).toBe(false);
  });

  it("aceita sessão assinada, mas rejeita token adulterado ou expirado", () => {
    const agora = Date.now();
    const token = criarSessaoLocal(42, agora);
    expect(lerSessaoLocal(token, agora)).toMatchObject({ usuarioId: 42 });
    expect(lerSessaoLocal(`${token}x`, agora)).toBeUndefined();
    expect(lerSessaoLocal(token, agora + 1000 * 60 * 60 * 13)).toBeUndefined();
  });
});
