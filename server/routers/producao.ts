import { z } from "zod";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

const DataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida");
const DecimalPositivo = z.union([z.string(), z.number()]).transform((valor) => String(valor).replace(",", ".")).refine((valor) => Number(valor) > 0, "Informe um valor positivo");
const DecimalNaoNegativo = z.union([z.string(), z.number()]).transform((valor) => String(valor).replace(",", ".")).refine((valor) => Number(valor) >= 0, "Informe um valor válido");

function dataLocal(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

const PlaquetaSchema = z.object({
  codigo: z.string().trim().max(80).nullable().optional(),
  madeiraNome: z.string().trim().min(2).max(200),
  espessura: DecimalPositivo.optional().nullable(),
  largura: DecimalPositivo.optional().nullable(),
  comprimento: DecimalPositivo.optional().nullable(),
  volumeInicial: DecimalPositivo,
  dataEntrada: DataSchema,
  origem: z.string().trim().max(200).nullable().optional(),
  localizacao: z.string().trim().max(200).nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
});

const PlaquetaCargaSchema = z.object({
  codigo: z.string().trim().max(80).nullable().optional(),
  madeiraNome: z.string().trim().min(2).max(200),
  diametro: DecimalPositivo,
  comprimento: DecimalPositivo,
  valorMetroCubico: DecimalPositivo,
  observacoes: z.string().max(1000).nullable().optional(),
});

const RomaneioCargaSchema = z.object({
  dataCarga: DataSchema,
  dataVencimento: DataSchema.optional(),
  origem: z.string().trim().max(200).nullable().optional(),
  fornecedorId: z.number().int().positive().nullable().optional(),
  centroCustoId: z.number().int().positive().nullable().optional(),
  responsavel: z.string().trim().max(200).nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
  fretePorMetroCubico: DecimalNaoNegativo.default("0"),
  plaquetas: z.array(PlaquetaCargaSchema).min(1, "Adicione ao menos uma plaqueta").max(200),
});

const FiltrosCargasSchema = z.object({
  dataInicial: DataSchema.optional(),
  dataFinal: DataSchema.optional(),
  origem: z.string().trim().max(200).optional(),
}).refine((valor) => !valor.dataInicial || !valor.dataFinal || valor.dataInicial <= valor.dataFinal, "A data inicial deve ser anterior à data final");

const ListaPlaquetasSchema = z.object({
  busca: z.string().trim().max(200).optional(),
  estado: z.enum(["disponivel", "consumida", "cancelada"]).optional(),
  limite: z.number().int().min(1).max(500).default(10),
  deslocamento: z.number().int().min(0).default(0),
});

const RegularizacaoVolumeConsumidoSchema = z.object({
  plaquetaId: z.number().int().positive(),
  volumeConfirmado: DecimalPositivo,
  justificativa: z.string().trim().min(10, "Explique a regularização com ao menos 10 caracteres").max(2000),
});

const ConfirmacaoVariacoesAtipicasSchema = z.object({
  variacoes: z.array(z.object({
    essencia: z.string().trim().min(1).max(200),
    assinatura: z.string().trim().min(1).max(255),
  })).min(1, "Não há variações pendentes para confirmar").max(50),
});

const RelatorioExcecoesPlaquetasSchema = z.object({
  busca: z.string().trim().max(200).optional(),
  situacao: z.enum(["todas", "duplicada", "sem_plaqueta"]).default("todas"),
  somenteDisponiveis: z.boolean().default(false),
});

const RelatorioInventarioSchema = z.object({
  dataInicial: DataSchema.optional(),
  dataFinal: DataSchema.optional(),
}).refine((valor) => !valor.dataInicial || !valor.dataFinal || valor.dataInicial <= valor.dataFinal, "A data inicial deve ser anterior à data final");

const AjusteEstoqueSerradoSchema = z.object({
  madeiraNome: z.string().trim().min(2).max(200),
  espessura: DecimalPositivo,
  largura: DecimalPositivo,
  comprimento: DecimalPositivo,
  quantidadeContada: z.number().int().min(0).max(1_000_000),
  motivo: z.string().trim().min(3).max(1000),
});

const ItemRomaneioSchema = z.object({
  madeiraNome: z.string().trim().min(2).max(200),
  espessura: DecimalPositivo,
  largura: DecimalPositivo,
  comprimento: DecimalPositivo,
  quantidade: z.number().int().positive(),
});

const AproveitamentoRomaneioSchema = z.object({
  madeiraNome: z.string().trim().min(2).max(200),
  volume: DecimalPositivo,
});

const ToraRomaneioSchema = z.object({
    madeiraNome: z.string().trim().min(2).max(200),
    diametro: DecimalPositivo.optional().nullable(),
    comprimento: DecimalPositivo.optional().nullable(),
    volume: DecimalPositivo,
  });

const ToraEntradaRomaneioSchema = z.object({
  plaquetaId: z.number().int().positive().optional(),
  novaPlaqueta: z.object({
    codigo: z.string().trim().max(80).nullable().optional(),
  }).optional(),
  medidasConferidasManual: z.boolean().optional(),
  tora: ToraRomaneioSchema,
}).refine((entrada) => Boolean(entrada.plaquetaId) !== Boolean(entrada.novaPlaqueta), "Informe uma plaqueta disponível ou um novo código para entrada imediata");

const RomaneioSchema = z.object({
  toras: z.array(ToraEntradaRomaneioSchema).min(1, "Informe ao menos uma plaqueta serrada"),
  dataProducao: DataSchema,
  fita: z.string().trim().max(100).nullable().optional(),
  responsavel: z.string().trim().max(200).nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
  itens: z.array(ItemRomaneioSchema).min(1, "Adicione ao menos uma peça produzida"),
  aproveitamentos: z.array(AproveitamentoRomaneioSchema).max(50).default([]),
  incluirAproveitamentoNoRendimento: z.boolean().default(false),
});

const ToraSerragemTerceirosSchema = z.object({
  referencia: z.string().trim().max(120).optional().transform((referencia) => referencia || "-"),
  madeiraNome: z.string().trim().min(2).max(200),
  diametro: DecimalPositivo,
  comprimento: DecimalPositivo,
  volume: DecimalPositivo.optional(),
});

const SerragemTerceirosSchema = z.object({
  clienteId: z.number().int().positive(),
  centroCustoId: z.number().int().positive().nullable().optional(),
  dataProducao: DataSchema,
  dataVencimento: DataSchema,
  responsavel: z.string().trim().max(200).nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
  valorMetroCubico: DecimalPositivo,
  toras: z.array(ToraSerragemTerceirosSchema).min(1, "Adicione ao menos uma tora do cliente").max(500),
  itens: z.array(ItemRomaneioSchema).min(1, "Adicione ao menos uma peça serrada").max(500),
}).refine((valor) => valor.dataVencimento >= valor.dataProducao, "O vencimento não pode ser anterior à data do serviço");

const IdsRomaneioLoteSchema = z.array(z.number().int().positive()).min(1, "Selecione ao menos um romaneio").max(100).refine((ids) => new Set(ids).size === ids.length, "Não repita romaneios na seleção");
const CabecalhoCargaLoteSchema = z.object({
  ids: IdsRomaneioLoteSchema,
  dataCarga: DataSchema.optional(), dataVencimento: DataSchema.optional(), origem: z.string().trim().max(200).nullable().optional(), fornecedorId: z.number().int().positive().nullable().optional(), centroCustoId: z.number().int().positive().nullable().optional(), responsavel: z.string().trim().max(200).nullable().optional(), observacoes: z.string().max(4000).nullable().optional(), fretePorMetroCubico: DecimalNaoNegativo.optional(),
}).refine((dados) => dados.dataCarga !== undefined || dados.dataVencimento !== undefined || dados.origem !== undefined || dados.fornecedorId !== undefined || dados.centroCustoId !== undefined || dados.responsavel !== undefined || dados.observacoes !== undefined || dados.fretePorMetroCubico !== undefined, "Informe ao menos um dado de cabeçalho para alterar");
const CabecalhoProducaoLoteSchema = z.object({
  ids: IdsRomaneioLoteSchema,
  dataProducao: DataSchema.optional(), fita: z.string().trim().max(100).nullable().optional(), responsavel: z.string().trim().max(200).nullable().optional(), observacoes: z.string().max(4000).nullable().optional(),
}).refine((dados) => dados.dataProducao !== undefined || dados.fita !== undefined || dados.responsavel !== undefined || dados.observacoes !== undefined, "Informe ao menos um dado de cabeçalho para alterar");
const CabecalhoSerragemLoteSchema = z.object({
  ids: IdsRomaneioLoteSchema,
  clienteId: z.number().int().positive().optional(), centroCustoId: z.number().int().positive().nullable().optional(), dataProducao: DataSchema.optional(), dataVencimento: DataSchema.optional(), responsavel: z.string().trim().max(200).nullable().optional(), observacoes: z.string().max(4000).nullable().optional(),
}).refine((dados) => dados.clienteId !== undefined || dados.centroCustoId !== undefined || dados.dataProducao !== undefined || dados.dataVencimento !== undefined || dados.responsavel !== undefined || dados.observacoes !== undefined, "Informe ao menos um dado de cabeçalho para alterar");

const RetiradaSerragemTerceirosSchema = z.object({
  serragemId: z.number().int().positive(),
  dataRetirada: DataSchema,
  responsavel: z.string().trim().max(200).nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
  itens: z.array(z.object({ loteId: z.number().int().positive(), quantidade: z.number().int().positive() })).min(1, "Selecione ao menos uma peça para retirada"),
});

export const producaoRouter = router({
  cargas: router({
    list: protectedProcedure.input(FiltrosCargasSchema.optional()).query(({ ctx, input }) => db.listRomaneiosCargaToras({
      dataInicial: input?.dataInicial ? dataLocal(input.dataInicial) : undefined,
      dataFinal: input?.dataFinal ? dataLocal(input.dataFinal) : undefined,
      origem: input?.origem,
    })),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) => db.getRomaneioCargaComPlaquetas(input.id)),
    modeloPlaquetasCsv: protectedProcedure.query(() => db.getModeloImportacaoPlaquetasCargaCsv()),
    importarPlaquetasCsv: protectedProcedure.input(RomaneioCargaSchema.omit({ plaquetas: true }).extend({
      conteudo: z.string().min(1, "Selecione um arquivo CSV").max(1_000_000, "O arquivo excede o limite de 1 MB"),
    })).mutation(({ ctx, input }) => db.importarPlaquetasCargaCsv({
      ...input,
      dataCarga: dataLocal(input.dataCarga),
      dataVencimento: dataLocal(input.dataVencimento ?? input.dataCarga),
    }, ctx.user.id)),
    create: protectedProcedure.input(RomaneioCargaSchema).mutation(({ ctx, input }) => db.criarRomaneioCargaToras({
      ...input,
      dataCarga: dataLocal(input.dataCarga),
      dataVencimento: dataLocal(input.dataVencimento ?? input.dataCarga),
      criadoPor: ctx.user.id,
      empresaId: ctx.configuracaoEmpresa.id,
    })),
    update: protectedProcedure.input(RomaneioCargaSchema.extend({ id: z.number().int().positive() })).mutation(({ input }) => db.atualizarRomaneioCargaToras(input.id, {
      ...input,
      dataCarga: dataLocal(input.dataCarga),
      dataVencimento: dataLocal(input.dataVencimento ?? input.dataCarga),
    })),
    atualizarCabecalhoEmLote: protectedProcedure.input(CabecalhoCargaLoteSchema).mutation(({ ctx, input }) => db.atualizarCabecalhoCargasEmLote({
      ...input,
      dataCarga: input.dataCarga ? dataLocal(input.dataCarga) : undefined,
      dataVencimento: input.dataVencimento ? dataLocal(input.dataVencimento) : undefined,
      empresaId: ctx.configuracaoEmpresa.id,
    })),
    excluir: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => db.excluirRomaneioCargaToras(input.id, ctx.user.id)),
  }),
  plaquetas: router({
    list: protectedProcedure.input(ListaPlaquetasSchema.optional()).query(({ ctx, input }) => db.listPlaquetas(input)),
    buscar: protectedProcedure.input(z.object({ codigo: z.string().trim().min(1, "Digite o código da plaqueta").max(80) })).query(({ ctx, input }) => db.getPlaquetaDisponivelPorCodigo(input.codigo)),
    semIdentificacaoDisponiveis: protectedProcedure.query(() => db.listPlaquetasSemIdentificacaoDisponiveis()),
    rastreabilidade: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) => db.getRastreabilidadePlaqueta(input.id)),
    regularizarVolumeConsumido: adminProcedure.input(RegularizacaoVolumeConsumidoSchema).mutation(({ ctx, input }) => db.regularizarVolumePlaquetaConsumida({
      ...input,
      criadoPor: ctx.user.id,
      empresaId: ctx.configuracaoEmpresa.id,
    })),
    confirmarVariacoesAtipicas: protectedProcedure.input(ConfirmacaoVariacoesAtipicasSchema).mutation(({ ctx, input }) => db.confirmarVariacoesAtipicasPlaquetas(input.variacoes, ctx.user.id)),
    relatorioExcecoes: protectedProcedure.input(RelatorioExcecoesPlaquetasSchema.optional()).query(({ ctx, input }) => db.getRelatorioExcecoesPlaquetas(input)),
    create: protectedProcedure.input(PlaquetaSchema).mutation(({ ctx, input }) => db.createPlaqueta({
      ...input,
      dataEntrada: dataLocal(input.dataEntrada),
      criadoPor: ctx.user.id,
      empresaId: ctx.configuracaoEmpresa.id,
    })),
  }),
  romaneios: router({
    list: protectedProcedure.query(({ ctx }) => db.listRomaneiosProducao()),
    itens: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) => db.listItensRomaneioProducao(input.id)),
    detalhe: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) => db.getRomaneioProducaoComItens(input.id)),
    modeloTorasCsv: protectedProcedure.query(() => db.getModeloImportacaoTorasProducaoCsv()),
    importarTorasCsv: protectedProcedure.input(z.object({ conteudo: z.string().min(1, "Selecione um arquivo CSV").max(1_000_000, "O arquivo excede o limite de 1 MB") })).mutation(({ ctx, input }) => db.prepararTorasProducaoCsv(input.conteudo)),
    modeloPecasCsv: protectedProcedure.query(() => db.getModeloImportacaoPecasProducaoCsv()),
    importarPecasCsv: protectedProcedure.input(z.object({ conteudo: z.string().min(1, "Selecione um arquivo CSV").max(1_000_000, "O arquivo excede o limite de 1 MB") })).mutation(({ input }) => db.prepararPecasProducaoCsv(input.conteudo)),
    confirmar: protectedProcedure.input(RomaneioSchema).mutation(({ ctx, input }) => db.confirmarRomaneioProducao({
      ...input,
      dataProducao: dataLocal(input.dataProducao),
      criadoPor: ctx.user.id,
      empresaId: ctx.configuracaoEmpresa.id,
    })),
    update: protectedProcedure.input(RomaneioSchema.omit({ toras: true }).extend({ id: z.number().int().positive() })).mutation(({ ctx, input }) => db.atualizarRomaneioProducao(input.id, {
      ...input,
      dataProducao: dataLocal(input.dataProducao),
      atualizadoPor: ctx.user.id,
      empresaId: ctx.configuracaoEmpresa.id,
    })),
    atualizarCabecalhoEmLote: protectedProcedure.input(CabecalhoProducaoLoteSchema).mutation(({ ctx, input }) => db.atualizarCabecalhoProducaoEmLote({
      ...input,
      dataProducao: input.dataProducao ? dataLocal(input.dataProducao) : undefined,
      empresaId: ctx.configuracaoEmpresa.id,
    })),
    excluir: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => db.excluirRomaneioProducao(input.id)),
  }),
  serragemTerceiros: router({
    list: protectedProcedure.query(({ ctx }) => db.listSerragensTerceiros()),
    detalhe: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ ctx, input }) => db.getDetalheSerragemTerceiros(input.id)),
    modeloTorasCsv: protectedProcedure.query(() => db.getModeloImportacaoTorasSerragemTerceirosCsv()),
    importarTorasCsv: protectedProcedure.input(z.object({ conteudo: z.string().min(1, "Selecione um arquivo CSV").max(1_000_000, "O arquivo excede o limite de 1 MB") })).mutation(({ input }) => db.prepararTorasSerragemTerceirosCsv(input.conteudo)),
    modeloPecasCsv: protectedProcedure.query(() => db.getModeloImportacaoPecasProducaoCsv()),
    importarPecasCsv: protectedProcedure.input(z.object({ conteudo: z.string().min(1, "Selecione um arquivo CSV").max(1_000_000, "O arquivo excede o limite de 1 MB") })).mutation(({ input }) => db.prepararPecasProducaoCsv(input.conteudo)),
    criar: protectedProcedure.input(SerragemTerceirosSchema).mutation(({ ctx, input }) => db.criarSerragemTerceiros({
      ...input,
      dataProducao: dataLocal(input.dataProducao),
      dataVencimento: dataLocal(input.dataVencimento),
      criadoPor: ctx.user.id,
      empresaId: ctx.configuracaoEmpresa.id,
    })),
    update: protectedProcedure.input(SerragemTerceirosSchema.safeExtend({ id: z.number().int().positive() })).mutation(({ ctx, input }) => db.atualizarSerragemTerceiros(input.id, {
      ...input,
      dataProducao: dataLocal(input.dataProducao),
      dataVencimento: dataLocal(input.dataVencimento),
      atualizadoPor: ctx.user.id,
      empresaId: ctx.configuracaoEmpresa.id,
    })),
    atualizarCabecalhoEmLote: protectedProcedure.input(CabecalhoSerragemLoteSchema).mutation(({ ctx, input }) => db.atualizarCabecalhoSerragensEmLote({
      ...input,
      dataProducao: input.dataProducao ? dataLocal(input.dataProducao) : undefined,
      dataVencimento: input.dataVencimento ? dataLocal(input.dataVencimento) : undefined,
      empresaId: ctx.configuracaoEmpresa.id,
    })),
    registrarRetirada: protectedProcedure.input(RetiradaSerragemTerceirosSchema).mutation(({ ctx, input }) => db.registrarRetiradaSerragemTerceiros({
      ...input,
      dataRetirada: dataLocal(input.dataRetirada),
      criadoPor: ctx.user.id,
      empresaId: ctx.configuracaoEmpresa.id,
    })),
  }),
  estoque: router({
    resumo: protectedProcedure.query(({ ctx }) => db.getResumoEstoqueSerrado()),
    relatorio: protectedProcedure.input(RelatorioInventarioSchema.optional()).query(({ ctx, input }) => db.getRelatorioInventarioSerrado(
      input?.dataInicial ? dataLocal(input.dataInicial) : undefined,
      input?.dataFinal ? dataLocal(input.dataFinal) : undefined,
    )),
    ajustes: protectedProcedure.query(({ ctx }) => db.listAjustesEstoqueSerrado()),
    ajustar: adminProcedure.input(AjusteEstoqueSerradoSchema).mutation(({ ctx, input }) => db.ajustarEstoqueSerrado({ ...input, criadoPor: ctx.user.id, empresaId: ctx.configuracaoEmpresa.id })),
  }),
});
