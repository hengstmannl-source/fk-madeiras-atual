import { describe, expect, it } from "vitest";
import {
  calcularVolumeItemVendaEstimado,
  calcularVolumeLiquidoVendido,
  consolidarMargemVendaRastreavel,
  consolidarReferenciasHistoricasPorEssencia,
  consolidarValoresToraRomaneioPorEssencia,
  distribuirVolumeVendaHistoricaSemSaida,
} from "./rentabilidade-vendas.logic";

const loteBase = {
  loteId: 4,
  itemVendaId: 8,
  essencia: "Cambará",
  tipo: "peca" as const,
  quantidadeLiquida: 100,
  volumeVendidoM3: 10,
  custoMateriaPrimaPorM3: 900,
  custoIndustrialPorM3: 600,
  custoComercialAdministrativoPorM3: 100,
  coberturaMateriaPrimaPercentual: 100,
  coberturaMateriaPrimaComEstimativaPercentual: 100,
  origemCustoMateriaPrima: "rastreavel" as const,
  referenciaEstimada: null,
  motivoIndisponibilidade: null,
};

describe("consolidarMargemVendaRastreavel", () => {
  it("compara o preço líquido por m³ com madeira, produção e custo comercial, sem somar frete ou comissão ao custo", () => {
    const resultado = consolidarMargemVendaRastreavel({
      receitaBrutaMadeira: 26_000,
      descontoComercial: 0,
      freteComercial: 4_000,
      comissao: 2_000,
      volumeNegociadoM3: 10,
      lotes: [loteBase],
    });

    expect(resultado).toMatchObject({
      receitaLiquidaMadeira: 20_000,
      precoLiquidoPorM3: 2_000,
      custoMateriaPrima: 9_000,
      custoIndustrial: 6_000,
      custoComercialAdministrativo: 1_000,
      custoTotal: 16_000,
      custoTotalPorM3: 1_600,
      margem: 4_000,
      margemPorM3: 400,
      situacaoCobertura: "completa",
    });
  });

  it("mantém a margem total indisponível quando uma saída não possui volume utilizável", () => {
    const resultado = consolidarMargemVendaRastreavel({
      receitaBrutaMadeira: 2_600,
      descontoComercial: 0,
      freteComercial: 0,
      comissao: 0,
      volumeNegociadoM3: 2,
      lotes: [
        { ...loteBase, loteId: 1, itemVendaId: 1, volumeVendidoM3: 1 },
        { ...loteBase, loteId: 2, itemVendaId: 1, quantidadeLiquida: 1, volumeVendidoM3: null, custoMateriaPrimaPorM3: null, custoIndustrialPorM3: null, custoComercialAdministrativoPorM3: null, coberturaMateriaPrimaPercentual: 0, coberturaMateriaPrimaComEstimativaPercentual: 0, origemCustoMateriaPrima: "indisponivel", motivoIndisponibilidade: "Lote negativo sem produção de origem." },
      ],
    });

    expect(resultado.situacaoCobertura).toBe("parcial");
    expect(resultado.custoTotal).toBeNull();
    expect(resultado.margem).toBeNull();
    expect(resultado.margemConhecida).toBe(1_000);
    expect(resultado.problemas).toContain("Lote negativo sem produção de origem.");
  });

  it("considera a estimativa histórica por essência como cobertura comparável, mas separa-a do custo rastreável", () => {
    const referencias = consolidarReferenciasHistoricasPorEssencia([
      { competencia: "2026-7", essencia: "Cambará", volumeProduzidoM3: 10, custoMateriaPrima: 9_000, custoIndustrialPorM3: 600, custoComercialAdministrativoPorM3: 100 },
      { competencia: "2026-8", essencia: "cambara", volumeProduzidoM3: 20, custoMateriaPrima: 21_000, custoIndustrialPorM3: 900, custoComercialAdministrativoPorM3: 150 },
    ]);
    const referencia = referencias.get("CAMBARA");
    expect(referencia).toMatchObject({ custoMateriaPrimaPorM3: 1_000, custoIndustrialPorM3: 800, custoComercialAdministrativoPorM3: 133.33333333333334, volumeBaseM3: 30, competenciasComDados: 2 });

    const resultado = consolidarMargemVendaRastreavel({
      receitaBrutaMadeira: 5_000,
      descontoComercial: 0,
      freteComercial: 0,
      comissao: 0,
      volumeNegociadoM3: 2,
      lotes: [{
        ...loteBase,
        loteId: 900001,
        volumeVendidoM3: 2,
        custoMateriaPrimaPorM3: referencia!.custoMateriaPrimaPorM3,
        custoIndustrialPorM3: referencia!.custoIndustrialPorM3,
        custoComercialAdministrativoPorM3: referencia!.custoComercialAdministrativoPorM3,
        coberturaMateriaPrimaPercentual: 0,
        coberturaMateriaPrimaComEstimativaPercentual: 100,
        origemCustoMateriaPrima: "estimado_por_essencia",
        referenciaEstimada: referencia!,
      }],
    });

    expect(resultado).toMatchObject({
      situacaoCobertura: "completa",
      custoMateriaPrima: 2_000,
      custoIndustrial: 1_600,
      custoComercialAdministrativo: 266.67,
      custoTotal: 3_866.67,
      margem: 1_133.33,
      coberturaMateriaPrimaPercentual: 0,
      coberturaMateriaPrimaComEstimativaPercentual: 100,
      volumeEstimadoM3: 2,
      temEstimativa: true,
    });
  });

  it("calcula a média ponderada de tora e frete de entrada pelo volume da mesma essência, sem confundir com frete comercial", () => {
    const referencias = consolidarValoresToraRomaneioPorEssencia([
      { essencia: "Cedrinho", volumeBaseM3: 2, valorMetroCubico: 900, fretePorMetroCubico: 100 },
      { essencia: "CEDRINHO", volumeBaseM3: 6, valorMetroCubico: 1_100, fretePorMetroCubico: 50 },
      { essencia: "Cedrinho", volumeBaseM3: 4, valorMetroCubico: null, fretePorMetroCubico: 200 },
      { essencia: "Cambará", volumeBaseM3: 3, valorMetroCubico: 1_500 },
    ]);

    expect(referencias.get("CEDRINHO")).toMatchObject({
      essencia: "Cedrinho",
      volumeBaseM3: 8,
      valorMetroCubicoMedio: 1_050,
      freteEntradaPorM3Medio: 62.5,
      custoMateriaPrimaPorM3Medio: 1_112.5,
      quantidadeToras: 2,
    });
    expect(referencias.get("CAMBARA")?.valorMetroCubicoMedio).toBe(1_500);
  });

  it("reconstitui o volume de peça pela quantidade líquida após estorno e preserva o volume histórico autorizado para referência identificada", () => {
    expect(calcularVolumeLiquidoVendido({ tipo: "peca", quantidadeLiquida: 8, volumeLiquidoMovimentado: 0, volumeLote: 2.5, quantidadeProduzida: 10 })).toBe(2);
    expect(calcularVolumeLiquidoVendido({ tipo: "aproveitamento", quantidadeLiquida: 0, volumeLiquidoMovimentado: 0.35, volumeLote: 0.35, quantidadeProduzida: 0 })).toBe(0.35);
    expect(calcularVolumeLiquidoVendido({ tipo: "peca", quantidadeLiquida: 1, volumeLiquidoMovimentado: 0, volumeLote: 2.5, quantidadeProduzida: 0 })).toBeNull();
    expect(calcularVolumeLiquidoVendido({ tipo: "peca", quantidadeLiquida: 1, volumeLiquidoMovimentado: 0, volumeLote: 0.25, quantidadeProduzida: 0, permitirVolumeLoteSemProducao: true })).toBe(0.25);
  });

  it("calcula o volume comercial de item sem saída física apenas quando suas dimensões são válidas", () => {
    expect(calcularVolumeItemVendaEstimado({ espessura: 3, largura: 5, comprimento: 4, quantidade: 10 })).toBe(0.06);
    expect(calcularVolumeItemVendaEstimado({ espessura: 3, largura: 0, comprimento: 4, quantidade: 10 })).toBeNull();
  });

  it("prioriza o volume total já registrado na venda histórica e usa as dimensões apenas como distribuição relativa", () => {
    const distribuicao = distribuirVolumeVendaHistoricaSemSaida({
      volumeTotalVendaM3: 0.2352,
      itens: [
        { id: 1, espessura: 23, largura: 50, comprimento: 3, quantidade: 32 },
        { id: 2, espessura: 23, largura: 50, comprimento: 3.5, quantidade: 15 },
        { id: 3, espessura: 23, largura: 50, comprimento: 4, quantidade: 14 },
      ],
    });
    const total = Array.from(distribuicao.values()).reduce((soma, valor) => soma + (valor ?? 0), 0);
    expect(total).toBeCloseTo(0.2352, 8);
    expect(distribuicao.get(1)).toBeCloseTo((0.2352 * 11.04) / 23.5175, 8);
  });
});
