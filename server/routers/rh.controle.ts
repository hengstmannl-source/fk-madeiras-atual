import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  adiantamentosRh,
  auditoriasRh,
  cargosRh,
  categoriasFinanceiras,
  colaboradoresRh,
  competenciasFinanceirasRh,
  departamentosRh,
} from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { garantirTituloFinanceiroComChave } from "../repositories/financeiro";
import {
  calcularResumoRhSimplificado,
  chaveCompetenciaRhSimplificado,
  validarLimiteAdiantamentoRhSimplificado,
  validarFechamentoRhSimplificado,
} from "../rh.simplificado.logic";

const idSchema = z.number().int().positive();
const competenciaSchema = z.string().regex(/^\d{4}-\d{2}$/, "Informe uma competência válida");
const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida");
const valorPositivoSchema = z.union([z.string(), z.number()])
  .transform((valor) => String(valor).replace(",", "."))
  .refine((valor) => Number.isFinite(Number(valor)) && Number(valor) > 0, "Informe um valor positivo");

function dataLocal(valor: string) {
  const [ano, mes, dia] = valor.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
}

function competenciaData(valor: string) {
  return dataLocal(`${valor}-01`);
}

function decimal(valor: string | number) {
  return Number(valor).toFixed(2);
}

function textoNulo(valor?: string | null) {
  const texto = valor?.trim();
  return texto || null;
}

async function bancoObrigatorio() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "A base de dados não está disponível." });
  return db;
}

async function auditar(empresaId: number, usuarioId: number, entidade: string, entidadeId: number, acao: string, detalhes?: object) {
  const db = await bancoObrigatorio();
  await db.insert(auditoriasRh).values({ empresaId, usuarioId, entidade, entidadeId, acao, detalhes: detalhes ? JSON.stringify(detalhes) : null });
}

async function competenciaAberta(db: Awaited<ReturnType<typeof bancoObrigatorio>>, empresaId: number, competencia: Date) {
  const [registro] = await db.select().from(competenciasFinanceirasRh)
    .where(and(eq(competenciasFinanceirasRh.empresaId, empresaId), eq(competenciasFinanceirasRh.competencia, competencia))).limit(1);
  if (registro?.estado === "fechada") {
    throw new TRPCError({ code: "BAD_REQUEST", message: `A competência ${chaveCompetenciaRhSimplificado(competencia)} está fechada e não pode mais ser alterada.` });
  }
  return registro ?? null;
}

async function garantirCategoriaPagamentos(db: Awaited<ReturnType<typeof bancoObrigatorio>>, empresaId: number, usuarioId: number) {
  const [existente] = await db.select().from(categoriasFinanceiras)
    .where(and(eq(categoriasFinanceiras.empresaId, empresaId), eq(categoriasFinanceiras.nome, "Pagamentos a colaboradores"))).limit(1);
  if (existente) return existente.id;
  const criado = await db.insert(categoriasFinanceiras).values({
    empresaId,
    nome: "Pagamentos a colaboradores",
    tipo: "despesa",
    ativo: true,
    criadoPor: usuarioId,
  });
  return Number(criado[0].insertId);
}

async function carregarResumo(db: Awaited<ReturnType<typeof bancoObrigatorio>>, empresaId: number, competencia: Date) {
  const [colaboradores, adiantamentos, departamentos, cargos, registroCompetencia] = await Promise.all([
    db.select().from(colaboradoresRh).where(eq(colaboradoresRh.empresaId, empresaId)).orderBy(asc(colaboradoresRh.nome)),
    db.select().from(adiantamentosRh).where(and(
      eq(adiantamentosRh.empresaId, empresaId),
      eq(adiantamentosRh.competencia, competencia),
      inArray(adiantamentosRh.estado, ["aberto", "descontado"]),
    )).orderBy(desc(adiantamentosRh.dataAdiantamento)),
    db.select().from(departamentosRh).where(eq(departamentosRh.empresaId, empresaId)),
    db.select().from(cargosRh).where(eq(cargosRh.empresaId, empresaId)),
    db.select().from(competenciasFinanceirasRh).where(and(eq(competenciasFinanceirasRh.empresaId, empresaId), eq(competenciasFinanceirasRh.competencia, competencia))).limit(1),
  ]);
  const resumo = calcularResumoRhSimplificado({
    competencia,
    colaboradores: colaboradores.map((colaborador) => ({
      ...colaborador,
      departamentoNome: departamentos.find((departamento) => departamento.id === colaborador.departamentoId)?.nome ?? null,
      cargoNome: cargos.find((cargo) => cargo.id === colaborador.cargoId)?.nome ?? null,
    })),
    adiantamentos,
  });
  return { ...resumo, estado: registroCompetencia[0]?.estado ?? "aberta", registroCompetencia: registroCompetencia[0] ?? null };
}

