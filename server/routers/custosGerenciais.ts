import { z } from "zod";
import { adminProcedure, financeiroProcedure, router } from "../_core/trpc";
import { calcularMargemGerencial, calcularPrecoSugerido } from "../custos-gerenciais.logic";
import * as repositorio from "../repositories/custosGerenciais";

const DataCompetenciaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma competência válida.");
const BaseApropriacaoSchema = z.enum([
  "m3_produzido",
  "m3_vendido",
  "valor_vendido",
  "quantidade_vendida",
  "carga",
  "pedido",
  "percentual_receita",
  "manual",
]);
const UnidadeValorSchema = z.enum(["monetario", "percentual"]);
const ReferenciaOpcional = z.number().int().positive().nullable().optional();
const DecimalNaoNegativo = z.union([z.number(), z.string()])
  .transform((valor) => String(valor).replace(",", "."))
  .refine((valor) => Number.isFinite(Number(valor)) && Number(valor) >= 0, "Informe um valor não negativo.");

function dataLocal(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
}

const CentroSchema = z.object({
  codigo: z.enum(["industrial", "comercial_administrativo"]),
  nome: z.string().trim().min(2, "Informe o nome do centro.").max(150),
});

const AtualizarCentroSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string().trim().min(2).max(150).optional(),
  ativo: z.boolean().optional(),
}).refine((input) => input.nome !== undefined || input.ativo !== undefined, "Informe ao menos um campo para atualizar.");

const CategoriaSchema = z.object({
  centroCustoId: z.number().int().positive(),
  categoriaFinanceiraId: ReferenciaOpcional,
  codigo: z.string().trim().min(2).max(80),
  nome: z.string().trim().min(2).max(150),
  tipo: z.enum(["estrutural", "direto_venda"]),
  baseApropriacao: BaseApropriacaoSchema,
  incluirComissaoVendaAutomatica: z.boolean().optional(),
});

const AtualizarCategoriaSchema = z.object({
  id: z.number().int().positive(),
  centroCustoId: z.number().int().positive().optional(),
  categoriaFinanceiraId: ReferenciaOpcional,
  nome: z.string().trim().min(2).max(150).optional(),
  tipo: z.enum(["estrutural", "direto_venda"]).optional(),
  baseApropriacao: BaseApropriacaoSchema.optional(),
  incluirComissaoVendaAutomatica: z.boolean().optional(),
  ativo: z.boolean().optional(),
}).refine((input) => Object.keys(input).some((chave) => chave !== "id"), "Informe ao menos um campo para atualizar.");

const LancamentoSchema = z.object({
  categoriaCustoId: z.number().int().positive(),
  competencia: DataCompetenciaSchema,
  descricao: z.string().trim().min(2).max(300),
  unidadeValor: UnidadeValorSchema,
  valor: DecimalNaoNegativo,
  origem: z.enum(["manual", "financeiro_referenciado", "venda_direta"]),
  tituloFinanceiroId: ReferenciaOpcional,
  orcamentoId: ReferenciaOpcional,
  romaneioCargaId: ReferenciaOpcional,
  romaneioProducaoId: ReferenciaOpcional,
  loteId: ReferenciaOpcional,
  notaDieselId: ReferenciaOpcional,
  comprovanteUrl: z.string().trim().max(1000).nullable().optional(),
  observacoes: z.string().trim().max(4000).nullable().optional(),
  justificativaCompetencia: z.string().trim().max(4000).nullable().optional(),
});

