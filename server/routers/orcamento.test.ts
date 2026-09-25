import { describe, expect, it } from "vitest";
import { AproveitamentoVendaSchema, CondicaoPagamentoVendaSchema, ItemSchema, RegistroEntregaFisicaSchema } from "./orcamento";
import { historicoAlteracoes } from "../../drizzle/schema";
import { classificarCategoriaOperacionalVenda } from "../db";

describe("itens de orçamento livres", () => {
  it("aceita madeira digitada e preço por m³ sem madeira cadastrada", () => {
    const item = ItemSchema.parse({
      madeiraId: null,
      bitolaId: null,
      madeiraNome: "Garapeira aparelhada",
      bitolaDescricao: "2,5×15 cm",
      espessura: "25",
      largura: "150",
      comprimento: "3",
      quantidade: 4,
      precoM3: "2450.50",
      precoLinear: "91.89",
      valorPeca: "275.67",
      valorTotal: "1102.68",
    });

    expect(item.madeiraId).toBeNull();
    expect(item.madeiraNome).toBe("Garapeira aparelhada");
    expect(item.precoM3).toBe("2450.50");
  });

  it("aceita item comercial por unidade ou pacote sem exigir medidas físicas", () => {
    const unidade = ItemSchema.parse({
      madeiraId: null,
      bitolaId: null,
      madeiraNome: "Portal",
      bitolaDescricao: "Venda por unidade",
      espessura: "0",
      largura: "0",
      comprimento: "0",
      quantidade: 2,
      tipoComercializacao: "unidade",
      unidadesPorComercializacao: 0,
      precoM3: "180",
      precoLinear: "0",
      valorPeca: "180",
      valorTotal: "360",
    });

    expect(unidade).toMatchObject({ tipoComercializacao: "unidade", unidadesPorComercializacao: 0, quantidade: 2 });
    expect(() => ItemSchema.parse({ ...unidade, tipoComercializacao: "pacote", quantidade: 0 })).toThrow(/quantidade/i);
  });
});

describe("aproveitamento selecionado no romaneio", () => {
  it("aceita a essência, o volume em m³ e o preço por m³ escolhidos na venda", () => {
    expect(AproveitamentoVendaSchema.parse({
      madeiraNome: "Cedrinho",
      volume: "0,350",
      precoM3: "620,00",
    })).toEqual({ madeiraNome: "Cedrinho", volume: "0.350", precoM3: "620.00" });
  });

  it("rejeita aproveitamento sem volume positivo", () => {
    expect(() => AproveitamentoVendaSchema.parse({ madeiraNome: "Cedrinho", volume: "0", precoM3: "620" }))
      .toThrow("Informe um volume de aproveitamento positivo");
  });
});

describe("histórico de alterações", () => {
  it("aceita registrar mudanças de estado de orçamento", () => {
    expect(historicoAlteracoes.tipo.enumValues).toContain("estado");
  });
});

describe("fluxos independentes de pagamento e entrega", () => {
  it("move a venda de aprovada para paga e então concluída quando a retirada ocorre após o pagamento", () => {
    const inicial = classificarCategoriaOperacionalVenda(false, false);
    const aposPagamento = classificarCategoriaOperacionalVenda(true, false);
    const aposEntrega = classificarCategoriaOperacionalVenda(true, true);

    expect(inicial).toBe("aprovadas");
    expect(aposPagamento).toBe("pagas");
    expect(aposEntrega).toBe("concluidas");
  });

  it("move a venda de aprovada para entregue e então concluída quando o pagamento é posterior", () => {
    const inicial = classificarCategoriaOperacionalVenda(false, false);
    const aposEntrega = classificarCategoriaOperacionalVenda(false, true);
    const aposPagamento = classificarCategoriaOperacionalVenda(true, true);

    expect(inicial).toBe("aprovadas");
    expect(aposEntrega).toBe("entregues");
    expect(aposPagamento).toBe("concluidas");
  });

  it("exige dados operacionais rastreáveis ao registrar a entrega", () => {
    expect(RegistroEntregaFisicaSchema.parse({
      id: 12,
      entregueEm: "2026-08-14",
      modalidadeEntrega: "entrega",
      responsavelEntrega: "João da Silva",
      observacoesEntrega: "Recebido no pátio do cliente.",
      aproveitamentos: [{ madeiraNome: "Cedrinho", volume: "0,250" }],
    })).toMatchObject({ modalidadeEntrega: "entrega", responsavelEntrega: "João da Silva", aproveitamentos: [{ madeiraNome: "Cedrinho", volume: "0.250" }] });

    expect(() => RegistroEntregaFisicaSchema.parse({
      id: 12,
      entregueEm: "2026-08-14",
      modalidadeEntrega: "retirada",
      responsavelEntrega: "J",
    })).toThrow("Informe o responsável pela entrega");

    expect(() => RegistroEntregaFisicaSchema.parse({
      id: 12,
      entregueEm: "2026-08-14",
      modalidadeEntrega: "retirada",
      responsavelEntrega: "João da Silva",
      aproveitamentos: [{ madeiraNome: "Cedrinho", volume: "0" }],
    })).toThrow("Informe um volume de aproveitamento positivo");
  });
});

describe("condição de pagamento da venda", () => {
  it("aceita vencimentos parcelados e limita a quantidade de títulos", () => {
    expect(CondicaoPagamentoVendaSchema.parse({
      id: 12,
      parcelas: [{ dataVencimento: "2030-01-30" }, { dataVencimento: "2030-03-01" }, { dataVencimento: "2030-03-31" }],
    }).parcelas).toHaveLength(3);
    expect(() => CondicaoPagamentoVendaSchema.parse({ id: 12, parcelas: [] })).toThrow("ao menos uma parcela");
    expect(() => CondicaoPagamentoVendaSchema.parse({ id: 12, parcelas: Array.from({ length: 25 }, () => ({ dataVencimento: "2030-01-30" })) })).toThrow("no máximo 24 parcelas");
  });
});
