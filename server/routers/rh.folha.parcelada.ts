import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  adiantamentosRh,
  categoriasFinanceiras,
  colaboradoresRh,
  dependentesRh,
  eventosItensFolhaRh,
  faixasTributariasRh,
  folhasPagamentoRh,
  itensFolhaPagamentoRh,
  parcelasAdiantamentosRh,
  regrasReducaoIrrfRh,
  tabelasTributariasRh,
  titulosFinanceiros,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure } from "../_core/trpc";
import { calcularFolhaColaboradorRh, competenciaRh, type EventoCalculoFolhaRh } from "../rh.logic";
import { garantirTituloFinanceiroAutomatico } from "../repositories/financeiro";

const rhProcedure = protectedProcedure;
const idSchema = z.number().int().positive();
const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida");

function numero(valor: unknown) { return Number(valor ?? 0); }
function decimal(valor: number | string) { return Number(valor).toFixed(2); }
function dataLocal(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
}

async function bancoObrigatorio() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "A base de dados não está disponível." });
  return db;
}

async function garantirCategoriaFolha(empresaId: number, usuarioId: number) {
  const db = await bancoObrigatorio();
  const existente = await db.select().from(categoriasFinanceiras).where(and(eq(categoriasFinanceiras.empresaId, empresaId), eq(categoriasFinanceiras.nome, "Folha de pagamento"))).limit(1);
  if (existente[0]) return existente[0].id;
  const criado = await db.insert(categoriasFinanceiras).values({ empresaId, nome: "Folha de pagamento", tipo: "despesa", ativo: true, criadoPor: usuarioId });
  return Number(criado[0].insertId);
}

async function regrasDaCompetencia(empresaId: number, competencia: Date) {
  const db = await bancoObrigatorio();
  const tabelas = await db.select().from(tabelasTributariasRh).where(eq(tabelasTributariasRh.empresaId, empresaId));
  const vigentes = tabelas.filter((tabela) => tabela.ativo && tabela.vigenciaInicio <= competencia && (!tabela.vigenciaFim || tabela.vigenciaFim >= competencia));
  const ids = vigentes.map((tabela) => tabela.id);
  const [faixas, reducoes] = await Promise.all([
    ids.length ? db.select().from(faixasTributariasRh).where(inArray(faixasTributariasRh.tabelaTributariaId, ids)).orderBy(asc(faixasTributariasRh.limiteInferior)) : Promise.resolve([]),
    ids.length ? db.select().from(regrasReducaoIrrfRh).where(and(eq(regrasReducaoIrrfRh.empresaId, empresaId), inArray(regrasReducaoIrrfRh.tabelaTributariaId, ids))).orderBy(asc(regrasReducaoIrrfRh.ordem)) : Promise.resolve([]),
  ]);
  const tabela = (tipo: "inss" | "irrf" | "fgts") => vigentes.filter((item) => item.tipo === tipo).sort((a, b) => b.vigenciaInicio.getTime() - a.vigenciaInicio.getTime())[0];
  const mapearFaixas = (tipo: "inss" | "irrf") => {
    const regra = tabela(tipo);
    return regra ? faixas.filter((faixa) => faixa.tabelaTributariaId === regra.id).map((faixa) => ({ limiteInferior: numero(faixa.limiteInferior), limiteSuperior: faixa.limiteSuperior === null ? null : numero(faixa.limiteSuperior), aliquota: numero(faixa.aliquota), parcelaDeduzir: numero(faixa.parcelaDeduzir) })) : [];
  };
  const irrf = tabela("irrf"); const fgts = tabela("fgts");
  return { faixasInss: mapearFaixas("inss"), faixasIrrf: mapearFaixas("irrf"), aliquotaFgts: numero(fgts?.aliquotaFixa), deducaoDependenteIrrf: numero(irrf?.deducaoDependente), descontoSimplificadoIrrf: numero(irrf?.descontoSimplificado), regrasReducaoIrrf: irrf ? reducoes.filter((regra) => regra.tabelaTributariaId === irrf.id).map((regra) => ({ tipo: regra.tipo, limiteInferior: numero(regra.limiteInferior), limiteSuperior: regra.limiteSuperior === null ? null : numero(regra.limiteSuperior), valorMaximo: numero(regra.valorMaximo), constante: numero(regra.constante), coeficiente: numero(regra.coeficiente), ordem: regra.ordem })) : [], tabelaIrrfId: irrf?.id ?? null, tabelaIrrfNome: irrf?.nome ?? null, vigenciaIrrf: irrf ? irrf.vigenciaInicio.toISOString() : null };
}

