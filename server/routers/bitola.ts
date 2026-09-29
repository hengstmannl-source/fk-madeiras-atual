import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const bitolaRouter = router({
  list: protectedProcedure
    .input(z.object({ madeiraId: z.number().int().positive().optional() }).optional())
    .query(async ({ input }) => {
      return db.listBitolas(input?.madeiraId);
    }),

  create: protectedProcedure
    .input(z.object({
      madeiraId: z.number().int().positive(),
      espessura: z.string().max(40).min(1),
      largura: z.string().max(40).min(1),
      comprimento: z.string().max(40).optional(),
      descricao: z.string().max(4000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const empresaId = (await db.getEmpresaUnica()).id;
      await db.createBitola({ ...input, criadoPor: ctx.user.id, empresaId });
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
      madeiraId: z.number().int().positive(),
      espessura: z.string().max(40),
      largura: z.string().max(40),
      comprimento: z.string().max(40).optional(),
      descricao: z.string().max(4000).optional(),
    }))
    .mutation(async ({ input }) => {
      await db.updateBitola(input.id, {
        madeiraId: input.madeiraId, espessura: input.espessura,
        largura: input.largura, comprimento: input.comprimento, descricao: input.descricao,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await db.deleteBitola(input.id);
      return { success: true };
    }),
});
