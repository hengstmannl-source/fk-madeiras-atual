import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const madeiraRouter = router({
  list: protectedProcedure.query(async () => {
    return db.listMadeiras();
  }),

  create: protectedProcedure
    .input(z.object({
      nome: z.string().max(300).min(1, "Nome é obrigatório"),
      descricao: z.string().max(4000).optional(),
      precoM3: z.string().max(40).min(1, "Preço é obrigatório"),
      unidadeMedida: z.string().max(4000).default("m³"),
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
      id: z.number().int().positive(),
      nome: z.string().max(300).min(1),
      descricao: z.string().max(4000).optional(),
      precoM3: z.string().max(40),
      unidadeMedida: z.string().max(4000).optional(),
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
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await db.deleteMadeira(input.id);
      return { success: true };
    }),
});
