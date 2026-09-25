import { describe, expect, it } from "vitest";
import { disponibilidadeEstoqueVenda, prepararModeloMedida } from "./vendaMedidas";

describe("medidas de venda", () => {
  const estoque = [
    { madeiraNome: "Cedrinho", espessura: "2", largura: "5", comprimento: "3", quantidadeDisponivel: 18 },
    { madeiraNome: "Cedrinho", espessura: "2", largura: "5", comprimento: "4.5", quantidadeDisponivel: -2 },
  ];

  it("encontra a disponibilidade por madeira, medida e comprimento, aceitando vírgulas", () => {
    expect(disponibilidadeEstoqueVenda({ estoque, madeiraNome: " cedrinho ", espessuraCm: "2,0", larguraCm: "5", comprimento: "3,00" })).toBe(18);
    expect(disponibilidadeEstoqueVenda({ estoque, madeiraNome: "Cedrinho", espessuraCm: "2", larguraCm: "5", comprimento: "4,5" })).toBe(-2);
    expect(disponibilidadeEstoqueVenda({ estoque, madeiraNome: "Cedrinho", espessuraCm: "2", larguraCm: "5", comprimento: "5" })).toBe(0);
    expect(disponibilidadeEstoqueVenda({ estoque, madeiraNome: "", espessuraCm: "2", larguraCm: "5", comprimento: "3" })).toBeNull();
  });

  it("prepara modelos somente com dados completos e sem linhas parciais", () => {
    const base = { madeiraNome: "Cedrinho", precoM3: "2300", espessuraCm: "2", larguraCm: "5" };
    expect(prepararModeloMedida({ ...base, nome: "Cedrinho 2×5", linhas: [{ id: 1, comprimento: "3", quantidade: "20" }, { id: 2, comprimento: "4", quantidade: "10" }] })).toEqual({
      nome: "Cedrinho 2×5",
      comprimentos: [{ comprimento: "3", quantidade: "20" }, { comprimento: "4", quantidade: "10" }],
    });
    expect(prepararModeloMedida({ ...base, nome: "", linhas: [{ id: 1, comprimento: "3", quantidade: "20" }] }).erro).toMatch(/nome/i);
    expect(prepararModeloMedida({ ...base, nome: "Teste", linhas: [{ id: 1, comprimento: "3", quantidade: "" }] }).erro).toMatch(/comprimentos e as quantidades/i);
  });
});
