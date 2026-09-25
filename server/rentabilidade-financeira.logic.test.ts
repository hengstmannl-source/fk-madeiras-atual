import { describe, expect, it } from "vitest";
import { calcularCusteioMateriaPrima, consolidarRentabilidadeFinanceira } from "./rentabilidade-financeira.logic";

const materiaPrimaVazia = () => calcularCusteioMateriaPrima({ producoes: [], torasConsumidas: [], referenciasPrecoPorEssencia: [] });

describe("calcularCusteioMateriaPrima", () => {
  const producao = { id: 1, numero: "PRD-1", dataProducao: new Date("2026-08-10T12:00:00.000Z"), volumePecas: 4, volumeAproveitamento: 1, incluirAproveitamento: true };

  it("prioriza tora e frete reais e usa a referência ponderada de tora mais frete de entrada da mesma essência", () => {
    const resultado = calcularCusteioMateriaPrima({
      producoes: [producao],
      referenciasPrecoPorEssencia: [
        { essencia: "Cambará", volumeBase: 1, valorMetroCubico: 100, fretePorMetroCubico: 10 },
        { essencia: "cambara", volumeBase: 3, valorMetroCubico: 200, fretePorMetroCubico: 30 },
      ],
      torasConsumidas: [
        { producaoId: 1, plaquetaId: 10, plaquetaCodigo: "A", essencia: "Cambará", volume: 2, romaneioCargaId: 4, valorMetroCubico: 150, fretePorMetroCubico: 20, numeroRomaneioCarga: "RC-4" },
        { producaoId: 1, plaquetaId: 11, plaquetaCodigo: "SEM", essencia: "CAMBARA", volume: 2, romaneioCargaId: null, valorMetroCubico: 0, fretePorMetroCubico: null, numeroRomaneioCarga: null },
      ],
    });

    expect(resultado.custoTorasRastreavel).toBe(300);
    expect(resultado.freteEntradaRastreavel).toBe(40);
    expect(resultado.custoTorasEstimado).toBe(350);
    expect(resultado.freteEntradaEstimado).toBe(50);
    expect(resultado.custoTotalComEstimativa).toBe(740);
    expect(resultado.coberturaRastreavelPercentual).toBe(50);
    expect(resultado.coberturaComEstimativaPercentual).toBe(100);
    expect(resultado.producoes[0]?.volumeElegivelM3).toBe(5);
    expect(resultado.producoes[0]?.custoPorM3).toBe(148);
    expect(resultado.producoes[0]?.toras[1]?.fretePorMetroCubico).toBe(25);
    expect(resultado.producoes[0]?.toras[1]?.freteEntrada).toBe(50);
    expect(resultado.producoes[0]?.toras[1]?.referenciaEssencia?.fretePorMetroCubicoMedio).toBe(25);
    expect(resultado.producoes[0]?.toras[1]?.situacao).toBe("estimado_por_essencia");
  });

  it("não estima custo quando não há referência da mesma essência e não reaproveita aproveitamento desmarcado", () => {
    const resultado = calcularCusteioMateriaPrima({
      producoes: [{ ...producao, incluirAproveitamento: false }],
      referenciasPrecoPorEssencia: [{ essencia: "Jatobá", volumeBase: 5, valorMetroCubico: 300, fretePorMetroCubico: 15 }],
      torasConsumidas: [{ producaoId: 1, plaquetaId: 12, plaquetaCodigo: "SEM-REF", essencia: "Garapeira", volume: 3, romaneioCargaId: null, valorMetroCubico: 0, fretePorMetroCubico: null, numeroRomaneioCarga: null }],
    });

    expect(resultado.custoTotalComEstimativa).toBe(0);
    expect(resultado.volumeSemReferenciaM3).toBe(3);
    expect(resultado.torasSemReferencia).toHaveLength(1);
    expect(resultado.producoes[0]?.volumeElegivelM3).toBe(4);
  });

  it("consolida custo, volume, cobertura e custo por m³ por essência sem ratear custos entre espécies", () => {
    const resultado = calcularCusteioMateriaPrima({
      producoes: [producao],
      referenciasPrecoPorEssencia: [{ essencia: "Jatobá", volumeBase: 2, valorMetroCubico: 200, fretePorMetroCubico: 20 }],
      volumesProduzidosPorEssencia: [
        { producaoId: 1, essencia: "Cambará", volumePecas: 3 },
        { producaoId: 1, essencia: "Jatobá", volumePecas: 1 },
      ],
      torasConsumidas: [
        { producaoId: 1, plaquetaId: 20, plaquetaCodigo: "CAM-1", essencia: "Cambará", volume: 2, romaneioCargaId: 2, valorMetroCubico: 100, fretePorMetroCubico: 10, numeroRomaneioCarga: "RC-2" },
        { producaoId: 1, plaquetaId: 21, plaquetaCodigo: "JAT-1", essencia: "Jatobá", volume: 1, romaneioCargaId: null, valorMetroCubico: null, fretePorMetroCubico: null, numeroRomaneioCarga: null },
      ],
    });

    const cambara = resultado.porEssencia.find((item) => item.essencia === "Cambará");
    const jatoba = resultado.porEssencia.find((item) => item.essencia === "Jatobá");
    expect(cambara).toMatchObject({ volumePecasM3: 3, volumeTorasConsumidasM3: 2, custoTotalReal: 220, custoPorM3: 220 / 3, coberturaRastreavelPercentual: 100 });
    expect(jatoba).toMatchObject({ volumePecasM3: 1, volumeTorasConsumidasM3: 1, custoTotalReal: 0, custoTotalComEstimativa: 220, custoPorM3: 220, coberturaRastreavelPercentual: 0, coberturaComEstimativaPercentual: 100 });
  });

  it("mantém o custo unitário por essência indisponível quando não há volume de produção válido", () => {
    const resultado = calcularCusteioMateriaPrima({
      producoes: [{ ...producao, volumePecas: 0 }],
      referenciasPrecoPorEssencia: [],
      volumesProduzidosPorEssencia: [{ producaoId: 1, essencia: "Cambará", volumePecas: 0 }],
      torasConsumidas: [{ producaoId: 1, plaquetaId: 30, plaquetaCodigo: "CAM-SEM-VOLUME", essencia: "Cambará", volume: 1, romaneioCargaId: 3, valorMetroCubico: 100, fretePorMetroCubico: 10, numeroRomaneioCarga: "RC-3" }],
    });

    expect(resultado.porEssencia).toContainEqual(expect.objectContaining({ essencia: "Cambará", volumePecasM3: 0, custoPorM3: null }));
  });
});

