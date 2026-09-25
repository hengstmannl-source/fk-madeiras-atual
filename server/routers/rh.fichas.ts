import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  adiantamentosRh,
  auditoriasRh,
  baixasFinanceiras,
  categoriasFinanceiras,
  categoriasLancamentosRh,
  colaboradoresRh,
  competenciasFinanceirasRh,
  configuracoesCustosRh,
  custosColaboradorRh,
  custosEmpresaRh,
  encargosGerenciaisRh,
  lancamentosColaboradoresRh,
  salariosCompetenciasRh,
  titulosFinanceiros,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { calcularCustoColaboradorGerencialRh, type ConfiguracaoCustosGerenciaisRh, type RegraCustoGerencialRh } from "../rh.gestao.logic";
import { protectedProcedure, router } from "../_core/trpc";
import { garantirTituloFinanceiroComChave } from "../repositories/financeiro";

const idSchema = z.number().int().positive();
const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida");
const competenciaSchema = z.string().regex(/^\d{4}-\d{2}$/, "Informe uma competência válida");
const valorPositivoSchema = z.union([z.string(), z.number()]).transform((valor) => String(valor).replace(",", ".")).refine((valor) => Number.isFinite(Number(valor)) && Number(valor) > 0, "Informe um valor positivo");
const valorNaoNegativoSchema = z.union([z.string(), z.number()]).transform((valor) => String(valor).replace(",", ".")).refine((valor) => Number.isFinite(Number(valor)) && Number(valor) >= 0, "Informe um valor válido");

