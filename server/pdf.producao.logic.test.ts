import { describe, expect, it } from "vitest";
import { resumirPecasPdfPorEssencia } from "./pdf.producao.logic";

describe("resumirPecasPdfPorEssencia", () => {
  it("calcula a participação de cada bitola somente dentro da própria essência", () => {
    const resumos = resumirPecasPdfPorEssencia([
      { madeiraNome: "Jatobá", espessura: "2.5", largura: "30", comprimento: "3", quantidade: 12, volume: "0.3", metrosLineares: "36" },
      { madeiraNome: "Jatobá", espessura: "3", largura: "30", comprimento: "4", quantidade: 14, volume: "0.7", metrosLineares: "56" },
      { madeiraNome: "Piqui", espessura: "2.5", largura: "30", comprimento: "3", quantidade: 8, volume: "0.5", metrosLineares: "24" },
    ]);

    expect(resumos).toHaveLength(2);
    const jatoba = resumos.find((resumo) => resumo.essencia === "Jatobá")!;
    const piqui = resumos.find((resumo) => resumo.essencia === "Piqui")!;

    expect(jatoba.totalVolume).toBe(1);
    expect(jatoba.gruposPorBitola.map((grupo) => grupo.percentualDaEssencia)).toEqual([30, 70]);
    expect(piqui.totalVolume).toBe(0.5);
    expect(piqui.gruposPorBitola[0]?.percentualDaEssencia).toBe(100);
  });
});
