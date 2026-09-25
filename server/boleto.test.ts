import { describe, expect, it } from "vitest";
import { extrairDadosBoletoDeTexto, normalizarDadosBoleto, somenteDigitosBoleto } from "../shared/boleto";

describe("dados de boleto", () => {
  it("remove a formatação da linha digitável", () => {
    expect(somenteDigitosBoleto("00190.00009 01234.567891 12345.678901 1 12340000010000"))
      .toBe("00190000090123456789112345678901112340000010000");
  });

  it("classifica códigos de barras e linhas digitáveis pelos tamanhos aceitos", () => {
    expect(normalizarDadosBoleto("12345678901234567890123456789012345678901234"))
      .toEqual({ codigoBarras: "12345678901234567890123456789012345678901234", linhaDigitavel: null });
    expect(normalizarDadosBoleto("12345678901234567890123456789012345678901234567"))
      .toEqual({ codigoBarras: null, linhaDigitavel: "12345678901234567890123456789012345678901234567" });
    expect(normalizarDadosBoleto("123"))
      .toBeNull();
  });

  it("extrai uma linha digitável formatada de um texto de boleto", () => {
    const texto = "Pague até o vencimento. Linha digitável: 00190.00009 01234.567891 12345.678901 1 12340000010000";
    expect(extrairDadosBoletoDeTexto(texto))
      .toEqual({ codigoBarras: null, linhaDigitavel: "00190000090123456789112345678901112340000010000" });
  });
});