export function descontosParceladosDaCompetencia(
  adiantamentos: Array<{ id: number; colaboradorId: number; competencia: Date; saldoPendente: string | number; estado: string }>,
  parcelas: Array<{ adiantamentoId: number; competencia: Date; valor: string | number; estado: string }>,
  referencia: Date,
) {
  const descontos = new Map<number, number>();
  for (const adiantamento of adiantamentos) {
    if (adiantamento.estado !== "aberto") continue;
    const plano = parcelas.filter((parcela) => parcela.adiantamentoId === adiantamento.id);
    const valor = plano.length
      ? plano.filter((parcela) => parcela.estado === "pendente" && parcela.competencia.getTime() === referencia.getTime()).reduce((soma, parcela) => soma + numero(parcela.valor), 0)
      : adiantamento.competencia.getTime() === referencia.getTime() ? numero(adiantamento.saldoPendente) : 0;
    if (valor > 0) descontos.set(adiantamento.colaboradorId, (descontos.get(adiantamento.colaboradorId) ?? 0) + valor);
  }
  return descontos;
}

export function situacaoAposBaixaParcelas(parcelas: Array<{ valor: string | number; estado: string }>) {
  const saldoPendente = parcelas.filter((parcela) => parcela.estado === "pendente").reduce((soma, parcela) => soma + numero(parcela.valor), 0);
  return { saldoPendente: decimal(saldoPendente), estado: saldoPendente > 0 ? "aberto" as const : "descontado" as const };
}

async function planosDosAdiantamentos(db: Awaited<ReturnType<typeof bancoObrigatorio>>, empresaId: number, adiantamentoIds: number[]) {
  if (!adiantamentoIds.length) return [];
  return db.select().from(parcelasAdiantamentosRh).where(and(eq(parcelasAdiantamentosRh.empresaId, empresaId), inArray(parcelasAdiantamentosRh.adiantamentoId, adiantamentoIds)));
}

