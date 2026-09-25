import { describe, expect, it } from "vitest";
import { calcularIndicadoresMargemVenda, calcularReceitaLiquidaMadeiraVenda } from "./margemVendas.logic";

describe("calcularReceitaLiquidaMadeiraVenda", () => {
  it("compara o preço líquido da madeira após frete e comissão com base no volume vendido", () => {
    const resultado = calcularReceitaLiquidaMadeiraVenda({
      subtotal: "26000",
      desconto: "0",
      abatimentoFrete: "4000",
      comissaoCalculada: "2000",
      totalVolumeM3: "10",
      taxas: [{ calculado: "1300" }],
    });

    expect(resultado.receitaBrutaMadeira).toBe(26000);
    expect(resultado.deducoesDaReceitaMadeira).toBe(6000);
    expect(resultado.receitaLiquidaMadeira).toBe(20000);
    expect(resultado.precoLiquidoMadeiraPorM3).toBe(2000);
    expect(resultado.taxasCobradasAoCliente).toBe(1300);
  });

  it("mantém o preço líquido indisponível sem volume vendido", () => {
    const resultado = calcularReceitaLiquidaMadeiraVenda({
      subtotal: "2600", desconto: "0", abatimentoFrete: "300", comissaoCalculada: "100", totalVolumeM3: "0",
    });

    expect(resultado.receitaLiquidaMadeira).toBe(2200);
    expect(resultado.precoLiquidoMadeiraPorM3).toBeNull();
  });
});

describe("calcularIndicadoresMargemVenda", () => {
  it("consolida todas as taxas e calcula a margem comercial sobre o subtotal", () => {
    const resultado = calcularIndicadoresMargemVenda({
      subtotal: "54000",
      desconto: "0",
      abatimentoFrete: "9680",
      comissaoCalculada: "886.4",
      taxas: [{ calculado: "1200" }, { calculado: "532.8" }],
      total: "45166.4",
    });

    expect(resultado.totalTaxas).toBeCloseTo(1732.8, 2);
    expect(resultado.deducoesComerciais).toBeCloseTo(10566.4, 2);
    expect(resultado.acrescimosComerciais).toBeCloseTo(1732.8, 2);
    expect(resultado.valorLiquido).toBeCloseTo(45166.4, 2);
    expect(resultado.margemPercentual).toBeCloseTo(83.6415, 3);
  });

  it("evita divisão inválida quando a venda não possui subtotal", () => {
    expect(calcularIndicadoresMargemVenda({
      subtotal: "0", desconto: "0", abatimentoFrete: "0", comissaoCalculada: "0", taxas: [], total: "0",
    }).margemPercentual).toBe(0);
  });
});