export const NovoAdiantamentoRhSimplificadoSchema = z.object({
  colaboradorId: idSchema,
  competencia: competenciaSchema,
  dataAdiantamento: dataSchema,
  valor: valorPositivoSchema,
  observacoes: z.string().trim().max(4000).nullable().optional(),
  permitirExcesso: z.boolean().default(false),
});

export const controleRhSimplificado = router({
  resumo: protectedProcedure.input(z.object({ competencia: competenciaSchema }).optional()).query(async ({ ctx, input }) => {
    const competencia = competenciaData(input?.competencia ?? chaveCompetenciaRhSimplificado(new Date()));
    return { competencia, ...(await carregarResumo(await bancoObrigatorio(), ctx.configuracaoEmpresa.id, competencia)) };
  }),
  adiantamentos: router({
    list: protectedProcedure.input(z.object({ competencia: competenciaSchema, colaboradorId: idSchema.optional() })).query(async ({ ctx, input }) => {
      const db = await bancoObrigatorio();
      const competencia = competenciaData(input.competencia);
      const condicoes = [eq(adiantamentosRh.empresaId, ctx.configuracaoEmpresa.id), eq(adiantamentosRh.competencia, competencia)];
      if (input.colaboradorId) condicoes.push(eq(adiantamentosRh.colaboradorId, input.colaboradorId));
      const [itens, colaboradores] = await Promise.all([
        db.select().from(adiantamentosRh).where(and(...condicoes)).orderBy(desc(adiantamentosRh.dataAdiantamento), desc(adiantamentosRh.id)),
        db.select().from(colaboradoresRh).where(eq(colaboradoresRh.empresaId, ctx.configuracaoEmpresa.id)),
      ]);
      return itens.map((item) => ({ ...item, colaboradorNome: colaboradores.find((colaborador) => colaborador.id === item.colaboradorId)?.nome ?? "Colaborador removido" }));
    }),
  create: protectedProcedure.input(NovoAdiantamentoRhSimplificadoSchema).mutation(async ({ ctx, input }) => {
      const db = await bancoObrigatorio();
      const empresaId = ctx.configuracaoEmpresa.id;
      const competencia = competenciaData(input.competencia);
      await competenciaAberta(db, empresaId, competencia);
      const [colaborador] = await db.select().from(colaboradoresRh).where(and(eq(colaboradoresRh.id, input.colaboradorId), eq(colaboradoresRh.empresaId, empresaId))).limit(1);
      if (!colaborador) throw new TRPCError({ code: "NOT_FOUND", message: "Funcionário não encontrado." });
      if (colaborador.situacao !== "ativo") throw new TRPCError({ code: "BAD_REQUEST", message: "Somente funcionários ativos podem receber adiantamentos." });
      const existentes = await db.select().from(adiantamentosRh).where(and(eq(adiantamentosRh.empresaId, empresaId), eq(adiantamentosRh.colaboradorId, input.colaboradorId), eq(adiantamentosRh.competencia, competencia), inArray(adiantamentosRh.estado, ["aberto", "descontado"])));
      const limite = validarLimiteAdiantamentoRhSimplificado({ salario: colaborador.salarioAtual, totalExistente: existentes.reduce((total, item) => total + Number(item.valor), 0), valorNovo: input.valor });
      const administrador = ctx.user.papel === "administrador" || ctx.user.papel === "proprietario";
      if (limite.excede && (!input.permitirExcesso || !administrador)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `O total de adiantamentos (${limite.totalProjetado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}) ultrapassa o salário informado. Revise o valor ou solicite a autorização de um administrador.` });
      }
      const criado = await db.insert(adiantamentosRh).values({
        empresaId,
        colaboradorId: input.colaboradorId,
        competencia,
        dataAdiantamento: dataLocal(input.dataAdiantamento),
        valor: decimal(input.valor),
        saldoPendente: decimal(input.valor),
        observacoes: textoNulo(input.observacoes),
        criadoPor: ctx.user.id,
      });
      const id = Number(criado[0].insertId);
      await auditar(empresaId, ctx.user.id, "adiantamento", id, "criado_controle_simples", { colaboradorId: input.colaboradorId, competencia: input.competencia, valor: input.valor, excessoAutorizado: limite.excede });
      return { id, excessoAutorizado: limite.excede };
    }),
    update: protectedProcedure.input(NovoAdiantamentoRhSimplificadoSchema.extend({ id: idSchema })).mutation(async ({ ctx, input }) => {
      const db = await bancoObrigatorio();
      const empresaId = ctx.configuracaoEmpresa.id;
      const [atual] = await db.select().from(adiantamentosRh).where(and(eq(adiantamentosRh.id, input.id), eq(adiantamentosRh.empresaId, empresaId))).limit(1);
      if (!atual) throw new TRPCError({ code: "NOT_FOUND", message: "Adiantamento não encontrado." });
      if (atual.tituloFinanceiroId) throw new TRPCError({ code: "CONFLICT", message: "Este adiantamento possui vínculo financeiro histórico e deve ser ajustado pelo fluxo financeiro correspondente." });
      await competenciaAberta(db, empresaId, atual.competencia);
      const competencia = competenciaData(input.competencia);
      await competenciaAberta(db, empresaId, competencia);
      const [colaborador] = await db.select().from(colaboradoresRh).where(and(eq(colaboradoresRh.id, input.colaboradorId), eq(colaboradoresRh.empresaId, empresaId))).limit(1);
      if (!colaborador) throw new TRPCError({ code: "NOT_FOUND", message: "Funcionário não encontrado." });
      const existentes = await db.select().from(adiantamentosRh).where(and(eq(adiantamentosRh.empresaId, empresaId), eq(adiantamentosRh.colaboradorId, input.colaboradorId), eq(adiantamentosRh.competencia, competencia), inArray(adiantamentosRh.estado, ["aberto", "descontado"])));
      const limite = validarLimiteAdiantamentoRhSimplificado({ salario: colaborador.salarioAtual, totalExistente: existentes.filter((item) => item.id !== input.id).reduce((total, item) => total + Number(item.valor), 0), valorNovo: input.valor });
      const administrador = ctx.user.papel === "administrador" || ctx.user.papel === "proprietario";
      if (limite.excede && (!input.permitirExcesso || !administrador)) throw new TRPCError({ code: "BAD_REQUEST", message: "O total de adiantamentos ultrapassa o salário informado para esta competência." });
      await db.update(adiantamentosRh).set({ colaboradorId: input.colaboradorId, competencia, dataAdiantamento: dataLocal(input.dataAdiantamento), valor: decimal(input.valor), saldoPendente: decimal(input.valor), observacoes: textoNulo(input.observacoes) }).where(eq(adiantamentosRh.id, input.id));
      await auditar(empresaId, ctx.user.id, "adiantamento", input.id, "atualizado_controle_simples", { competencia: input.competencia, valor: input.valor, excessoAutorizado: limite.excede });
      return { success: true };
    }),
    cancel: protectedProcedure.input(z.object({ id: idSchema, motivo: z.string().trim().min(3).max(1000) })).mutation(async ({ ctx, input }) => {
      const db = await bancoObrigatorio();
      const empresaId = ctx.configuracaoEmpresa.id;
      const [atual] = await db.select().from(adiantamentosRh).where(and(eq(adiantamentosRh.id, input.id), eq(adiantamentosRh.empresaId, empresaId))).limit(1);
      if (!atual) throw new TRPCError({ code: "NOT_FOUND", message: "Adiantamento não encontrado." });
      if (atual.estado === "cancelado") return { success: true, jaCancelado: true };
      if (atual.tituloFinanceiroId) throw new TRPCError({ code: "CONFLICT", message: "Este adiantamento possui vínculo financeiro histórico e não pode ser cancelado por este controle." });
      await competenciaAberta(db, empresaId, atual.competencia);
      await db.update(adiantamentosRh).set({ estado: "cancelado", saldoPendente: "0" }).where(eq(adiantamentosRh.id, input.id));
      await auditar(empresaId, ctx.user.id, "adiantamento", input.id, "cancelado_controle_simples", { motivo: input.motivo });
      return { success: true, jaCancelado: false };
    }),
  }),
  fechamento: router({
    enviarFinanceiro: protectedProcedure.input(z.object({ competencia: competenciaSchema, dataVencimento: dataSchema })).mutation(async ({ ctx, input }) => {
      const db = await bancoObrigatorio();
      const empresaId = ctx.configuracaoEmpresa.id;
      const competencia = competenciaData(input.competencia);
      const [existente] = await db.select().from(competenciasFinanceirasRh)
        .where(and(eq(competenciasFinanceirasRh.empresaId, empresaId), eq(competenciasFinanceirasRh.competencia, competencia))).limit(1);
      if (existente?.estado === "fechada") return { success: true, jaFechada: true, titulos: 0 };
      const resumo = await carregarResumo(db, empresaId, competencia);
      const fechamento = validarFechamentoRhSimplificado(resumo.linhas);
      if (fechamento.bloqueado) throw new TRPCError({ code: "BAD_REQUEST", message: "Existem funcionários com saldo negativo. Revise os adiantamentos antes de enviar o fechamento ao Financeiro." });
      const categoriaId = await garantirCategoriaPagamentos(db, empresaId, ctx.user.id);
      const colaboradores = await db.select({ id: colaboradoresRh.id, centroCustoId: colaboradoresRh.centroCustoId }).from(colaboradoresRh).where(eq(colaboradoresRh.empresaId, empresaId));
      let titulos = 0;
      for (const linha of resumo.linhas) {
        if (linha.saldoPagar <= 0) continue;
        const centroCustoId = colaboradores.find((colaborador) => colaborador.id === linha.id)?.centroCustoId ?? null;
        const resultado = await garantirTituloFinanceiroComChave({
          tipo: "pagar",
          origem: "folha_pagamento",
          chaveIdempotencia: `RH-SIMPLES-${input.competencia}-${linha.id}`,
          descricao: `Saldo mensal ${input.competencia} — ${linha.nome}`,
          contraparteNome: linha.nome,
          categoriaId,
          centroCustoId,
          valorOriginal: decimal(linha.saldoPagar),
          dataEmissao: new Date(),
          dataVencimento: dataLocal(input.dataVencimento),
          competencia,
          criadoPor: ctx.user.id,
          database: db,
        });
        if (resultado.criado) titulos += 1;
      }
      await db.update(adiantamentosRh).set({ estado: "descontado", saldoPendente: "0" }).where(and(eq(adiantamentosRh.empresaId, empresaId), eq(adiantamentosRh.competencia, competencia), eq(adiantamentosRh.estado, "aberto")));
      if (existente) {
        await db.update(competenciasFinanceirasRh).set({ estado: "fechada", fechadaEm: new Date(), fechadaPor: ctx.user.id }).where(eq(competenciasFinanceirasRh.id, existente.id));
      } else {
        await db.insert(competenciasFinanceirasRh).values({ empresaId, competencia, estado: "fechada", fechadaEm: new Date(), fechadaPor: ctx.user.id, criadoPor: ctx.user.id });
      }
      await auditar(empresaId, ctx.user.id, "competencia_financeira", existente?.id ?? 0, "fechada_controle_simples", { competencia: input.competencia, titulos });
      return { success: true, jaFechada: false, titulos };
    }),
  }),
});