export const folhaParcelada = {
  recalcular: rhProcedure.input(z.object({ folhaId: idSchema })).mutation(async ({ ctx, input }) => {
    const db = await bancoObrigatorio();
    const empresaId = ctx.configuracaoEmpresa.id;
    const folha = await db.select().from(folhasPagamentoRh).where(and(eq(folhasPagamentoRh.id, input.folhaId), eq(folhasPagamentoRh.empresaId, empresaId))).limit(1);
    if (!folha[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Folha não encontrada." });
    if (folha[0].estado !== "aberta") throw new TRPCError({ code: "BAD_REQUEST", message: "Reabra a folha antes de recalcular." });

    const [itens, dependentes, adiantamentos, eventos] = await Promise.all([
      db.select().from(itensFolhaPagamentoRh).where(and(eq(itensFolhaPagamentoRh.empresaId, empresaId), eq(itensFolhaPagamentoRh.folhaId, input.folhaId))),
      db.select().from(dependentesRh).where(and(eq(dependentesRh.empresaId, empresaId), eq(dependentesRh.ativo, true), eq(dependentesRh.deduzIrrf, true))),
      db.select().from(adiantamentosRh).where(and(eq(adiantamentosRh.empresaId, empresaId), eq(adiantamentosRh.estado, "aberto"))),
      db.select().from(eventosItensFolhaRh).where(eq(eventosItensFolhaRh.empresaId, empresaId)),
    ]);
    const planos = await planosDosAdiantamentos(db, empresaId, adiantamentos.map((adiantamento) => adiantamento.id));
    const descontos = descontosParceladosDaCompetencia(adiantamentos, planos, folha[0].competencia);
    const regrasVigentes = await regrasDaCompetencia(empresaId, folha[0].competencia);
    for (const item of itens) {
      const eventosDoItem: EventoCalculoFolhaRh[] = eventos.filter((evento) => evento.itemFolhaId === item.id).map((evento) => ({ descricao: evento.descricao, tipo: evento.tipo, valor: numero(evento.valor), eventoId: evento.eventoId ?? undefined, incideInss: evento.incideInss, incideIrrf: evento.incideIrrf, deduzIrrf: evento.deduzIrrf, incideFgts: evento.incideFgts }));
      const calculo = calcularFolhaColaboradorRh({ salarioBase: numero(item.salarioBase), quantidadeDependentesIrrf: dependentes.filter((dependente) => dependente.colaboradorId === item.colaboradorId).length, adiantamentos: descontos.get(item.colaboradorId) ?? 0, eventos: eventosDoItem, regras: regrasVigentes });
      await db.update(itensFolhaPagamentoRh).set({ totalProventos: decimal(calculo.totalProventos), inss: decimal(calculo.inss), baseIrrf: decimal(calculo.baseIrrf), irrf: decimal(calculo.irrf), deducoesLegaisIrrf: decimal(calculo.deducoesLegaisIrrf), descontoSimplificadoIrrf: decimal(calculo.descontoSimplificadoIrrf), metodoDeducaoIrrf: calculo.metodoDeducaoIrrf, tabelaIrrfId: calculo.tabelaIrrfId, memoriaIrrf: JSON.stringify(calculo.memoriaIrrf), adiantamentos: decimal(calculo.adiantamentos), outrosDescontos: decimal(calculo.outrosDescontos), totalDescontos: decimal(calculo.totalDescontos), salarioLiquido: decimal(calculo.salarioLiquido), fgts: decimal(calculo.fgts), custoEmpresa: decimal(calculo.custoEmpresa) }).where(eq(itensFolhaPagamentoRh.id, item.id));
    }
    return { success: true };
  }),
  fechar: rhProcedure.input(z.object({ folhaId: idSchema, dataVencimento: dataSchema })).mutation(async ({ ctx, input }) => {
    const db = await bancoObrigatorio(); const empresaId = ctx.configuracaoEmpresa.id;
    const folha = await db.select().from(folhasPagamentoRh).where(and(eq(folhasPagamentoRh.id, input.folhaId), eq(folhasPagamentoRh.empresaId, empresaId))).limit(1);
    if (!folha[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Folha não encontrada." });
    if (folha[0].estado === "fechada") return { success: true, jaFechada: true };
    const categoriaId = await garantirCategoriaFolha(empresaId, ctx.user.id);
    const itens = await db.select().from(itensFolhaPagamentoRh).where(and(eq(itensFolhaPagamentoRh.empresaId, empresaId), eq(itensFolhaPagamentoRh.folhaId, input.folhaId)));
    const colaboradores = await db.select().from(colaboradoresRh).where(eq(colaboradoresRh.empresaId, empresaId));
    const competenciaFormatada = competenciaRh(folha[0].competencia).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" });
    for (const item of itens) {
      if (item.tituloFinanceiroId) continue;
      const colaborador = colaboradores.find((registro) => registro.id === item.colaboradorId);
      const chave = `RH-FOLHA-${folha[0].id}-${item.id}`;
      const titulo = await garantirTituloFinanceiroAutomatico({
        tipo: "pagar",
        origem: "folha_pagamento",
        chaveIdempotencia: chave,
        descricao: `Salário ${competenciaFormatada} — ${colaborador?.nome ?? "Colaborador"}`,
        contraparteNome: colaborador?.nome ?? null,
        categoriaId,
        centroCustoId: colaborador?.centroCustoId ?? null,
        valorOriginal: item.salarioLiquido,
        dataEmissao: new Date(),
        dataVencimento: dataLocal(input.dataVencimento),
        competencia: folha[0].competencia,
        criadoPor: ctx.user.id,
        database: db,
      });
      if (titulo.titulo?.estado === "cancelado") await db.update(titulosFinanceiros).set({ estado: "aberto", canceladoEm: null, canceladoPor: null, valorOriginal: item.salarioLiquido, dataVencimento: dataLocal(input.dataVencimento) }).where(eq(titulosFinanceiros.id, titulo.id));
      await db.update(itensFolhaPagamentoRh).set({ tituloFinanceiroId: titulo.id }).where(eq(itensFolhaPagamentoRh.id, item.id));
    }
    const valorEncargos = itens.reduce((soma, item) => soma + numero(item.fgts) + numero(item.inss) + numero(item.irrf), 0);
    let tituloEncargosId: number | null = null;
    if (valorEncargos > 0) {
      const chave = `RH-ENCARGOS-${folha[0].id}`;
      const titulo = await garantirTituloFinanceiroAutomatico({
        tipo: "pagar",
        origem: "folha_pagamento",
        chaveIdempotencia: chave,
        descricao: `Encargos da folha ${competenciaFormatada} — FGTS, INSS e IRRF`,
        categoriaId,
        valorOriginal: decimal(valorEncargos),
        dataEmissao: new Date(),
        dataVencimento: dataLocal(input.dataVencimento),
        competencia: folha[0].competencia,
        criadoPor: ctx.user.id,
        database: db,
      });
      tituloEncargosId = titulo.id;
      if (titulo.titulo?.estado === "cancelado") await db.update(titulosFinanceiros).set({ estado: "aberto", canceladoEm: null, canceladoPor: null, valorOriginal: decimal(valorEncargos), dataVencimento: dataLocal(input.dataVencimento) }).where(eq(titulosFinanceiros.id, titulo.id));
    }
    const adiantamentos = await db.select().from(adiantamentosRh).where(and(eq(adiantamentosRh.empresaId, empresaId), eq(adiantamentosRh.estado, "aberto")));
    const planos = await planosDosAdiantamentos(db, empresaId, adiantamentos.map((adiantamento) => adiantamento.id));
    const parcelasDaCompetencia = planos.filter((parcela) => parcela.estado === "pendente" && parcela.competencia.getTime() === folha[0].competencia.getTime());
    for (const parcela of parcelasDaCompetencia) await db.update(parcelasAdiantamentosRh).set({ estado: "descontada", folhaId: input.folhaId }).where(eq(parcelasAdiantamentosRh.id, parcela.id));
    const adiantamentosParcelados = Array.from(new Set(parcelasDaCompetencia.map((parcela) => parcela.adiantamentoId)));
    for (const adiantamentoId of adiantamentosParcelados) {
      const planoAtualizado = planos.filter((parcela) => parcela.adiantamentoId === adiantamentoId).map((parcela) => parcelasDaCompetencia.some((baixada) => baixada.id === parcela.id) ? { ...parcela, estado: "descontada" } : parcela);
      const situacao = situacaoAposBaixaParcelas(planoAtualizado);
      await db.update(adiantamentosRh).set(situacao).where(eq(adiantamentosRh.id, adiantamentoId));
    }
    for (const adiantamento of adiantamentos.filter((item) => !planos.some((parcela) => parcela.adiantamentoId === item.id) && item.competencia.getTime() === folha[0].competencia.getTime())) await db.update(adiantamentosRh).set({ saldoPendente: "0", estado: "descontado" }).where(eq(adiantamentosRh.id, adiantamento.id));
    await db.update(folhasPagamentoRh).set({ estado: "fechada", fechadaEm: new Date(), fechadaPor: ctx.user.id, tituloEncargosFinanceiroId: tituloEncargosId }).where(eq(folhasPagamentoRh.id, input.folhaId));
    return { success: true, jaFechada: false };
  }),
  reabrir: rhProcedure.input(z.object({ folhaId: idSchema, motivo: z.string().trim().min(5).max(2000) })).mutation(async ({ ctx, input }) => {
    const db = await bancoObrigatorio(); const empresaId = ctx.configuracaoEmpresa.id;
    const folha = await db.select().from(folhasPagamentoRh).where(and(eq(folhasPagamentoRh.id, input.folhaId), eq(folhasPagamentoRh.empresaId, empresaId))).limit(1);
    if (!folha[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Folha não encontrada." });
    if (folha[0].estado !== "fechada") throw new TRPCError({ code: "BAD_REQUEST", message: "A folha já está aberta." });
    const itens = await db.select().from(itensFolhaPagamentoRh).where(eq(itensFolhaPagamentoRh.folhaId, input.folhaId));
    let tituloEncargosId = folha[0].tituloEncargosFinanceiroId;
    if (!tituloEncargosId) tituloEncargosId = (await db.select().from(titulosFinanceiros).where(and(eq(titulosFinanceiros.empresaId, empresaId), eq(titulosFinanceiros.chaveImportacao, `RH-ENCARGOS-${folha[0].id}`))).limit(1))[0]?.id ?? null;
    const idsTitulos = [...itens.flatMap((item) => item.tituloFinanceiroId ? [item.tituloFinanceiroId] : []), ...(tituloEncargosId ? [tituloEncargosId] : [])];
    if (idsTitulos.length) {
      const titulos = await db.select().from(titulosFinanceiros).where(inArray(titulosFinanceiros.id, idsTitulos));
      if (titulos.some((titulo) => numero(titulo.valorBaixado) > 0 || titulo.estado === "quitado" || titulo.estado === "parcial")) throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível reabrir: há título financeiro da folha já baixado. Estorne ou desconcilie o título primeiro." });
      await db.update(titulosFinanceiros).set({ estado: "cancelado", canceladoEm: new Date(), canceladoPor: ctx.user.id }).where(inArray(titulosFinanceiros.id, titulos.map((titulo) => titulo.id)));
      await db.update(itensFolhaPagamentoRh).set({ tituloFinanceiroId: null }).where(eq(itensFolhaPagamentoRh.folhaId, input.folhaId));
    }
    const parcelasDaFolha = await db.select().from(parcelasAdiantamentosRh).where(and(eq(parcelasAdiantamentosRh.empresaId, empresaId), eq(parcelasAdiantamentosRh.folhaId, input.folhaId), eq(parcelasAdiantamentosRh.estado, "descontada")));
    for (const parcela of parcelasDaFolha) await db.update(parcelasAdiantamentosRh).set({ estado: "pendente", folhaId: null }).where(eq(parcelasAdiantamentosRh.id, parcela.id));
    const adiantamentosParcelados = Array.from(new Set(parcelasDaFolha.map((parcela) => parcela.adiantamentoId)));
    const planosReabertos = await planosDosAdiantamentos(db, empresaId, adiantamentosParcelados);
    for (const adiantamentoId of adiantamentosParcelados) await db.update(adiantamentosRh).set(situacaoAposBaixaParcelas(planosReabertos.filter((parcela) => parcela.adiantamentoId === adiantamentoId))).where(eq(adiantamentosRh.id, adiantamentoId));
    const adiantamentosLegados = await db.select().from(adiantamentosRh).where(and(eq(adiantamentosRh.empresaId, empresaId), eq(adiantamentosRh.competencia, folha[0].competencia), eq(adiantamentosRh.estado, "descontado")));
    const planosLegados = await planosDosAdiantamentos(db, empresaId, adiantamentosLegados.map((adiantamento) => adiantamento.id));
    for (const adiantamento of adiantamentosLegados.filter((item) => !planosLegados.some((parcela) => parcela.adiantamentoId === item.id))) await db.update(adiantamentosRh).set({ saldoPendente: adiantamento.valor, estado: "aberto" }).where(eq(adiantamentosRh.id, adiantamento.id));
    await db.update(folhasPagamentoRh).set({ estado: "aberta", reabertaEm: new Date(), reabertaPor: ctx.user.id, motivoReabertura: input.motivo, tituloEncargosFinanceiroId: null }).where(eq(folhasPagamentoRh.id, input.folhaId));
    return { success: true };
  }),
};
