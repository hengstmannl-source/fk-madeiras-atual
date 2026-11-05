import { readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { describe, expect, it } from "vitest";
import {
  ajustesFinanceirosVenda,
  ciclosEntrega,
  movimentacoesEstoqueSerrado,
  orcamentos,
  reservasEstoqueVenda,
  revisoesVendas,
  type InsertOrcamento,
} from "../drizzle/schema";

const migrationPath =
  "drizzle/migrations/manual/0073_add_internal_sales_modeling.sql";
const migrationSql = readFileSync(migrationPath, "utf8");

function columnConfig(
  table: Parameters<typeof getTableConfig>[0],
  name: string
) {
  return getTableConfig(table).columns.find(column => column.name === name);
}

function uniqueIndexNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table)
    .indexes.filter(tableIndex => tableIndex.config.unique)
    .map(tableIndex => tableIndex.config.name);
}

describe("modelagem aditiva de vendas internas", () => {
  it("mantém externa e versão 1 como defaults compatíveis com criação e duplicação", () => {
    const tipoVenda = columnConfig(orcamentos, "tipoVenda");
    const versaoComercial = columnConfig(orcamentos, "versaoComercial");
    const versaoCalculoComercial = columnConfig(orcamentos, "versaoCalculoComercial");

    expect(tipoVenda).toMatchObject({ notNull: true, default: "externa" });
    expect(versaoComercial).toMatchObject({ notNull: true, default: 1 });
    expect(versaoCalculoComercial).toMatchObject({ notNull: false });
    expect(versaoCalculoComercial?.default).toBeUndefined();

    // Os fluxos atuais de criação manual e duplicação podem omitir os novos campos;
    // o banco preencherá os defaults ao inserir depois que a migration for aplicada.
    const manualDraft: InsertOrcamento = { empresaId: 1, clienteId: 1 };
    const duplicatedDraft: InsertOrcamento = { empresaId: 1, clienteId: 2 };
    const legacyRecord: InsertOrcamento = { empresaId: 1, clienteId: 3, versaoCalculoComercial: null };
    const correctedCalculation: InsertOrcamento = { empresaId: 1, clienteId: 4, versaoCalculoComercial: 1 };
    expect(manualDraft).not.toHaveProperty("tipoVenda");
    expect(duplicatedDraft).not.toHaveProperty("versaoComercial");
    expect(legacyRecord.versaoCalculoComercial).toBeNull();
    expect(correctedCalculation.versaoCalculoComercial).toBe(1);
  });

  it("define snapshots e unicidade de versão para revisões comerciais", () => {
    expect(
      getTableConfig(revisoesVendas).columns.map(column => column.name)
    ).toEqual(
      expect.arrayContaining([
        "empresaId",
        "orcamentoId",
        "versaoAnterior",
        "versaoNova",
        "usuarioId",
        "motivo",
        "totalAnterior",
        "totalNovo",
        "snapshotAnterior",
        "snapshotNovo",
      ])
    );
    expect(uniqueIndexNames(revisoesVendas)).toContain(
      "revisoes_vendas_empresa_orcamento_versao_unico"
    );
  });

  it("define ciclos sequenciais e rastreabilidade de estorno", () => {
    expect(uniqueIndexNames(ciclosEntrega)).toEqual(
      expect.arrayContaining([
        "ciclos_entrega_empresa_orcamento_numero_unico",
        "ciclos_entrega_uma_ativa_por_venda_unico",
      ])
    );
    expect(columnConfig(ciclosEntrega, "cicloAtivoOrcamentoId")?.generated).toMatchObject({
      type: "always",
      mode: "stored",
    });
    expect(getTableConfig(ciclosEntrega).checks.map(constraint => constraint.name)).toContain(
      "ciclos_entrega_motivo_estorno_obrigatorio_chk"
    );
    expect(columnConfig(ciclosEntrega, "motivoEstorno")?.notNull).toBe(false);
    expect(
      columnConfig(movimentacoesEstoqueSerrado, "cicloEntregaId")?.notNull
    ).toBe(false);
    expect(
      columnConfig(movimentacoesEstoqueSerrado, "estornoDeMovimentoId")?.notNull
    ).toBe(false);
    expect(uniqueIndexNames(movimentacoesEstoqueSerrado)).toContain(
      "mov_estoque_serrado_estorno_original_unico"
    );
  });

  it("representa reservas por item, versão e alocação física sem presumir lote", () => {
    const config = getTableConfig(reservasEstoqueVenda);
    expect(config.columns.map(column => column.name)).toEqual(
      expect.arrayContaining([
        "empresaId",
        "orcamentoId",
        "itemOrcamentoId",
        "versaoComercial",
        "chaveReserva",
        "tipoComercializacao",
        "produtoComercialId",
        "madeiraId",
        "bitolaId",
        "loteId",
        "quantidade",
        "unidadeMedida",
        "estado",
        "criadoPor",
      ])
    );
    expect(columnConfig(reservasEstoqueVenda, "loteId")?.notNull).toBe(false);
    expect(uniqueIndexNames(reservasEstoqueVenda)).toContain(
      "reservas_estoque_venda_alocacao_unica"
    );
    expect(getTableConfig(reservasEstoqueVenda).checks.map(constraint => constraint.name)).toContain(
      "reservas_estoque_venda_quantidade_positiva_chk"
    );
  });

  it("permite vários ajustes por revisão e mantém índices de busca", () => {
    const config = getTableConfig(ajustesFinanceirosVenda);
    expect(config.indexes.filter(index => index.config.unique)).toHaveLength(0);
    expect(config.indexes.map(index => index.config.name)).toEqual(expect.arrayContaining([
      "ajustes_financeiros_venda_revisao_idx",
      "ajustes_financeiros_venda_titulo_idx",
      "ajustes_financeiros_venda_empresa_orcamento_idx",
    ]));
  });

  it("prepara somente SQL aditivo e mantém o histórico de migrations intacto", () => {
    expect(migrationSql).toContain("DEFAULT 'externa'");
    expect(migrationSql).toContain("DEFAULT 1");
    expect(migrationSql).toMatch(/ADD COLUMN `versaoCalculoComercial` int,\s*ALGORITHM=INSTANT/i);
    expect(migrationSql).toContain("ALGORITHM=INSTANT");
    expect(migrationSql).toContain("ALGORITHM=INPLACE");
    expect(migrationSql).toContain("GENERATED ALWAYS AS");
    expect(migrationSql).toContain(
      "CONSTRAINT `reservas_estoque_venda_quantidade_positiva_chk` CHECK (`quantidade` > 0)"
    );
    expect(migrationSql).toContain(
      "UNIQUE INDEX `mov_estoque_serrado_estorno_original_unico` (`estornoDeMovimentoId`)"
    );
    expect(migrationSql).not.toMatch(
      /\b(DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM|UPDATE\s+`?orcamentos`?)\b/i
    );
  });
});
