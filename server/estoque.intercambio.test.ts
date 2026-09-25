import { describe, expect, it } from "vitest";
import { criarModeloCsvPlaquetasCarga, prepararImportacaoPlaquetasCarga, validarCsvPlaquetasCarga } from "./estoque.intercambio";

describe("intercâmbio de toras por CSV", () => {
  it("fornece um modelo CSV compatível com planilhas", () => {
    expect(criarModeloCsvPlaquetasCarga()).toContain("codigo;essencia;diametro_cm;comprimento_m;preco_m3;observacoes");
  });

  it("valida uma tora e normaliza vírgulas e códigos", () => {
    const resultado = validarCsvPlaquetasCarga("codigo;essencia;diametro_cm;comprimento_m;preco_m3;observacoes\n plq 001 ;Cumaru;48,5;7,500;900,00;Conferida");
    expect(resultado.erros).toEqual([]);
    expect(resultado.linhas).toEqual([expect.objectContaining({ codigo: "PLQ-001", diametro: "48.5", comprimento: "7.5", valorMetroCubico: "900" })]);
  });

  it("recusa arquivo inteiro quando existem medidas inválidas, mas permite plaquetas repetidas", () => {
    const resultado = validarCsvPlaquetasCarga("codigo;essencia;diametro_cm;comprimento_m;preco_m3\nPLQ-1;Cumaru;0;7;900\nPLQ-1;Cumaru;48;7;900");
    expect(resultado.linhas).toHaveLength(1);
    expect(resultado.erros.join(" ")).toContain("diâmetro");
  });

  it("aceita plaquetas ausentes e repetidas, emitindo avisos para rastreabilidade", () => {
    const resultado = prepararImportacaoPlaquetasCarga({ conteudo: "codigo;essencia;diametro_cm;comprimento_m;preco_m3\n;Cumaru;48;7;900\nplq 001;Cumaru;48;7;900\nplq 001;Cumaru;50;7;900", codigosExistentes: [{ codigo: "PLQ-001" }] });
    expect(resultado.erros).toEqual([]);
    expect(resultado.linhas).toHaveLength(3);
    expect(resultado.avisos.join(" ")).toContain("sem plaqueta física");
    expect(resultado.avisos.join(" ")).toContain("duplicada");
  });
});
