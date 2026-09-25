import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const diretorioServer = path.resolve(process.cwd(), "server");
const arquivoAutorizado = path.join(diretorioServer, "repositories", "financeiro.ts");
const padraoInsertTitulo = /(?:\.insert\(titulosFinanceiros\)|insertInto\(titulosFinanceiros\))/;

function listarArquivosTypeScript(diretorio: string): string[] {
  return fs.readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(diretorio, entrada.name);
    if (entrada.isDirectory()) return listarArquivosTypeScript(caminho);
    return entrada.isFile() && caminho.endsWith(".ts") && !caminho.endsWith(".test.ts") ? [caminho] : [];
  });
}

describe("fronteira de persistência de títulos financeiros", () => {
  it("permite insert direto em titulosFinanceiros somente no motor financeiro", () => {
    const violacoes = listarArquivosTypeScript(diretorioServer)
      .filter((arquivo) => arquivo !== arquivoAutorizado)
      .flatMap((arquivo) => {
        const linhas = fs.readFileSync(arquivo, "utf8").split("\n");
        return linhas
          .map((linha, indice) => ({ linha, indice: indice + 1 }))
          .filter(({ linha }) => padraoInsertTitulo.test(linha))
          .map(({ indice }) => `${path.relative(process.cwd(), arquivo)}:${indice}`);
      });

    expect(violacoes).toEqual([]);
  });
});