describe("consolidarRentabilidadeFinanceira", () => {
  it("separa centros, exclui o não apropriável e não soma título de romaneio como matéria-prima", () => {
    const resultado = consolidarRentabilidadeFinanceira({
      componentes: [
        { chave: "t:1", origem: "romaneio_carga", centroCustoId: 1, centroNome: "Serraria", centroTipo: "industrial", categoriaId: 10, categoriaNome: "Matéria-prima", descricao: "Título derivado", valor: "1200.50" },
        { chave: "d:2", origem: "abastecimento_diesel", centroCustoId: 1, centroNome: "Serraria", centroTipo: "industrial", categoriaId: null, categoriaNome: "Diesel operacional", descricao: "Abastecimento", valor: 300 },
        { chave: "t:3", origem: "manual", centroCustoId: 2, centroNome: "Administração", centroTipo: "comercial_administrativo", categoriaId: 11, categoriaNome: "Energia", descricao: "Energia", valor: 200 },
        { chave: "t:4", origem: "manual", centroCustoId: 3, centroNome: "Financeiro", centroTipo: "nao_apropriavel", categoriaId: 12, categoriaNome: "Empréstimos", descricao: "Banco", valor: 500 },
      ],
      volumeProprioM3: "10",
      materiaPrima: materiaPrimaVazia(),
      titulosSemCentro: { quantidade: 2, valor: "45.5" },
      titulosSemCompetencia: { quantidade: 1, valor: "20" },
      titulosExcluidosPorOrigem: { quantidade: 1, valor: "64.7" },
      titulosRomaneioCargaExcluidos: { quantidade: 1, valor: "1200.50" },
    });

    expect(resultado.indicadores).toMatchObject({ custosIndustriais: 300, custosComerciaisAdministrativos: 200, custosMateriaPrima: 0, custoTotalApropriado: 500, custosMateriaPrimaPorM3: 0, custosIndustriaisPorM3: 30, custosComerciaisAdministrativosPorM3: 20, custoIndustrialPorM3: 30, custoCompletoPorM3: 50, custoTotalPorM3: 50 });
    expect(resultado.porCentro).toHaveLength(2);
    expect(resultado.componentes).toHaveLength(2);
    expect(resultado.qualidadeDados.titulosSemCentro.valor).toBe(45.5);
  });

  it("não calcula custo unitário quando não há produção própria confirmada", () => {
    const resultado = consolidarRentabilidadeFinanceira({
      componentes: [], volumeProprioM3: 0, materiaPrima: materiaPrimaVazia(),
      titulosSemCentro: { quantidade: 0, valor: 0 },
      titulosSemCompetencia: { quantidade: 0, valor: 0 },
      titulosExcluidosPorOrigem: { quantidade: 0, valor: 0 },
      titulosRomaneioCargaExcluidos: { quantidade: 0, valor: 0 },
    });
    expect(resultado.indicadores.custoIndustrialPorM3).toBeNull();
    expect(resultado.indicadores.custosMateriaPrimaPorM3).toBeNull();
    expect(resultado.indicadores.custosIndustriaisPorM3).toBeNull();
    expect(resultado.indicadores.custosComerciaisAdministrativosPorM3).toBeNull();
    expect(resultado.indicadores.custoCompletoPorM3).toBeNull();
    expect(resultado.indicadores.custoTotalPorM3).toBeNull();
  });
});
