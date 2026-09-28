import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { clientes, fornecedores, colaboradoresRh, departamentosRh, cargosRh, centrosCustosGerenciais, contasFinanceiras, categoriasFinanceiras, categoriasLancamentosRh, categoriasCustosGerenciais } from "../../drizzle/schema";
import { getDb } from "./core";
import { madeiras, bitolas, produtosComerciais, titulosFinanceiros, orcamentos, notasDiesel, romaneiosCargaToras, romaneiosProducao, lotesPecasSerradas, plaquetas, serragensTerceiros, folhasPagamentoRh, itensFolhaPagamentoRh, eventosFolhaRh, adiantamentosRh, baixasFinanceiras } from "../../drizzle/schema";

// Foreign IDs supplied by a caller are not proof of ownership. Validate before writes.
export async function validarReferenciasEmpresa(input: unknown, empresaId: number, path: string) {
  const tables = {
    clienteId: clientes, fornecedorId: fornecedores, colaboradorId: colaboradoresRh,
    departamentoId: departamentosRh, cargoId: cargosRh, centroCustoId: centrosCustosGerenciais,
    contaFinanceiraId: contasFinanceiras, contaOrigemId: contasFinanceiras, contaDestinoId: contasFinanceiras,
    madeiraId: madeiras, bitolaId: bitolas, produtoComercialId: produtosComerciais,
    tituloId: titulosFinanceiros, tituloFinanceiroId: titulosFinanceiros, orcamentoId: orcamentos,
    notaDieselId: notasDiesel, romaneioCargaId: romaneiosCargaToras, romaneioProducaoId: romaneiosProducao,
    loteId: lotesPecasSerradas, plaquetaId: plaquetas, serragemId: serragensTerceiros,
    folhaId: folhasPagamentoRh, itemFolhaId: itensFolhaPagamentoRh, eventoId: eventosFolhaRh,
    adiantamentoId: adiantamentosRh, baixaFinanceiraId: baixasFinanceiras,
    categoriaPaiId: categoriasFinanceiras, categoriaCustoId: categoriasCustosGerenciais,
    categoriaId: path.startsWith("rh.fichas.") ? categoriasLancamentosRh : path.startsWith("custosGerenciais.") ? categoriasCustosGerenciais : categoriasFinanceiras,
  };
  const refs = new Map<keyof typeof tables, Set<number>>();
  function collect(value: unknown, depth = 0) {
    if (depth > 12) throw new TRPCError({ code: "BAD_REQUEST", message: "Estrutura de entrada muito profunda." });
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (Object.hasOwn(tables, key) && typeof child === "number" && Number.isSafeInteger(child) && child > 0) {
        const field = key as keyof typeof tables;
        const ids = refs.get(field) ?? new Set<number>(); ids.add(child); refs.set(field, ids);
      } else if (child && typeof child === "object") collect(child, depth + 1);
    }
  }
  collect(input);
  if (!refs.size) return;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Base de dados indisponível." });
  for (const [field, values] of Array.from(refs)) {
    const table = tables[field], ids = Array.from(values);
    if (ids.length > 5000) throw new TRPCError({ code: "BAD_REQUEST", message: "Muitas referências na requisição." });
    const rows = await db.select({ id: table.id }).from(table).where(and(eq(table.empresaId, empresaId), inArray(table.id, ids)));
    if (rows.length !== ids.length) throw new TRPCError({ code: "NOT_FOUND", message: "Registro relacionado não encontrado." });
  }
}
