import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const madeiraRouter = router({
  list: protectedProcedure.query(async () => {
    return db.listMadeiras();
  }),

  create: protectedProcedure
    .input(z.object({
      nome: z.string().min(1, "Nome é obrigatório"),
      descricao: z.string().optional(),
      precoM3: z.string().min(1, "Preço é obrigatório"),
      unidadeMedida: z.string().default("m³"),
    }))
    .mutation(async ({ ctx, input }) => {
      const empresaId = (await db.getEmpresaUnica()).id;
      const result = await db.createMadeira({
        ...input,
        criadoPor: ctx.user.id,
        empresaId: ctx.configuracaoEmpresa.id,
      });
      return { success: true, id: Number(result[0].insertId) };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().min(1),
      descricao: z.string().optional(),
      precoM3: z.string(),
      unidadeMedida: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.updateMadeira(input.id, {
        nome: input.nome,
        descricao: input.descricao,
        precoM3: input.precoM3,
        unidadeMedida: input.unidadeMedida,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteMadeira(input.id);
      return { success: true };
    }),
});
