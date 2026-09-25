import { describe, expect, it } from "vitest";
import { importarFornecedoresCsv } from "./db";
import { criarModeloCsvFornecedores, prepararImportacaoFornecedores, validarCsvFornecedores } from "./fornecedores.intercambio";

const cabecalho = "nome;contacto;email;documento;endereco;observacoes";

describe("intercâmbio de fornecedores", () => {
  it("gera um modelo CSV e preserva campos delimitados por aspas", () => {
    const csv = `${cabecalho}\n"Madeireira; Norte";(11) 99999-0000;compras@norte.com;12.345.678/0001-99;"Rua A; 10";Fornecedor prioritário`;
    expect(criarModeloCsvFornecedores()).toContain(cabecalho);
    expect(validarCsvFornecedores(csv)).toEqual({
      linhas: [expect.objectContaining({ nome: "Madeireira; Norte", email: "compras@norte.com", endereco: "Rua A; 10" })],
      erros: [],
    });
  });

  it("rejeita cabeçalhos ausentes e dados obrigatórios ou e-mails inválidos", () => {
    expect(validarCsvFornecedores("nome;email\nFornecedor A;compras@a.com").erros[0]).toMatch(/cabeçalhos/i);
    const csv = `${cabecalho}\n;Contato;email-invalido;;;`;
    expect(validarCsvFornecedores(csv).erros[0]).toMatch(/nome obrigatório.*e-mail inválido/i);
  });

  it("recusa toda a planilha quando identifica duplicidades no cadastro ou no próprio arquivo", () => {
    const existente = `${cabecalho}\nFornecedor Existente;;contato@existente.com;11.111.111/0001-11;;`;
    const resultadoExistente = prepararImportacaoFornecedores({
      conteudo: existente,
      fornecedoresExistentes: [{ id: 1, nome: "Fornecedor Existente", email: "outro@email.com", documento: null }],
    });
    expect(resultadoExistente).toMatchObject({ linhas: [], erros: [expect.stringMatching(/já cadastrado/i)] });

    const duplicado = `${cabecalho}\nFornecedor Novo;;;22.222.222/0001-22;;\nFornecedor Novo;Outro;;; ;`;
    const resultadoDuplicado = prepararImportacaoFornecedores({ conteudo: duplicado, fornecedoresExistentes: [] });
    expect(resultadoDuplicado).toMatchObject({ linhas: [], erros: [expect.stringMatching(/duplicado/i)] });
  });

  it("não inicia transação para arquivo inválido e grava lote válido de uma vez", async () => {
    const lotes: unknown[] = [];
    let transacoes = 0;
    const database = {
      transaction: async (callback: (tx: any) => Promise<void>) => {
        transacoes += 1;
        await callback({ insert: () => ({ values: async (valores: unknown) => { lotes.push(valores); } }) });
      },
    };
    const invalido = `${cabecalho}\n;Contato;invalido;;;`;
    await expect(importarFornecedoresCsv(invalido, 9, { database, fornecedoresExistentes: [] })).resolves.toMatchObject({ importados: 0, erros: [expect.any(String)] });
    expect(transacoes).toBe(0);

    const valido = `${cabecalho}\nFornecedor Novo;(11) 99999-0000;novo@fornecedor.com;22.222.222/0001-22;Rua A;Observação`;
    await expect(importarFornecedoresCsv(valido, 9, { database, fornecedoresExistentes: [] })).resolves.toEqual({ importados: 1, erros: [] });
    expect(transacoes).toBe(1);
    expect(lotes).toEqual([expect.arrayContaining([expect.objectContaining({ nome: "Fornecedor Novo", criadoPor: 9, ativo: true })])]);
  });
});
