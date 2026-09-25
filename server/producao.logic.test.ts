import { describe, expect, it } from "vitest";
import { alocarPecasParaEntrega, alocarPecasPermitindoNegativo, agruparEstoquePecas, calcularItemRomaneio, calcularValorTora, calcularVolumeToraCilindrica, converterDimensoesVendaParaEstoque, normalizarCodigoPlaqueta, validarConfirmacaoRomaneio, validarExclusaoRomaneioProducao, validarSerragemTerceiros } from "./producao.logic";
import { assinaturaComposicaoRomaneioProducao } from "@shared/romaneioCabecalho";

describe("regras de produção", () => {
  it("identifica uma edição exclusiva de cabeçalho sem alterar a composição do romaneio", () => {
    const original = assinaturaComposicaoRomaneioProducao({
      itens: [{ madeiraNome: "Cedrinho", espessura: "2.5", largura: "15", comprimento: "3", quantidade: "10" }],
      aproveitamentos: [{ madeiraNome: "Cedrinho", volume: "0.100000" }],
      incluirAproveitamentoNoRendimento: false,
    });
    expect(assinaturaComposicaoRomaneioProducao({
      itens: [{ madeiraNome: "Cedrinho", espessura: "2.5", largura: "15", comprimento: "3", quantidade: "10" }],
      aproveitamentos: [{ madeiraNome: "Cedrinho", volume: "0.100000" }],
      incluirAproveitamentoNoRendimento: false,
    })).toBe(original);
    expect(assinaturaComposicaoRomaneioProducao({
      itens: [{ madeiraNome: "Cedrinho", espessura: "2.5", largura: "15", comprimento: "3", quantidade: "11" }],
      aproveitamentos: [{ madeiraNome: "Cedrinho", volume: "0.100000" }],
      incluirAproveitamentoNoRendimento: false,
    })).not.toBe(original);
  });
  it("converte bitolas legadas de venda de milímetros para centímetros antes da baixa", () => {
    const itemConvertido = converterDimensoesVendaParaEstoque({ id: 1, madeiraNome: "Cedrinho", espessura: "23", largura: "50", comprimento: "3", quantidade: 32 });
    expect(itemConvertido).toMatchObject({
      espessura: 2.3,
      largura: 5,
      comprimento: "3",
    });
    expect(alocarPecasPermitindoNegativo([itemConvertido], [
      { id: 1, madeiraNome: "Cedrinho", espessura: "2.3", largura: "5", comprimento: "3", quantidadeDisponivel: 32 },
    ])).toMatchObject({ alocacoes: [{ itemVendaId: 1, loteId: 1, quantidade: 32 }], deficits: [] });
  });

  it("calcula metros lineares e volume a partir de centímetros, metros e peças", () => {
    expect(calcularItemRomaneio({ madeiraNome: "Cedrinho", espessura: "2,5", largura: "15", comprimento: "3", quantidade: 10 })).toEqual({
      madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidade: 10, metrosLineares: 30, volume: 0.1125,
    });
  });

  it("aceita uma única plaqueta disponível e bloqueia produção acima do seu volume", () => {
    const confirmado = validarConfirmacaoRomaneio({
      plaqueta: { codigo: "PLQ-001", estado: "disponivel", volumeDisponivel: "1.000000" },
      tora: { madeiraNome: "Cedrinho", volume: "1.000000" },
      itens: [{ madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidade: 10 }],
    });
    expect(confirmado).toMatchObject({ totalPecas: 10, volumeProduzido: 0.1125, volumeRemanescente: 0.8875 });
    expect(() => validarConfirmacaoRomaneio({
      plaqueta: { codigo: "PLQ-001", estado: "disponivel", volumeDisponivel: "0.1" },
      tora: { madeiraNome: "Cedrinho", volume: "0.1" },
      itens: [{ madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidade: 10 }],
    })).toThrow(/excede o volume/i);
  });

  it("recusa plaquetas já consumidas e normaliza seu identificador", () => {
    expect(normalizarCodigoPlaqueta(" plq  001 ")).toBe("PLQ-001");
    expect(() => validarConfirmacaoRomaneio({
      plaqueta: { codigo: "PLQ-001", estado: "consumida", volumeDisponivel: "1" },
      tora: { madeiraNome: "Piqui", volume: "1" },
      itens: [{ madeiraNome: "Piqui", espessura: 3, largura: 20, comprimento: 2, quantidade: 1 }],
    })).toThrow(/não está disponível/i);
  });

  it("recalcula um romaneio em edição com suas próprias plaquetas consumidas", () => {
    const resultado = validarConfirmacaoRomaneio({
      plaqueta: { codigo: "PLQ-EDITADA", estado: "consumida", volumeDisponivel: "0" },
      tora: { madeiraNome: "Piqui", volume: "1" },
      itens: [{ madeiraNome: "Piqui", espessura: 3, largura: 20, comprimento: 2, quantidade: 1 }],
      permitirPlaquetasConsumidas: true,
    });
    expect(resultado).toMatchObject({ totalPecas: 1, volumeTora: 1, volumeProduzido: 0.012, aproveitamento: 1.2 });
  });

  it("permite excluir produção sem movimentações posteriores e bloqueia peças já movimentadas", () => {
    expect(() => validarExclusaoRomaneioProducao({ possuiMovimentacoesPosteriores: false, saldoDasPecasFoiAlterado: false })).not.toThrow();
    expect(() => validarExclusaoRomaneioProducao({ possuiMovimentacoesPosteriores: true, saldoDasPecasFoiAlterado: false })).toThrow(/peças já movimentadas/i);
    expect(() => validarExclusaoRomaneioProducao({ possuiMovimentacoesPosteriores: false, saldoDasPecasFoiAlterado: true })).toThrow(/peças já movimentadas/i);
  });

  it("valida a serragem de terceiros sem exigir plaqueta ou referência", () => {
    expect(validarSerragemTerceiros({
      toras: [{ referencia: "CLI-01", madeiraNome: "Cedrinho", diametro: "50", comprimento: "6,1115498", volume: "1.2" }],
      itens: [{ madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidade: 10 }],
    })).toMatchObject({ volumeToras: 1.2, volumeProduzido: 0.1125, aproveitamento: 9.38 });
    expect(validarSerragemTerceiros({
      toras: [{ referencia: "", madeiraNome: "Cedrinho", diametro: "50", comprimento: "4", volume: "1" }],
      itens: [{ madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidade: 1 }],
    })).toMatchObject({ toras: [{ referencia: "-", madeiraNome: "Cedrinho" }] });
  });

  it("aceita a referência externa não informada repetida na serragem de terceiros", () => {
    expect(validarSerragemTerceiros({
      toras: [
        { referencia: "-", madeiraNome: "Jatobá", diametro: "50", comprimento: "2", volume: "" },
        { referencia: " - ", madeiraNome: "Piqui", diametro: "50", comprimento: "2", volume: "" },
      ],
      itens: [
        { madeiraNome: "Jatobá", espessura: 2.5, largura: 15, comprimento: 2, quantidade: 1 },
        { madeiraNome: "Piqui", espessura: 2.5, largura: 15, comprimento: 2, quantidade: 1 },
      ],
    })).toMatchObject({ toras: [{ referencia: "-" }, { referencia: "-" }] });

    expect(() => validarSerragemTerceiros({
      toras: [
        { referencia: "TER-01", madeiraNome: "Jatobá", diametro: "50", comprimento: "2", volume: "" },
        { referencia: "ter-01", madeiraNome: "Piqui", diametro: "50", comprimento: "2", volume: "" },
      ],
      itens: [
        { madeiraNome: "Jatobá", espessura: 2.5, largura: 15, comprimento: 2, quantidade: 1 },
        { madeiraNome: "Piqui", espessura: 2.5, largura: 15, comprimento: 2, quantidade: 1 },
      ],
    })).toThrow(/mais de uma vez/i);
  });

  it("recalcula as toras de terceiros pelas medidas e cobra pelo volume apurado", () => {
    const resultado = validarSerragemTerceiros({
      toras: [{ referencia: "CLI-02", madeiraNome: "Cedrinho", diametro: "50", comprimento: "4", volume: "999" }],
      itens: [{ madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidade: 1 }],
    });
    expect(resultado.volumeToras).toBeCloseTo(0.785398, 6);
    expect(resultado.toras[0].volume).toBeCloseTo(0.785398, 6);
    expect(calcularValorTora(resultado.volumeToras, "50,00")).toBe(39.27);
  });

  it("calcula o volume cilíndrico da tora pelo diâmetro em centímetros e comprimento em metros", () => {
    expect(calcularVolumeToraCilindrica("50", "4")).toBeCloseTo(Math.PI * 0.25 ** 2 * 4, 8);
    expect(() => calcularVolumeToraCilindrica("0", "4")).toThrow(/diâmetro/i);
  });

  it("calcula o valor da tora pelo volume apurado e preço por metro cúbico", () => {
    expect(calcularValorTora(0.491, 900)).toBe(441.9);
    expect(calcularValorTora("0,491", "900,00")).toBe(441.9);
  });

  it("calcula o aproveitamento usando o volume corrigido da tora no romaneio", () => {
    const resultado = validarConfirmacaoRomaneio({
      plaqueta: { codigo: "PLQ-001", estado: "disponivel", volumeDisponivel: "3.000000" },
      tora: { madeiraNome: "Cedrinho", espessura: "10", largura: "50", comprimento: "4", volume: "2.000000" },
      itens: [{ madeiraNome: "Cedrinho", espessura: "5", largura: "20", comprimento: "4", quantidade: 10 }],
    });
    expect(resultado).toMatchObject({ volumeTora: 2, volumeProduzido: 0.4, aproveitamento: 20 });
  });

  it("mantém o aproveitamento manual fora do rendimento por padrão e permite incluí-lo quando marcado", () => {
    const base = {
      plaqueta: { codigo: "PLQ-APV", estado: "disponivel" as const, volumeDisponivel: "1.000000" },
      tora: { madeiraNome: "Cedrinho", volume: "1.000000" },
      itens: [{ madeiraNome: "Cedrinho", espessura: 5, largura: 20, comprimento: 2, quantidade: 10 }],
      aproveitamentos: [{ madeiraNome: "Cedrinho", volume: "0.2" }],
    };
    expect(validarConfirmacaoRomaneio(base)).toMatchObject({ volumeProduzido: 0.2, volumeAproveitamento: 0.2, volumeComAproveitamento: 0.4, incluirAproveitamentoNoRendimento: false, aproveitamento: 20 });
    expect(validarConfirmacaoRomaneio({ ...base, incluirAproveitamentoNoRendimento: true })).toMatchObject({ incluirAproveitamentoNoRendimento: true, aproveitamento: 40, aproveitamentos: [{ madeiraNome: "Cedrinho", volume: 0.2 }] });
  });

  it("detalha o aproveitamento por essência na produção diária e na serragem de terceiros", () => {
    const toras = [
      { plaqueta: { codigo: "JAT-01", estado: "disponivel" as const, volumeDisponivel: "1" }, tora: { madeiraNome: "Jatobá", volume: "1" } },
      { plaqueta: { codigo: "PIQ-01", estado: "disponivel" as const, volumeDisponivel: "1" }, tora: { madeiraNome: "Piqui", volume: "1" } },
    ];
    const itens = [
      { madeiraNome: "Jatobá", espessura: 5, largura: 20, comprimento: 3, quantidade: 20 },
      { madeiraNome: "Piqui", espessura: 4, largura: 20, comprimento: 3, quantidade: 20 },
    ];
    expect(validarConfirmacaoRomaneio({ toras, itens }).aproveitamentoPorEssencia).toEqual([
      { essencia: "Jatobá", volumeToras: 1, volumeProduzido: 0.6, volumeAproveitamento: 0, volumeComAproveitamento: 0.6, aproveitamento: 60, perdaVolume: 0.4, perdaPercentual: 40 },
      { essencia: "Piqui", volumeToras: 1, volumeProduzido: 0.48, volumeAproveitamento: 0, volumeComAproveitamento: 0.48, aproveitamento: 48, perdaVolume: 0.52, perdaPercentual: 52 },
    ]);

    const terceiros = validarSerragemTerceiros({
      toras: [
        { referencia: "CLI-JAT", madeiraNome: "Jatobá", diametro: "50", comprimento: String(1 / (Math.PI * 0.25 ** 2)), volume: "" },
        { referencia: "CLI-PIQ", madeiraNome: "Piqui", diametro: "50", comprimento: String(1 / (Math.PI * 0.25 ** 2)), volume: "" },
      ],
      itens,
    });
    expect(terceiros.aproveitamentoPorEssencia).toEqual([
      { essencia: "Jatobá", volumeToras: 1, volumeProduzido: 0.6, aproveitamento: 60, perdaVolume: 0.4, perdaPercentual: 40 },
      { essencia: "Piqui", volumeToras: 1, volumeProduzido: 0.48, aproveitamento: 48, perdaVolume: 0.52, perdaPercentual: 52 },
    ]);
  });

  it("bloqueia produção de uma essência acima do volume das toras desta essência", () => {
    expect(() => validarConfirmacaoRomaneio({
      toras: [
        { plaqueta: { codigo: "JAT-02", estado: "disponivel", volumeDisponivel: "1" }, tora: { madeiraNome: "Jatobá", volume: "1" } },
        { plaqueta: { codigo: "PIQ-02", estado: "disponivel", volumeDisponivel: "1" }, tora: { madeiraNome: "Piqui", volume: "1" } },
      ],
      itens: [
        { madeiraNome: "Jatobá", espessura: 5, largura: 20, comprimento: 1, quantidade: 10 },
        { madeiraNome: "Piqui", espessura: 5, largura: 20, comprimento: 3, quantidade: 40 },
      ],
    })).toThrow(/essência/i);
  });

  it("agrupa o saldo disponível por madeira e dimensões de venda", () => {
    expect(agruparEstoquePecas([
      { madeiraNome: "Cedrinho", espessura: "2.5", largura: "15", comprimento: "3", quantidadeDisponivel: 10, volume: "0.112500" },
      { madeiraNome: "Cedrinho", espessura: "2.5", largura: "15", comprimento: "3", quantidadeDisponivel: 5, volume: "0.056250" },
    ])).toEqual([{ madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, propriedade: "proprio", clienteProprietarioId: null, quantidadeEntrada: 15, quantidadeSaida: 0, quantidadeDisponivel: 15, volumeDisponivel: 0.16875 }]);
  });

  it("mantém peças de terceiros separadas do estoque próprio na mesma medida", () => {
    expect(agruparEstoquePecas([
      { madeiraNome: "Cedrinho", espessura: "2.5", largura: "15", comprimento: "3", quantidadeDisponivel: 5, volume: "0.056250", propriedade: "proprio" },
      { madeiraNome: "Cedrinho", espessura: "2.5", largura: "15", comprimento: "3", quantidadeDisponivel: 8, volume: "0.090000", propriedade: "terceiro", clienteProprietarioId: 7 },
    ])).toHaveLength(2);
  });

  it("mantém o volume proporcional quando o saldo de um lote fica negativo", () => {
    expect(agruparEstoquePecas([
      { madeiraNome: "Cedrinho", espessura: "2.5", largura: "15", comprimento: "3", quantidadeProduzida: 10, quantidadeDisponivel: -4, volume: "0.112500" },
    ])).toEqual([{ madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, propriedade: "proprio", clienteProprietarioId: null, quantidadeEntrada: 10, quantidadeSaida: 14, quantidadeDisponivel: -4, volumeDisponivel: -0.045 }]);
  });

  it("separa entradas, saídas e saldo ao consolidar peças produzidas e entregues", () => {
    expect(agruparEstoquePecas([
      { madeiraNome: "Garapeira", espessura: "3", largura: "10", comprimento: "4", quantidadeProduzida: 20, quantidadeDisponivel: 13, volume: "0.156000" },
      { madeiraNome: "Garapeira", espessura: "3", largura: "10", comprimento: "4", quantidadeProduzida: 10, quantidadeDisponivel: 4, volume: "0.078000" },
    ])).toEqual([{
      madeiraNome: "Garapeira", espessura: 3, largura: 10, comprimento: 4,
      propriedade: "proprio", clienteProprietarioId: null,
      quantidadeEntrada: 30, quantidadeSaida: 13, quantidadeDisponivel: 17, volumeDisponivel: 0.1326,
    }]);
  });

  it("aloca peças FIFO entre lotes equivalentes e bloqueia a entrega sem saldo", () => {
    const lotes = [
      { id: 2, madeiraNome: "Cedrinho", espessura: "2.50", largura: "15", comprimento: "3", quantidadeDisponivel: 3, createdAt: new Date(2026, 7, 2) },
      { id: 1, madeiraNome: "Cedrinho", espessura: "2.50", largura: "15", comprimento: "3", quantidadeDisponivel: 2, createdAt: new Date(2026, 7, 1) },
    ];
    expect(alocarPecasParaEntrega([{ id: 9, madeiraNome: "cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidade: 4 }], lotes)).toEqual([
      { itemVendaId: 9, loteId: 1, quantidade: 2 },
      { itemVendaId: 9, loteId: 2, quantidade: 2 },
    ]);
    expect(() => alocarPecasParaEntrega([{ id: 9, madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidade: 6 }], lotes)).toThrow(/Estoque insuficiente/);
  });

  it("mantém a entrega e informa o déficit quando a quantidade vendida excede o saldo", () => {
    const resultado = alocarPecasPermitindoNegativo([
      { id: 9, madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidade: 5 },
    ], [
      { id: 1, madeiraNome: "Cedrinho", espessura: "2.50", largura: "15", comprimento: "3", quantidadeDisponivel: 2, createdAt: new Date(2026, 7, 1) },
    ]);

    expect(resultado.alocacoes).toEqual([{ itemVendaId: 9, loteId: 1, quantidade: 2 }]);
    expect(resultado.deficits).toEqual([{ itemVendaId: 9, madeiraNome: "Cedrinho", espessura: 2.5, largura: 15, comprimento: 3, quantidade: 3 }]);
  });
});
