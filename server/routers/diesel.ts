import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

const DataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida");
const DecimalPositivo = z.union([z.string(), z.number()])
  .transform((valor) => String(valor).replace(",", "."))
  .refine((valor) => Number(valor) > 0, "Informe um valor positivo");

function dataLocal(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

const NotaDieselSchema = z.object({
  numeroNota: z.string().trim().max(100).nullable().optional(),
  fornecedorId: z.number().int().positive(),
  centroCustoId: z.number().int().positive().nullable().optional(),
  litros: DecimalPositivo,
  valorTotal: DecimalPositivo,
  dataNota: DataSchema,
  dataVencimento: DataSchema,
  observacoes: z.string().trim().max(4000).nullable().optional(),
}).refine((valor) => valor.dataVencimento >= valor.dataNota, "O vencimento não pode ser anterior à data da nota");

const AbastecimentoDieselSchema = z.object({
  destino: z.string().trim().min(2, "Informe o destino do abastecimento").max(200),
  centroCustoId: z.number().int().positive().nullable().optional(),
  responsavel: z.string().trim().max(200).nullable().optional(),
  litros: DecimalPositivo,
  dataAbastecimento: DataSchema,
  observacoes: z.string().trim().max(4000).nullable().optional(),
});

export const dieselRouter = router({
  resumo: protectedProcedure.query(({ ctx }) => db.getResumoTanqueDiesel()),
  criarNota: protectedProcedure.input(NotaDieselSchema).mutation(({ input, ctx }) => db.criarNotaDiesel({
    ...input,
    dataNota: dataLocal(input.dataNota),
    dataVencimento: dataLocal(input.dataVencimento),
    criadoPor: ctx.user.id,
    empresaId: ctx.configuracaoEmpresa.id,
  })),
  excluirNota: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input, ctx }) =>
    db.excluirNotaDiesel(input.id, ctx.user.id)),
  registrarAbastecimento: protectedProcedure.input(AbastecimentoDieselSchema).mutation(({ input, ctx }) => db.registrarAbastecimentoDiesel({
    ...input,
    dataAbastecimento: dataLocal(input.dataAbastecimento),
    criadoPor: ctx.user.id,
    empresaId: ctx.configuracaoEmpresa.id,
  })),
});