function numero(valor: unknown) { return Number(valor ?? 0); }
function decimal(valor: string | number) { return Number(valor).toFixed(2); }
function dataLocal(valor: string) { const [ano, mes, dia] = valor.split("-").map(Number); return new Date(ano, mes - 1, dia, 12, 0, 0); }
function dataCompetencia(valor: string) { return dataLocal(`${valor}-01`); }
function textoNulo(valor?: string | null) { const texto = valor?.trim(); return texto || null; }
function competenciaFormato(data: Date) { return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`; }

async function bancoObrigatorio() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "A base de dados não está disponível." });
  return db;
}

async function auditar(empresaId: number, usuarioId: number, entidade: string, entidadeId: number, acao: string, detalhes?: object) {
  const db = await bancoObrigatorio();
  await db.insert(auditoriasRh).values({ empresaId, usuarioId, entidade, entidadeId, acao, detalhes: detalhes ? JSON.stringify(detalhes) : null });
}

async function garantirColaborador(db: Awaited<ReturnType<typeof bancoObrigatorio>>, empresaId: number, colaboradorId: number) {
  const [colaborador] = await db.select().from(colaboradoresRh).where(and(eq(colaboradoresRh.id, colaboradorId), eq(colaboradoresRh.empresaId, empresaId))).limit(1);
  if (!colaborador) throw new TRPCError({ code: "NOT_FOUND", message: "Colaborador não encontrado." });
  return colaborador;
}

async function competenciaAberta(db: Awaited<ReturnType<typeof bancoObrigatorio>>, empresaId: number, competencia: Date) {
  const [registro] = await db.select().from(competenciasFinanceirasRh).where(and(eq(competenciasFinanceirasRh.empresaId, empresaId), eq(competenciasFinanceirasRh.competencia, competencia))).limit(1);
  if (registro?.estado === "fechada") throw new TRPCError({ code: "BAD_REQUEST", message: `A competência ${competenciaFormato(competencia)} está fechada. Reabra-a antes de alterar lançamentos.` });
  return registro ?? null;
}

async function garantirCategoriaFinanceiraRh(db: Awaited<ReturnType<typeof bancoObrigatorio>>, empresaId: number, usuarioId: number) {
  const [existente] = await db.select().from(categoriasFinanceiras).where(and(eq(categoriasFinanceiras.empresaId, empresaId), eq(categoriasFinanceiras.nome, "Pagamentos a colaboradores"))).limit(1);
  if (existente) return existente.id;
  const resultado = await db.insert(categoriasFinanceiras).values({ empresaId, nome: "Pagamentos a colaboradores", tipo: "despesa", ativo: true, criadoPor: usuarioId });
  return Number(resultado[0].insertId);
}

function regraCusto(custo: { id: number; descricao: string; tipo: "fixo" | "percentual"; valor: string | number; recorrente: boolean; descontarDoLiquido?: boolean; ativo: boolean; dataInicio: Date; dataFim: Date | null }): RegraCustoGerencialRh {
  return { id: custo.id, descricao: custo.descricao, tipo: custo.tipo, valor: numero(custo.valor), recorrente: custo.recorrente, descontarDoLiquido: custo.descontarDoLiquido ?? false, ativo: custo.ativo, dataInicio: custo.dataInicio, dataFim: custo.dataFim };
}

function configuracaoGerencial(item?: typeof configuracoesCustosRh.$inferSelect): ConfiguracaoCustosGerenciaisRh {
  return {
    fgtsPercentual: numero(item?.fgtsPercentual ?? 8),
    descontoInssEstimadoAtivo: item?.descontoInssEstimadoAtivo ?? false,
    provisaoDecimoTerceiroAtiva: item?.provisaoDecimoTerceiroAtiva ?? true,
    provisaoFeriasAtiva: item?.provisaoFeriasAtiva ?? true,
    provisaoTercoFeriasAtiva: item?.provisaoTercoFeriasAtiva ?? true,
  };
}

export function resumoLancamentos(lancamentos: Array<{ tipo: "credito" | "debito" | "pagamento"; valor: string | number; estado: "pendente" | "liquidado" | "cancelado" }>) {
  return lancamentos.filter((item) => item.estado !== "cancelado").reduce((acumulado, item) => {
    const valor = numero(item.valor);
    if (item.tipo === "credito") acumulado.creditos += valor;
    if (item.tipo === "debito") acumulado.debitos += valor;
    if (item.tipo === "pagamento") acumulado.pagamentos += valor;
    return acumulado;
  }, { creditos: 0, debitos: 0, pagamentos: 0 });
}

/** Extrato cronológico para exibição: cancelamentos permanecem visíveis, mas não alteram o saldo. */
export function calcularExtratoComSaldo<T extends { tipo: "credito" | "debito" | "pagamento"; valor: string | number; estado: "pendente" | "liquidado" | "cancelado"; dataLancamento: Date; id: number }>(lancamentos: T[]) {
  let saldo = 0;
  return [...lancamentos]
    .sort((a, b) => a.dataLancamento.getTime() - b.dataLancamento.getTime() || a.id - b.id)
    .map((item) => {
      if (item.estado !== "cancelado") {
        const valor = numero(item.valor);
        saldo += item.tipo === "credito" ? valor : -valor;
      }
      return { ...item, saldoAcumulado: Math.round(saldo * 100) / 100 };
    });
}

const categoriaSchema = z.object({ nome: z.string().trim().min(2).max(160), tipo: z.enum(["credito", "debito", "ambos"]).default("ambos"), ativo: z.boolean().default(true) });
const encargoSchema = z.object({ nome: z.string().trim().min(2).max(160), tipo: z.enum(["fixo", "percentual"]), valor: valorNaoNegativoSchema, baseCalculo: z.literal("salario_bruto").default("salario_bruto"), ativo: z.boolean().default(true) });
const lancamentoSchema = z.object({ colaboradorId: idSchema, categoriaId: idSchema.nullable().optional(), tipo: z.enum(["credito", "debito", "pagamento"]), competencia: competenciaSchema, dataLancamento: dataSchema, descricao: z.string().trim().min(2).max(300), valor: valorPositivoSchema, observacoes: z.string().trim().max(4000).nullable().optional(), gerarFinanceiro: z.boolean().default(false) });

export const fichasFinanceirasRh = router({
  configuracoes: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const db = await bancoObrigatorio();
      const [item] = await db.select().from(configuracoesCustosRh).where(eq(configuracoesCustosRh.empresaId, ctx.configuracaoEmpresa.id)).limit(1);
      return item ?? {
        fgtsPercentual: "8",
        inssPatronalPercentual: "20",
        inssPatronalEstimadoAtivo: true,
        descontoInssEstimadoAtivo: false,
        provisaoDecimoTerceiroAtiva: true,
        provisaoFeriasAtiva: true,
        provisaoTercoFeriasAtiva: true,
        observacoes: null,
      };
    }),
    update: protectedProcedure.input(z.object({
      fgtsPercentual: valorNaoNegativoSchema,
      inssPatronalPercentual: valorNaoNegativoSchema,
      inssPatronalEstimadoAtivo: z.boolean(),
      descontoInssEstimadoAtivo: z.boolean(),
      provisaoDecimoTerceiroAtiva: z.boolean(),
      provisaoFeriasAtiva: z.boolean(),
      provisaoTercoFeriasAtiva: z.boolean(),
      observacoes: z.string().trim().max(3000).nullable().optional(),
    })).mutation(async ({ ctx, input }) => {
      const db = await bancoObrigatorio();
      const empresaId = ctx.configuracaoEmpresa.id;
      const valores = {
        fgtsPercentual: Number(input.fgtsPercentual).toFixed(4),
        inssPatronalPercentual: Number(input.inssPatronalPercentual).toFixed(4),
        inssPatronalEstimadoAtivo: input.inssPatronalEstimadoAtivo,
        descontoInssEstimadoAtivo: input.descontoInssEstimadoAtivo,
        provisaoDecimoTerceiroAtiva: input.provisaoDecimoTerceiroAtiva,
        provisaoFeriasAtiva: input.provisaoFeriasAtiva,
        provisaoTercoFeriasAtiva: input.provisaoTercoFeriasAtiva,
        observacoes: textoNulo(input.observacoes),
      };
      const [existente] = await db.select().from(configuracoesCustosRh).where(eq(configuracoesCustosRh.empresaId, empresaId)).limit(1);
      if (existente) await db.update(configuracoesCustosRh).set(valores).where(eq(configuracoesCustosRh.id, existente.id));
      else await db.insert(configuracoesCustosRh).values({ empresaId, ...valores, criadoPor: ctx.user.id });
      await auditar(empresaId, ctx.user.id, "configuracao_encargos", existente?.id ?? 0, "atualizada", { fgtsPercentual: valores.fgtsPercentual, inssPatronalPercentual: valores.inssPatronalPercentual });
      return { success: true };
    }),
  }),
  categorias: router({
    list: protectedProcedure.query(async ({ ctx }) => { const db = await bancoObrigatorio(); return db.select().from(categoriasLancamentosRh).where(eq(categoriasLancamentosRh.empresaId, ctx.configuracaoEmpresa.id)).orderBy(desc(categoriasLancamentosRh.ativo), asc(categoriasLancamentosRh.nome)); }),
    create: protectedProcedure.input(categoriaSchema).mutation(async ({ ctx, input }) => { const db = await bancoObrigatorio(); const resultado = await db.insert(categoriasLancamentosRh).values({ ...input, empresaId: ctx.configuracaoEmpresa.id, criadoPor: ctx.user.id }); const id = Number(resultado[0].insertId); await auditar(ctx.configuracaoEmpresa.id, ctx.user.id, "categoria_ficha", id, "criada"); return { id }; }),
    update: protectedProcedure.input(categoriaSchema.partial().extend({ id: idSchema })).mutation(async ({ ctx, input }) => { const db = await bancoObrigatorio(); const { id, ...dados } = input; await db.update(categoriasLancamentosRh).set(dados).where(and(eq(categoriasLancamentosRh.id, id), eq(categoriasLancamentosRh.empresaId, ctx.configuracaoEmpresa.id))); await auditar(ctx.configuracaoEmpresa.id, ctx.user.id, "categoria_ficha", id, "atualizada"); return { success: true }; }),
  }),
  lancamentos: router({
    list: protectedProcedure.input(z.object({ colaboradorId: idSchema.optional(), competencia: competenciaSchema.optional(), tipo: z.enum(["credito", "debito", "pagamento"]).optional(), estado: z.enum(["pendente", "liquidado", "cancelado", "todos"]).optional() }).optional()).query(async ({ ctx, input }) => {
      const db = await bancoObrigatorio(); const empresaId = ctx.configuracaoEmpresa.id; const condicoes = [eq(lancamentosColaboradoresRh.empresaId, empresaId)];
      if (input?.colaboradorId) condicoes.push(eq(lancamentosColaboradoresRh.colaboradorId, input.colaboradorId));
      if (input?.competencia) condicoes.push(eq(lancamentosColaboradoresRh.competencia, dataCompetencia(input.competencia)));
      if (input?.tipo) condicoes.push(eq(lancamentosColaboradoresRh.tipo, input.tipo));
      if (input?.estado && input.estado !== "todos") condicoes.push(eq(lancamentosColaboradoresRh.estado, input.estado));
      const itens = await db.select().from(lancamentosColaboradoresRh).where(and(...condicoes)).orderBy(desc(lancamentosColaboradoresRh.dataLancamento), desc(lancamentosColaboradoresRh.id));
      const [colaboradores, categorias, titulos] = await Promise.all([
        db.select().from(colaboradoresRh).where(eq(colaboradoresRh.empresaId, empresaId)),
        db.select().from(categoriasLancamentosRh).where(eq(categoriasLancamentosRh.empresaId, empresaId)),
        itens.some((item) => item.tituloFinanceiroId) ? db.select().from(titulosFinanceiros).where(and(eq(titulosFinanceiros.empresaId, empresaId), inArray(titulosFinanceiros.id, itens.flatMap((item) => item.tituloFinanceiroId ? [item.tituloFinanceiroId] : [])))) : Promise.resolve([]),
      ]);
      const linhas = itens.map((item) => ({ ...item, colaboradorNome: colaboradores.find((colaborador) => colaborador.id === item.colaboradorId)?.nome ?? "Colaborador removido", categoriaNome: item.categoriaId ? categorias.find((categoria) => categoria.id === item.categoriaId)?.nome ?? "Categoria removida" : "Sem categoria", tituloFinanceiro: item.tituloFinanceiroId ? titulos.find((titulo) => titulo.id === item.tituloFinanceiroId) ?? null : null }));
      const resumo = resumoLancamentos(linhas); return { itens: linhas, resumo: { ...resumo, saldo: resumo.creditos - resumo.debitos - resumo.pagamentos } };
    }),
    criar: protectedProcedure.input(lancamentoSchema).mutation(async ({ ctx, input }) => {
      const db = await bancoObrigatorio(); const empresaId = ctx.configuracaoEmpresa.id; const competencia = dataCompetencia(input.competencia); await competenciaAberta(db, empresaId, competencia); const colaborador = await garantirColaborador(db, empresaId, input.colaboradorId);
      if (input.categoriaId) { const [categoria] = await db.select().from(categoriasLancamentosRh).where(and(eq(categoriasLancamentosRh.id, input.categoriaId), eq(categoriasLancamentosRh.empresaId, empresaId), eq(categoriasLancamentosRh.ativo, true))).limit(1); if (!categoria) throw new TRPCError({ code: "NOT_FOUND", message: "Categoria de lançamento não encontrada ou inativa." }); if (categoria.tipo !== "ambos" && categoria.tipo !== input.tipo && input.tipo !== "pagamento") throw new TRPCError({ code: "BAD_REQUEST", message: "A categoria selecionada não é compatível com este tipo de lançamento." }); }
      const criado = await db.insert(lancamentosColaboradoresRh).values({ empresaId, colaboradorId: input.colaboradorId, categoriaId: input.categoriaId ?? null, tipo: input.tipo, competencia, dataLancamento: dataLocal(input.dataLancamento), descricao: input.descricao, valor: decimal(input.valor), observacoes: textoNulo(input.observacoes), criadoPor: ctx.user.id, estado: input.tipo === "pagamento" && !input.gerarFinanceiro ? "liquidado" : "pendente" });
      const id = Number(criado[0].insertId); let tituloFinanceiroId: number | null = null;
      if (input.gerarFinanceiro) {
        const categoriaId = await garantirCategoriaFinanceiraRh(db, empresaId, ctx.user.id);
        const titulo = await garantirTituloFinanceiroComChave({
          tipo: "pagar",
          origem: "manual",
          chaveIdempotencia: `RH-FICHA-${id}`,
          descricao: `Pagamento de colaborador — ${colaborador.nome}: ${input.descricao}`,
          contraparteNome: colaborador.nome,
          categoriaId,
          centroCustoId: colaborador.centroCustoId ?? null,
          valorOriginal: decimal(input.valor),
          dataEmissao: dataLocal(input.dataLancamento),
          dataVencimento: dataLocal(input.dataLancamento),
          competencia,
          observacoes: textoNulo(input.observacoes),
          criadoPor: ctx.user.id,
          database: db,
        });
        tituloFinanceiroId = titulo.id;
        await db.update(lancamentosColaboradoresRh).set({ tituloFinanceiroId }).where(eq(lancamentosColaboradoresRh.id, id));
      }
      await auditar(empresaId, ctx.user.id, "lancamento_ficha", id, "criado", { tipo: input.tipo, colaboradorId: input.colaboradorId, gerarFinanceiro: input.gerarFinanceiro }); return { id, tituloFinanceiroId };
    }),
    cancelar: protectedProcedure.input(z.object({ id: idSchema, motivo: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => {
      const db = await bancoObrigatorio(); const empresaId = ctx.configuracaoEmpresa.id; const [lancamento] = await db.select().from(lancamentosColaboradoresRh).where(and(eq(lancamentosColaboradoresRh.id, input.id), eq(lancamentosColaboradoresRh.empresaId, empresaId))).limit(1);
      if (!lancamento) throw new TRPCError({ code: "NOT_FOUND", message: "Lançamento não encontrado." }); if (lancamento.estado === "cancelado") return { success: true, jaCancelado: true }; await competenciaAberta(db, empresaId, lancamento.competencia);
      if (lancamento.tituloFinanceiroId) { const [[titulo], baixas] = await Promise.all([db.select().from(titulosFinanceiros).where(and(eq(titulosFinanceiros.id, lancamento.tituloFinanceiroId), eq(titulosFinanceiros.empresaId, empresaId))).limit(1), db.select().from(baixasFinanceiras).where(and(eq(baixasFinanceiras.tituloId, lancamento.tituloFinanceiroId), eq(baixasFinanceiras.empresaId, empresaId), eq(baixasFinanceiras.estornada, false)))]); if (!titulo || titulo.estado === "quitado" || baixas.length) throw new TRPCError({ code: "BAD_REQUEST", message: "O lançamento não pode ser cancelado porque o título financeiro já possui baixa ou foi quitado. Estorne e desconcilie o título no Financeiro antes de continuar." }); await db.update(titulosFinanceiros).set({ estado: "cancelado", canceladoEm: new Date(), canceladoPor: ctx.user.id, observacoes: [titulo.observacoes, `Cancelado pela ficha RH: ${input.motivo}`].filter(Boolean).join("\n") }).where(eq(titulosFinanceiros.id, titulo.id)); }
      await db.update(lancamentosColaboradoresRh).set({ estado: "cancelado", canceladoEm: new Date(), canceladoPor: ctx.user.id, motivoCancelamento: input.motivo }).where(eq(lancamentosColaboradoresRh.id, input.id)); await auditar(empresaId, ctx.user.id, "lancamento_ficha", input.id, "cancelado", { motivo: input.motivo }); return { success: true };
    }),
  }),
  ficha: router({
    detalhe: protectedProcedure.input(z.object({ colaboradorId: idSchema, competencia: competenciaSchema.optional() })).query(async ({ ctx, input }) => {
      const db = await bancoObrigatorio(); const empresaId = ctx.configuracaoEmpresa.id; const colaborador = await garantirColaborador(db, empresaId, input.colaboradorId); const condicoes = [eq(lancamentosColaboradoresRh.empresaId, empresaId), eq(lancamentosColaboradoresRh.colaboradorId, input.colaboradorId)]; if (input.competencia) condicoes.push(eq(lancamentosColaboradoresRh.competencia, dataCompetencia(input.competencia)));
      const itens = await db.select().from(lancamentosColaboradoresRh).where(and(...condicoes)).orderBy(desc(lancamentosColaboradoresRh.dataLancamento), desc(lancamentosColaboradoresRh.id)); const categorias = await db.select().from(categoriasLancamentosRh).where(eq(categoriasLancamentosRh.empresaId, empresaId)); const resumo = resumoLancamentos(itens); return { colaborador, itens: itens.map((item) => ({ ...item, categoriaNome: item.categoriaId ? categorias.find((categoria) => categoria.id === item.categoriaId)?.nome ?? "Categoria removida" : "Sem categoria" })), resumo: { ...resumo, saldo: resumo.creditos - resumo.debitos - resumo.pagamentos } };
    }),
  }),
  competencias: router({
    list: protectedProcedure.query(async ({ ctx }) => { const db = await bancoObrigatorio(); return db.select().from(competenciasFinanceirasRh).where(eq(competenciasFinanceirasRh.empresaId, ctx.configuracaoEmpresa.id)).orderBy(desc(competenciasFinanceirasRh.competencia)); }),
    abrir: protectedProcedure.input(z.object({ competencia: competenciaSchema, observacoes: z.string().trim().max(4000).nullable().optional() })).mutation(async ({ ctx, input }) => { const db = await bancoObrigatorio(); const empresaId = ctx.configuracaoEmpresa.id; const competencia = dataCompetencia(input.competencia); const [existente] = await db.select().from(competenciasFinanceirasRh).where(and(eq(competenciasFinanceirasRh.empresaId, empresaId), eq(competenciasFinanceirasRh.competencia, competencia))).limit(1); if (existente) return { id: existente.id, existente: true, estado: existente.estado }; const resultado = await db.insert(competenciasFinanceirasRh).values({ empresaId, competencia, observacoes: textoNulo(input.observacoes), criadoPor: ctx.user.id }); const id = Number(resultado[0].insertId); await auditar(empresaId, ctx.user.id, "competencia_financeira", id, "aberta", { competencia: input.competencia }); return { id, existente: false, estado: "aberta" as const }; }),
    fechar: protectedProcedure.input(z.object({ id: idSchema })).mutation(async ({ ctx, input }) => { const db = await bancoObrigatorio(); const empresaId = ctx.configuracaoEmpresa.id; const [competencia] = await db.select().from(competenciasFinanceirasRh).where(and(eq(competenciasFinanceirasRh.id, input.id), eq(competenciasFinanceirasRh.empresaId, empresaId))).limit(1); if (!competencia) throw new TRPCError({ code: "NOT_FOUND", message: "Competência não encontrada." }); if (competencia.estado === "fechada") return { success: true, jaFechada: true }; await db.update(competenciasFinanceirasRh).set({ estado: "fechada", fechadaEm: new Date(), fechadaPor: ctx.user.id }).where(eq(competenciasFinanceirasRh.id, input.id)); await auditar(empresaId, ctx.user.id, "competencia_financeira", input.id, "fechada"); return { success: true, jaFechada: false }; }),
    reabrir: protectedProcedure.input(z.object({ id: idSchema, motivo: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => { const db = await bancoObrigatorio(); const empresaId = ctx.configuracaoEmpresa.id; const [competencia] = await db.select().from(competenciasFinanceirasRh).where(and(eq(competenciasFinanceirasRh.id, input.id), eq(competenciasFinanceirasRh.empresaId, empresaId))).limit(1); if (!competencia) throw new TRPCError({ code: "NOT_FOUND", message: "Competência não encontrada." }); await db.update(competenciasFinanceirasRh).set({ estado: "aberta", reabertaEm: new Date(), reabertaPor: ctx.user.id, motivoReabertura: input.motivo }).where(eq(competenciasFinanceirasRh.id, input.id)); await auditar(empresaId, ctx.user.id, "competencia_financeira", input.id, "reaberta", { motivo: input.motivo }); return { success: true }; }),
    gerarSalarios: protectedProcedure.input(z.object({ competenciaId: idSchema })).mutation(async ({ ctx, input }) => {
      const db = await bancoObrigatorio(); const empresaId = ctx.configuracaoEmpresa.id; const [competencia, configuracaoExistente, colaboradores, custosEmpresa, custosIndividuais, encargos] = await Promise.all([
        db.select().from(competenciasFinanceirasRh).where(and(eq(competenciasFinanceirasRh.id, input.competenciaId), eq(competenciasFinanceirasRh.empresaId, empresaId))).limit(1),
        db.select().from(configuracoesCustosRh).where(eq(configuracoesCustosRh.empresaId, empresaId)).limit(1),
        db.select().from(colaboradoresRh).where(and(eq(colaboradoresRh.empresaId, empresaId), eq(colaboradoresRh.situacao, "ativo"))),
        db.select().from(custosEmpresaRh).where(and(eq(custosEmpresaRh.empresaId, empresaId), eq(custosEmpresaRh.ativo, true))),
        db.select().from(custosColaboradorRh).where(and(eq(custosColaboradorRh.empresaId, empresaId), eq(custosColaboradorRh.ativo, true))),
        db.select().from(encargosGerenciaisRh).where(and(eq(encargosGerenciaisRh.empresaId, empresaId), eq(encargosGerenciaisRh.ativo, true))),
      ]);
      if (!competencia[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Competência não encontrada." }); if (competencia[0].estado === "fechada") throw new TRPCError({ code: "BAD_REQUEST", message: "Reabra a competência antes de regenerar salários e encargos." }); const configuracao = configuracaoGerencial(configuracaoExistente[0]); const referencia = competencia[0].competencia;
      for (const colaborador of colaboradores) { const custos = [...custosEmpresa.filter((item) => item.escopo === "por_colaborador").map(regraCusto), ...custosIndividuais.filter((item) => item.colaboradorId === colaborador.id).map(regraCusto)]; const calculo = calcularCustoColaboradorGerencialRh({ salarioBruto: numero(colaborador.salarioAtual), configuracao, custos, referencia, faixasInss: [] }); const outrosEncargos = encargos.reduce((soma, encargo) => soma + (encargo.tipo === "percentual" ? numero(colaborador.salarioAtual) * numero(encargo.valor) / 100 : numero(encargo.valor)), 0); const inssPatronal = configuracaoExistente[0]?.inssPatronalEstimadoAtivo === false ? 0 : numero(colaborador.salarioAtual) * numero(configuracaoExistente[0]?.inssPatronalPercentual ?? 20) / 100; const custoMensal = numero(calculo.custoMensalEstimado) + outrosEncargos + inssPatronal; const valores = { salarioBruto: decimal(colaborador.salarioAtual), fgtsEstimado: decimal(calculo.fgtsEstimado), inssPatronalEstimado: decimal(inssPatronal), outrosEncargosEstimados: decimal(outrosEncargos), provisaoDecimoTerceiro: decimal(calculo.provisaoDecimoTerceiro), provisaoFerias: decimal(calculo.provisaoFerias), provisaoTercoFerias: decimal(calculo.provisaoTercoFerias), beneficios: decimal(calculo.beneficiosECustos), custoMensalEstimado: decimal(custoMensal) }; const [existente] = await db.select().from(salariosCompetenciasRh).where(and(eq(salariosCompetenciasRh.empresaId, empresaId), eq(salariosCompetenciasRh.competenciaId, competencia[0].id), eq(salariosCompetenciasRh.colaboradorId, colaborador.id))).limit(1); if (existente) await db.update(salariosCompetenciasRh).set(valores).where(eq(salariosCompetenciasRh.id, existente.id)); else await db.insert(salariosCompetenciasRh).values({ empresaId, competenciaId: competencia[0].id, colaboradorId: colaborador.id, ...valores, criadoPor: ctx.user.id }); }
      await auditar(empresaId, ctx.user.id, "competencia_financeira", competencia[0].id, "salarios_gerados", { colaboradores: colaboradores.length }); return { colaboradores: colaboradores.length };
    }),
    salarios: protectedProcedure.input(z.object({ competenciaId: idSchema })).query(async ({ ctx, input }) => { const db = await bancoObrigatorio(); const empresaId = ctx.configuracaoEmpresa.id; const [linhas, colaboradores] = await Promise.all([db.select().from(salariosCompetenciasRh).where(and(eq(salariosCompetenciasRh.empresaId, empresaId), eq(salariosCompetenciasRh.competenciaId, input.competenciaId))), db.select().from(colaboradoresRh).where(eq(colaboradoresRh.empresaId, empresaId))]); const totais = linhas.reduce((soma, linha) => ({ salarioBruto: soma.salarioBruto + numero(linha.salarioBruto), fgts: soma.fgts + numero(linha.fgtsEstimado), inssPatronal: soma.inssPatronal + numero(linha.inssPatronalEstimado), outrosEncargos: soma.outrosEncargos + numero(linha.outrosEncargosEstimados), provisoes: soma.provisoes + numero(linha.provisaoDecimoTerceiro) + numero(linha.provisaoFerias) + numero(linha.provisaoTercoFerias), custoMensal: soma.custoMensal + numero(linha.custoMensalEstimado) }), { salarioBruto: 0, fgts: 0, inssPatronal: 0, outrosEncargos: 0, provisoes: 0, custoMensal: 0 }); return { linhas: linhas.map((linha) => ({ ...linha, colaboradorNome: colaboradores.find((colaborador) => colaborador.id === linha.colaboradorId)?.nome ?? "Colaborador removido" })), totais }; }),
  }),
  encargos: router({
    list: protectedProcedure.query(async ({ ctx }) => { const db = await bancoObrigatorio(); return db.select().from(encargosGerenciaisRh).where(eq(encargosGerenciaisRh.empresaId, ctx.configuracaoEmpresa.id)).orderBy(desc(encargosGerenciaisRh.ativo), asc(encargosGerenciaisRh.nome)); }),
    create: protectedProcedure.input(encargoSchema).mutation(async ({ ctx, input }) => { const db = await bancoObrigatorio(); const resultado = await db.insert(encargosGerenciaisRh).values({ ...input, valor: Number(input.valor).toFixed(4), empresaId: ctx.configuracaoEmpresa.id, criadoPor: ctx.user.id }); const id = Number(resultado[0].insertId); await auditar(ctx.configuracaoEmpresa.id, ctx.user.id, "encargo_gerencial", id, "criado"); return { id }; }),
    update: protectedProcedure.input(encargoSchema.partial().extend({ id: idSchema })).mutation(async ({ ctx, input }) => { const db = await bancoObrigatorio(); const { id, valor, ...dados } = input; await db.update(encargosGerenciaisRh).set({ ...dados, ...(valor === undefined ? {} : { valor: Number(valor).toFixed(4) }) }).where(and(eq(encargosGerenciaisRh.id, id), eq(encargosGerenciaisRh.empresaId, ctx.configuracaoEmpresa.id))); await auditar(ctx.configuracaoEmpresa.id, ctx.user.id, "encargo_gerencial", id, "atualizado"); return { success: true }; }),
  }),
  painel: protectedProcedure.input(z.object({ competencia: competenciaSchema.optional() }).optional()).query(async ({ ctx, input }) => { const db = await bancoObrigatorio(); const empresaId = ctx.configuracaoEmpresa.id; const competencia = input?.competencia ? dataCompetencia(input.competencia) : null; const condicoes = [eq(lancamentosColaboradoresRh.empresaId, empresaId)]; if (competencia) condicoes.push(eq(lancamentosColaboradoresRh.competencia, competencia)); const [lancamentos, colaboradores, competencias] = await Promise.all([db.select().from(lancamentosColaboradoresRh).where(and(...condicoes)), db.select().from(colaboradoresRh).where(and(eq(colaboradoresRh.empresaId, empresaId), eq(colaboradoresRh.situacao, "ativo"))), db.select().from(competenciasFinanceirasRh).where(eq(competenciasFinanceirasRh.empresaId, empresaId)).orderBy(desc(competenciasFinanceirasRh.competencia))]); const resumo = resumoLancamentos(lancamentos); const saldo = resumo.creditos - resumo.debitos - resumo.pagamentos; const porColaborador = new Map<number, Array<typeof lancamentos[number]>>(); for (const lancamento of lancamentos) porColaborador.set(lancamento.colaboradorId, [...(porColaborador.get(lancamento.colaboradorId) ?? []), lancamento]); const colaboradoresComSaldo = colaboradores.map((colaborador) => { const valores = resumoLancamentos(porColaborador.get(colaborador.id) ?? []); return { ...colaborador, resumo: { ...valores, saldo: valores.creditos - valores.debitos - valores.pagamentos } }; }).filter((item) => item.resumo.saldo !== 0); return { resumo: { ...resumo, saldo }, colaboradoresComSaldo, competencias }; }),
  migracao: router({
    importarSaldosAdiantamentos: protectedProcedure.input(z.object({ competencia: competenciaSchema })).mutation(async ({ ctx, input }) => { const db = await bancoObrigatorio(); const empresaId = ctx.configuracaoEmpresa.id; const competencia = dataCompetencia(input.competencia); await competenciaAberta(db, empresaId, competencia); const abertos = await db.select().from(adiantamentosRh).where(and(eq(adiantamentosRh.empresaId, empresaId), eq(adiantamentosRh.estado, "aberto"))); let criados = 0; for (const adiantamento of abertos) { if (numero(adiantamento.saldoPendente) <= 0) continue; const descricao = `Saldo migrado de adiantamento #${adiantamento.id}`; const [existente] = await db.select().from(lancamentosColaboradoresRh).where(and(eq(lancamentosColaboradoresRh.empresaId, empresaId), eq(lancamentosColaboradoresRh.descricao, descricao), eq(lancamentosColaboradoresRh.origem, "migracao"))).limit(1); if (existente) continue; await db.insert(lancamentosColaboradoresRh).values({ empresaId, colaboradorId: adiantamento.colaboradorId, tipo: "debito", origem: "migracao", competencia, dataLancamento: new Date(), descricao, valor: decimal(adiantamento.saldoPendente), observacoes: "Saldo preservado da estrutura anterior de adiantamentos.", criadoPor: ctx.user.id }); criados += 1; } await auditar(empresaId, ctx.user.id, "migracao_ficha", 0, "adiantamentos_importados", { criados, competencia: input.competencia }); return { criados }; }),
  }),
});
