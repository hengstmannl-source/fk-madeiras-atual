import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { plaquetas, romaneiosCargaToras } from "../../drizzle/schema";

vi.mock("./identidade", () => ({ getEmpresaUnica: vi.fn(async () => ({ id: 7 })) }));
vi.mock("./core", () => ({ getDb: vi.fn() }));
import { getDb } from "./core";
import { getRelatorioRomaneiosCarga, getRelatorioPlaquetasEstoque, listPlaquetas } from "./estoque";

const itens = Array.from({ length: 25 }, (_, indice) => ({
  id: indice + 1, codigo: `PLQ-${indice + 1}`, codigoFisico: String(indice + 1),
  madeiraNome: indice < 20 ? "CÉDRINHO" : "ITAÚBA", createdAt: new Date(2026, 8, 1),
  estado: indice % 2 ? "consumida" : "disponivel",
  volumeDisponivel: indice % 2 ? "0" : "0.125000", volumeInicial: "0.250000",
}));
const where = vi.fn();
const groupBy = vi.fn();
const orderBy = vi.fn();
const select = vi.fn((_campos?: Record<string, any>) => ({ from: (tabela: unknown) => ({ where: (condicao: any) => {
  where(tabela, condicao);
  return { orderBy, groupBy };
} }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockResolvedValue({ select } as any);
  orderBy.mockResolvedValue(itens);
});

describe("volume filtrado de plaquetas", () => {
  it("gera relatório de todas as plaquetas com os mesmos filtros e volumes da grade", async () => {
    const relatorio = await getRelatorioPlaquetasEstoque();
    expect(relatorio).toMatchObject({ total: 25, volumeTotal: 4.625, volumes: { disponivel: 1.625, consumida: 3, cancelada: 0 } });
    expect(relatorio.essencias).toEqual([{ essencia: "CÉDRINHO", quantidade: 20, volume: 3.75 }, { essencia: "ITAÚBA", quantidade: 5, volume: 0.875 }]);
    const consumidas = await getRelatorioPlaquetasEstoque({ busca: "CEDRI", estado: "consumida" });
    expect(consumidas).toMatchObject({ total: 10, volumeTotal: 2.5 });
    expect(consumidas.itens.every(item => item.estado === "consumida")).toBe(true);
    expect((await getRelatorioPlaquetasEstoque({ busca: "inexistente" })).total).toBe(0);
  });

  it("inclui mais de 500 resultados e mantém a identificação de plaquetas duplicadas", async () => {
    orderBy.mockResolvedValue(Array.from({ length: 525 }, (_, i) => ({ ...itens[0], id: i + 1, codigo: `INT-${i}`, codigoFisico: "REPETIDA" })));
    const resultado = await getRelatorioPlaquetasEstoque();
    expect(resultado.itens).toHaveLength(525);
    expect(resultado.volumeTotal).toBe(65.625);
    expect(resultado.itens[0].indiceDuplicidade).toBe(525);
  });
  it.each([
    [{}, 25, 4.625],
    [{ estado: "disponivel" as const }, 13, 1.625],
    [{ estado: "consumida" as const }, 12, 3],
    [{ busca: "CEDRI" }, 20, 3.75],
    [{ busca: "CEDRI", estado: "consumida" as const }, 10, 2.5],
    [{ busca: "CEDRI", estado: "disponivel" as const }, 10, 1.25],
    [{ busca: "itauba" }, 5, 0.875],
    [{ busca: "PLQ-25" }, 1, 0.125],
    [{ busca: "inexistente" }, 0, 0],
  ])("respeita busca e situação: %j", async (filtros, total, volume) => {
    const resultado = await listPlaquetas(filtros);
    expect(resultado.total).toBe(total);
    expect(resultado.totalVolumeFiltrado).toBeCloseTo(volume, 6);
    const consulta = new MySqlDialect().sqlToQuery(where.mock.calls[0][1]);
    expect(consulta.params).toEqual([7]);
  });

  it("mantém o mesmo total em todas as páginas e não devolve o estoque completo", async () => {
    for (const deslocamento of [0, 10, 20]) {
      const resultado = await listPlaquetas({ deslocamento, limite: 10 });
      expect(resultado.totalVolumeFiltrado).toBe(4.625);
      expect(resultado.totalVolumeDisponivel).toBe(1.625);
      expect(resultado.total).toBe(25);
      expect(resultado.itens.length).toBe(deslocamento === 20 ? 5 : 10);
    }
  });

  it("retorna total zero quando não há conexão", async () => {
    vi.mocked(getDb).mockResolvedValue(null);
    expect(await listPlaquetas()).toMatchObject({ totalVolumeFiltrado: 0, itens: [] });
  });

  it("não estima volumes históricos ausentes e distingue canceladas do saldo disponível", async () => {
    orderBy.mockResolvedValue([
      { ...itens[0], estado: "consumida", volumeInicial: "0", volumeDisponivel: "0" },
      { ...itens[1], estado: "cancelada", volumeInicial: "0.500000", volumeDisponivel: "0" },
    ]);
    expect(await listPlaquetas({ estado: "consumida" })).toMatchObject({ totalVolumeFiltrado: 0, totalVolumeDisponivel: 0 });
    expect(await listPlaquetas({ estado: "cancelada" })).toMatchObject({ totalVolumeFiltrado: 0.5, totalVolumeDisponivel: 0 });
    expect(await listPlaquetas()).toMatchObject({ totalVolumeFiltrado: 0.5, totalVolumeDisponivel: 0 });
  });
});

describe("relatório de romaneios", () => {
  beforeEach(() => {
    orderBy.mockResolvedValue([
      { id: 12, numero: "ROM-12", origem: "Fazenda Norte" },
      { id: 11, numero: "ROM-11", origem: "Fazenda Sul" },
    ]);
    groupBy.mockResolvedValue([{ essencia: "CEDRINHO", quantidade: "12", volume: "1.125000" }, { essencia: "ITAÚBA", quantidade: "3", volume: "0.375000" }]);
  });

  it("agrega quantidade e volume inicial por essência com isolamento de empresa", async () => {
    const resultado = await getRelatorioRomaneiosCarga();
    expect(resultado).toMatchObject({ totalPlaquetas: 15, volumeTotal: 1.5 });
    expect(resultado.essencias).toEqual([{ essencia: "CEDRINHO", quantidade: 12, volume: 1.125 }, { essencia: "ITAÚBA", quantidade: 3, volume: 0.375 }]);
    expect(where.mock.calls[1][0]).toBe(plaquetas);
    const consulta = new MySqlDialect().sqlToQuery(where.mock.calls[1][1]);
    expect(consulta.params).toEqual([7, 12, 11]);
    expect(groupBy).toHaveBeenCalledOnce();
    const campos = select.mock.calls[1][0]!;
    const dialect = new MySqlDialect();
    expect(dialect.sqlToQuery(campos.quantidade).sql).toBe("count(*)");
    expect(dialect.sqlToQuery(campos.volume).sql).toContain("sum(`plaquetas`.`volumeInicial`)");
    expect(dialect.sqlToQuery(groupBy.mock.calls[0][0]).sql).toBe("upper(trim(`plaquetas`.`madeiraNome`))");
  });

  it("intersecta os selecionados com origem e aplica as datas da listagem", async () => {
    const dataInicial = new Date(2026, 8, 1, 12);
    const dataFinal = new Date(2026, 8, 30, 12);
    const resultado = await getRelatorioRomaneiosCarga({ origem: "norte", ids: [12, 11, 999], dataInicial, dataFinal });
    expect(resultado.cargas.map(item => item.id)).toEqual([12]);
    expect(where.mock.calls[0][0]).toBe(romaneiosCargaToras);
    expect(new MySqlDialect().sqlToQuery(where.mock.calls[0][1]).params).toHaveLength(3);
    expect(new MySqlDialect().sqlToQuery(where.mock.calls[1][1]).params).toEqual([7, 12]);
  });

  it("não agrega plaquetas quando a seleção não corresponde aos filtros", async () => {
    expect(await getRelatorioRomaneiosCarga({ ids: [999] })).toMatchObject({ cargas: [], essencias: [], totalPlaquetas: 0, volumeTotal: 0 });
    expect(groupBy).not.toHaveBeenCalled();
  });
});