export const custosGerenciaisRouter = router({
  centros: router({
    listar: financeiroProcedure.input(z.object({ incluirInativos: z.boolean().optional() }).optional())
      .query(({ input }) => repositorio.listarCentrosCustosGerenciais(input?.incluirInativos)),
    criar: adminProcedure.input(CentroSchema).mutation(({ ctx, input }) => repositorio.criarCentroCustoGerencial({
      ...input,
      criadoPor: ctx.user.id,
    })),
    atualizar: adminProcedure.input(AtualizarCentroSchema).mutation(({ input }) => repositorio.atualizarCentroCustoGerencial(input)),
  }),
  categorias: router({
    listar: financeiroProcedure.input(z.object({ incluirInativas: z.boolean().optional() }).optional())
      .query(({ input }) => repositorio.listarCategoriasCustosGerenciais(input?.incluirInativas)),
    criar: adminProcedure.input(CategoriaSchema).mutation(({ ctx, input }) => repositorio.criarCategoriaCustoGerencial({
      ...input,
      criadoPor: ctx.user.id,
    })),
    atualizar: adminProcedure.input(AtualizarCategoriaSchema).mutation(({ input }) => repositorio.atualizarCategoriaCustoGerencial(input)),
  }),
  lancamentos: router({
    listar: financeiroProcedure.input(z.object({
      competencia: DataCompetenciaSchema.optional(),
      categoriaCustoId: z.number().int().positive().optional(),
      incluirCancelados: z.boolean().optional(),
    }).optional()).query(({ input }) => repositorio.listarLancamentosCustosGerenciais({
      competencia: input?.competencia ? dataLocal(input.competencia) : undefined,
      categoriaCustoId: input?.categoriaCustoId,
      incluirCancelados: input?.incluirCancelados,
    })),
    criar: adminProcedure.input(LancamentoSchema).mutation(({ ctx, input }) => repositorio.criarLancamentoCustoGerencial({
      ...input,
      competencia: dataLocal(input.competencia),
      criadoPor: ctx.user.id,
    })),
    cancelar: adminProcedure.input(z.object({
      id: z.number().int().positive(),
      motivo: z.string().trim().min(3, "Informe o motivo do cancelamento.").max(4000),
    })).mutation(({ ctx, input }) => repositorio.cancelarLancamentoCustoGerencial({
      ...input,
      canceladoPor: ctx.user.id,
    })),
  }),
  rateios: router({
    listar: financeiroProcedure.input(z.object({ competencia: DataCompetenciaSchema.optional() }).optional())
      .query(({ input }) => repositorio.listarRateiosCustosGerenciais(input?.competencia ? dataLocal(input.competencia) : undefined)),
    gerar: adminProcedure.input(z.object({ competencia: DataCompetenciaSchema }))
      .mutation(({ ctx, input }) => repositorio.gerarRateioCustoGerencial({
        competencia: dataLocal(input.competencia),
        criadoPor: ctx.user.id,
      })),
  }),
  rastreabilidade: router({
    porRomaneio: financeiroProcedure.input(z.object({ romaneioId: z.number().int().positive() }))
      .query(({ input }) => repositorio.obterCustoMateriaPrimaRastreavelPorRomaneio(input.romaneioId)),
    porLote: financeiroProcedure.input(z.object({ loteId: z.number().int().positive() }))
      .query(({ input }) => repositorio.obterCustoMateriaPrimaRastreavelPorLote(input.loteId)),
  }),
  calculos: router({
    listar: financeiroProcedure.input(z.object({
      entidadeTipo: z.enum(["romaneio_producao", "lote", "venda"]).optional(),
      entidadeId: z.number().int().positive().optional(),
      competencia: DataCompetenciaSchema.optional(),
      incluirSubstituidos: z.boolean().optional(),
    }).optional()).query(({ input }) => repositorio.listarCalculosCustosGerenciais({
      entidadeTipo: input?.entidadeTipo,
      entidadeId: input?.entidadeId,
      competencia: input?.competencia ? dataLocal(input.competencia) : undefined,
      incluirSubstituidos: input?.incluirSubstituidos,
    })),
    materializarRomaneio: adminProcedure.input(z.object({ romaneioId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => repositorio.materializarCustoGerencialPorRomaneio({ romaneioId: input.romaneioId, criadoPor: ctx.user.id })),
    materializarLote: adminProcedure.input(z.object({ loteId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => repositorio.materializarCustoGerencialPorLote({ loteId: input.loteId, criadoPor: ctx.user.id })),
    materializarVenda: adminProcedure.input(z.object({ vendaId: z.number().int().positive() }))
      .mutation(({ ctx, input }) => repositorio.materializarCustoGerencialPorVenda({ vendaId: input.vendaId, criadoPor: ctx.user.id })),
  }),
  simulacao: router({
    preco: financeiroProcedure.input(z.object({
      custoPorM3: DecimalNaoNegativo.nullable(),
      margemPercentual: DecimalNaoNegativo.optional(),
      markupPercentual: DecimalNaoNegativo.optional(),
    })).query(({ input }) => calcularPrecoSugerido(input)),
    margem: financeiroProcedure.input(z.object({ receita: DecimalNaoNegativo, custoTotal: DecimalNaoNegativo }))
      .query(({ input }) => calcularMargemGerencial(input.receita, input.custoTotal)),
  }),
});
