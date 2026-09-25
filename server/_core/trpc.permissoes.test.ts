import { describe, expect, it } from "vitest";
import { mensagemDeBloqueioPorPerfil } from "./trpc";

describe("permissões empresariais por módulo", () => {
  it("libera cada perfil operacional no seu módulo", () => {
    expect(mensagemDeBloqueioPorPerfil({ papel: "financeiro", papelPlataforma: "user", caminho: "financeiro.titulos.list", tipo: "query" })).toBeNull();
    expect(mensagemDeBloqueioPorPerfil({ papel: "vendas", papelPlataforma: "user", caminho: "orcamento.create", tipo: "mutation" })).toBeNull();
    expect(mensagemDeBloqueioPorPerfil({ papel: "producao", papelPlataforma: "user", caminho: "producao.romaneios.confirmar", tipo: "mutation" })).toBeNull();
  });

  it("bloqueia o acesso cruzado entre módulos", () => {
    expect(mensagemDeBloqueioPorPerfil({ papel: "vendas", papelPlataforma: "user", caminho: "financeiro.titulos.list", tipo: "query" })).toBe("O seu perfil não tem acesso a este módulo.");
    expect(mensagemDeBloqueioPorPerfil({ papel: "financeiro", papelPlataforma: "user", caminho: "producao.romaneios.list", tipo: "query" })).toBe("O seu perfil não tem acesso a este módulo.");
  });

  it("mantém o perfil de consulta somente em leitura", () => {
    expect(mensagemDeBloqueioPorPerfil({ papel: "consulta", papelPlataforma: "user", caminho: "financeiro.titulos.list", tipo: "query" })).toBeNull();
    expect(mensagemDeBloqueioPorPerfil({ papel: "consulta", papelPlataforma: "user", caminho: "financeiro.titulos.create", tipo: "mutation" })).toBe("O perfil de consulta não pode alterar dados.");
  });
});
