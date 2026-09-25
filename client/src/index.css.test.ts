import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const estilos = readFileSync(new URL("./index.css", import.meta.url), "utf8");

describe("responsividade da Produção", () => {
  it("mantém as grades de campos e indicadores dos diálogos legíveis abaixo de 640px", () => {
    expect(estilos).toContain("@media (max-width: 639px)");
    expect(estilos).toContain("grid-template-columns: repeat(2, minmax(0, 1fr)) !important");
    expect(estilos).toContain("lg\\:grid-cols-4");
    expect(estilos).toContain("lg\\:grid-cols-5");
  });

  it("empilha os campos em aparelhos de até 419px", () => {
    expect(estilos).toContain("@media (max-width: 419px)");
    expect(estilos).toContain("grid-template-columns: minmax(0, 1fr) !important");
  });

  it("amplia os diálogos operacionais e usa a largura real do conteúdo como ponto de quebra", () => {
    expect(estilos).toContain("width: min(96vw, 88rem) !important");
    expect(estilos).toContain("container-type: inline-size");
    expect(estilos).toContain("@container (max-width: 56rem)");
    expect(estilos).toContain("[role=\"dialog\"]:has(.grid.gap-3.sm\\:grid-cols-2.lg\\:grid-cols-5)");
  });
});
