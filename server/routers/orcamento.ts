import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

export const ItemSchema = z.object({
  madeiraId: z.number().nullable().optional(),
  bitolaId: z.number().nullable().optional(),
  produtoComercialId: z.number().int().positive().nullable().optional(),
  madeiraNome: z.string(),
  bitolaDescricao: z.string(),
  espessura: z.string(),
  largura: z.string(),
  comprimento: z.string(),
  quantidade: z.number().int().positive("Informe uma quantidade inteira positiva"),
  tipoComercializacao: z.enum(["metro_cubico", "unidade", "pacote"]).default("metro_cubico"),
  unidadesPorComercializacao: z.number().int().min(0, "Informe a composição do pacote com zero ou mais unidades").default(1),
  precoM3: z.string(),
  precoLinear: z.string(),
  valorPeca: z.string(),
  valorTotal: z.string(),
  componentesPacote: z.array(z.object({
    descricao: z.string().trim().min(2, "Informe a descrição da peça").max(240),
    madeiraNome: z.string().trim().max(200).nullable().optional(),
    espessura: z.string().trim().max(30).nullable().optional(),
    largura: z.string().trim().max(30).nullable().optional(),
    comprimento: z.string().trim().max(30).nullable().optional(),
    quantidade: z.number().int().positive("Informe a quantidade da peça"),
  })).max(60).default([]),
  orcamentoId: z.number().optional(),
}).superRefine((item, ctx) => {
  if (item.tipoComercializacao === "pacote" && item.componentesPacote.length === 0) {
    ctx.addIssue({ code: "custom", path: ["componentesPacote"], message: "Informe ao menos uma peça que compõe o pacote" });
  }
});

export const FormaPagamentoSchema = z.enum([
  "pix",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "transferencia",
  "boleto",
  "outro",
]);

export const RegistroPagamentoSchema = z.object({
  id: z.number(),
  formaPagamento: FormaPagamentoSchema.default("outro"),
  pagoEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data de pagamento válida").default(() => new Date().toISOString().slice(0, 10)),
});

export const CondicaoPagamentoVendaSchema = z.object({
  id: z.number().int().positive(),
  parcelas: z.array(z.object({
    dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data de vencimento válida"),
  })).min(1, "Informe ao menos uma parcela").max(24, "A condição de pagamento suporta no máximo 24 parcelas"),
});

const BaixaAproveitamentoSchema = z.object({
  madeiraNome: z.string().trim().min(2, "Informe a essência do aproveitamento").max(200),
  volume: z.union([z.string(), z.number()])
    .transform((valor) => String(valor).replace(",", "."))
    .refine((valor) => Number(valor) > 0, "Informe um volume de aproveitamento positivo"),
});

export const AproveitamentoVendaSchema = BaixaAproveitamentoSchema.extend({
  precoM3: z.union([z.string(), z.number()])
    .transform((valor) => String(valor).replace(",", "."))
    .refine((valor) => Number(valor) >= 0, "Informe um preço por m³ válido"),
});

export const TaxaAdicionalVendaSchema = z.object({
  descricao: z.string().trim().min(2, "Informe a descrição da taxa").max(120),
  tipo: z.enum(["percentual", "fixo"]),
  valor: z.string().trim().min(1, "Informe o valor da taxa")
    .transform((valor) => valor.replace(",", "."))
    .refine((valor) => Number.isFinite(Number(valor)) && Number(valor) >= 0, "Informe um valor de taxa válido"),
});

export const RegistroEntregaFisicaSchema = z.object({
  id: z.number().int().positive(),
  entregueEm: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida"),
  modalidadeEntrega: z.enum(["retirada", "entrega"]),
  responsavelEntrega: z.string().trim().min(2, "Informe o responsável pela entrega").max(200),
  observacoesEntrega: z.string().trim().max(4000).optional(),
  aproveitamentos: z.array(BaixaAproveitamentoSchema).max(30).default([]),
});

const DataFinanceiraSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida");
const LinhaModeloSchema = z.object({ comprimento: z.string().trim().min(1), quantidade: z.string().trim().min(1) });
const ComponenteProdutoSchema = z.object({
  descricao: z.string().trim().min(2, "Informe a descrição da peça").max(240),
  madeiraNome: z.string().trim().max(200).nullable().optional(),
  espessura: z.string().trim().max(30).nullable().optional(),
  largura: z.string().trim().max(30).nullable().optional(),
  comprimento: z.string().trim().max(30).nullable().optional(),
  quantidade: z.number().int().positive("Informe a quantidade da peça"),
});
const ProdutoComercialSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do produto").max(200),
  tipoComercializacao: z.enum(["unidade", "pacote"]),
  precoPadrao: z.union([z.string(), z.number()]).transform((valor) => String(valor).replace(",", ".")).refine((valor) => Number(valor) >= 0, "Informe um preço válido"),
  observacoes: z.string().trim().max(4000).nullable().optional(),
  componentes: z.array(ComponenteProdutoSchema).max(60).default([]),
}).superRefine((produto, ctx) => {
  if (produto.tipoComercializacao === "pacote" && produto.componentes.length === 0) {
    ctx.addIssue({ code: "custom", path: ["componentes"], message: "Informe ao menos uma peça que compõe o pacote" });
  }
});

function parseDataFinanceira(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

async function garantirVendaDaEmpresa(id: number, empresaId: number) {
  const venda = await db.getOrcamentoById(id);
  if (!venda) throw new Error("Venda não encontrada para a empresa ativa");
  return venda;
}

export const orcamentoRouter = router({
  produtosComerciais: router({
    list: protectedProcedure.input(z.object({ incluirInativos: z.boolean().default(false) }).optional())
      .query(({ ctx, input }) => db.listProdutosComerciais(input?.incluirInativos ?? false)),
    create: protectedProcedure.input(ProdutoComercialSchema).mutation(({ ctx, input }) => (
      db.createProdutoComercial({
        empresaId: ctx.configuracaoEmpresa.id,
        nome: input.nome,
        tipoComercializacao: input.tipoComercializacao,
        precoPadrao: input.precoPadrao,
        observacoes: input.observacoes ?? null,
        ativo: true,
        criadoPor: ctx.user.id,
      }, input.componentes)
    )),
    update: protectedProcedure.input(ProdutoComercialSchema.partial().extend({
      id: z.number().int().positive(),
      componentes: z.array(ComponenteProdutoSchema).max(60).optional(),
    })).mutation(({ ctx, input }) => {
      const { id, componentes, ...dados } = input;
      return db.updateProdutoComercial(id, dados, componentes);
    }),
    archive: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => (
      db.updateProdutoComercial(input.id, { ativo: false }, undefined)
    )),
  }),

  list: protectedProcedure
    .input(z.object({
      estado: z.enum(["rascunho", "enviado", "aprovado", "rejeitado"]).optional(),
      clienteId: z.number().optional(),
      categoria: z.enum(["aprovadas", "pagas", "entregues", "concluidas"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      return db.listOrcamentos(input);
    }),

  resumoFilas: protectedProcedure
    .query(({ ctx }) => db.getResumoFilasVendas()),

  relatorioMargem: protectedProcedure
    .query(({ ctx }) => db.getRelatorioMargemVendas()),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getOrcamentoWithItems(input.id);
    }),

  condicaoPagamento: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const condicao = await db.getCondicaoPagamentoVenda(input.id);
      if (!condicao) throw new Error("Venda não encontrada para a empresa ativa");
      return condicao;
    }),

  create: protectedProcedure
    .input(z.object({
      clienteId: z.number(),
      estado: z.enum(["rascunho", "enviado", "aprovado", "rejeitado"]).default("rascunho"),
      desconto: z.string().default("0"),
      frete: z.string().default("0"),
      fretePorTonelada: z.string().default("0"),
      pesoCargaToneladas: z.string().default("0"),
      abatimentoFrete: z.string().default("0"),
      baseAposFrete: z.string().default("0"),
      comissaoTipo: z.enum(["percentual", "fixo"]).default("percentual"),
      comissaoValor: z.string().default("0"),
      comissaoCalculada: z.string().default("0"),
      taxaDescricao: z.string().max(120).optional(),
      taxaTipo: z.enum(["percentual", "fixo"]).default("percentual"),
      taxaValor: z.string().default("0"),
      taxaCalculada: z.string().default("0"),
      taxasAdicionais: z.array(TaxaAdicionalVendaSchema).max(20).default([]),
      subtotal: z.string(),
      total: z.string(),
      totalPecas: z.number(),
      totalMetroLinear: z.string(),
      totalVolume: z.string(),
      observacoes: z.string().optional(),
      vendedor: z.string().optional(),
      dataVencimento: DataFinanceiraSchema.optional(),
      competencia: DataFinanceiraSchema.optional(),
      itens: z.array(ItemSchema),
      aproveitamentos: z.array(AproveitamentoVendaSchema).max(30).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const estadoInicial = input.estado === "aprovado" ? "rascunho" : input.estado;
      const itensComComposicaoNormalizada = input.itens.map((item) => ({
        ...item,
        unidadesPorComercializacao: item.tipoComercializacao === "pacote"
          ? item.componentesPacote.reduce((total, componente) => total + componente.quantidade, 0)
          : item.tipoComercializacao === "unidade" ? 1 : 0,
      }));
      const baseAposFrete = Number(input.baseAposFrete.replace(",", ".")) || 0;
      const taxasAdicionais = input.taxasAdicionais.map((taxa, ordem) => {
        const valor = Number(taxa.valor);
        const calculado = taxa.tipo === "percentual" ? baseAposFrete * valor / 100 : valor;
        return { ...taxa, calculado: calculado.toFixed(2), ordem };
      });
      const orcamento = await db.createOrcamento(
        {
          numero: null,
          clienteId: input.clienteId,
          estado: estadoInicial,
          desconto: input.desconto,
          frete: input.frete,
          fretePorTonelada: input.fretePorTonelada,
          pesoCargaToneladas: input.pesoCargaToneladas,
          abatimentoFrete: input.abatimentoFrete,
          baseAposFrete: input.baseAposFrete,
          comissaoTipo: input.comissaoTipo,
          comissaoValor: input.comissaoValor,
          comissaoCalculada: input.comissaoCalculada,
          taxaDescricao: input.taxaDescricao ?? null,
          taxaTipo: input.taxaTipo,
          taxaValor: input.taxaValor,
          taxaCalculada: input.taxaCalculada,
          subtotal: input.subtotal,
          total: input.total,
          totalPecas: input.totalPecas,
          totalMetroLinear: input.totalMetroLinear,
          totalVolume: input.totalVolume,
          observacoes: input.observacoes ?? null,
          vendedor: input.vendedor ?? null,
          criadoPor: ctx.user.id,
          empresaId: ctx.configuracaoEmpresa.id,
          dataVencimento: input.dataVencimento ? parseDataFinanceira(input.dataVencimento) : now,
          competencia: input.competencia ? parseDataFinanceira(input.competencia) : now,
        },
        itensComComposicaoNormalizada,
        input.aproveitamentos,
        taxasAdicionais,
      );
      if (input.estado === "aprovado") {
        await db.updateOrcamentoEstado(orcamento.id, "aprovado", ctx.user.id);
      }
      return orcamento;
    }),

  updateEstado: protectedProcedure
    .input(z.object({
      id: z.number(),
      estado: z.enum(["rascunho", "enviado", "aprovado", "rejeitado"]),
      confirmacaoDupla: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await garantirVendaDaEmpresa(input.id, ctx.configuracaoEmpresa.id);
      await db.updateOrcamentoEstado(input.id, input.estado, ctx.user.id, input.confirmacaoDupla);
      if (input.estado === "aprovado") {
        await db.criarTituloReceberDeOrcamento(input.id, ctx.user.id, undefined);
      }
      return { success: true };
    }),

  atualizarDatas: protectedProcedure
    .input(z.object({
      id: z.number(),
      dataVencimento: DataFinanceiraSchema,
      competencia: DataFinanceiraSchema,
      confirmacaoDupla: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await garantirVendaDaEmpresa(input.id, ctx.configuracaoEmpresa.id);
      return db.atualizarDatasOrcamento(input.id, {
        dataVencimento: parseDataFinanceira(input.dataVencimento),
        competencia: parseDataFinanceira(input.competencia),
      }, input.confirmacaoDupla);
    }),

  configurarCondicaoPagamento: protectedProcedure
    .input(CondicaoPagamentoVendaSchema)
    .mutation(async ({ ctx, input }) => {
      await garantirVendaDaEmpresa(input.id, ctx.configuracaoEmpresa.id);
      return db.configurarCondicaoPagamentoVenda(
        input.id,
        input.parcelas.map((parcela) => ({ dataVencimento: parseDataFinanceira(parcela.dataVencimento) })),
        ctx.user.id,
      );
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number(), confirmacaoDupla: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      await garantirVendaDaEmpresa(input.id, ctx.configuracaoEmpresa.id);
      await db.deleteOrcamento(input.id, input.confirmacaoDupla, ctx.user.id);
      return { success: true };
    }),

  registrarPagamento: protectedProcedure
    .input(RegistroPagamentoSchema)
    .mutation(async ({ ctx, input }) => {
      await garantirVendaDaEmpresa(input.id, ctx.configuracaoEmpresa.id);
      const dataPagamento = parseDataFinanceira(input.pagoEm);
      return db.registrarPagamentoOrcamento(input.id, ctx.user.id, input.formaPagamento, dataPagamento);
    }),

  entregarFisicamente: protectedProcedure
    .input(RegistroEntregaFisicaSchema)
    .mutation(async ({ ctx, input }) => {
      await garantirVendaDaEmpresa(input.id, ctx.configuracaoEmpresa.id);
      return db.entregarVendaFisicamente(input.id, ctx.user.id, {
        entregueEm: parseDataFinanceira(input.entregueEm),
        modalidadeEntrega: input.modalidadeEntrega,
        responsavelEntrega: input.responsavelEntrega,
        observacoesEntrega: input.observacoesEntrega,
        aproveitamentos: input.aproveitamentos,
      });
    }),

  estornarEntrega: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), motivo: z.string().trim().min(3, "Informe o motivo do estorno") }))
    .mutation(async ({ ctx, input }) => {
      await garantirVendaDaEmpresa(input.id, ctx.configuracaoEmpresa.id);
      return db.estornarEntregaVenda(input.id, ctx.user.id, input.motivo);
    }),

  modelosMedida: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const modelos = await db.listModelosMedidaVenda();
      return modelos.map((modelo) => ({
        ...modelo,
        comprimentos: JSON.parse(modelo.comprimentos) as Array<{ comprimento: string; quantidade: string }>,
      }));
    }),
    create: protectedProcedure.input(z.object({
      nome: z.string().trim().min(2).max(120),
      madeiraId: z.number().int().positive().nullable(),
      madeiraNome: z.string().trim().min(2).max(200),
      precoM3: z.string().trim().min(1),
      espessuraCm: z.string().trim().min(1),
      larguraCm: z.string().trim().min(1),
      comprimentos: z.array(LinhaModeloSchema).min(1),
    })).mutation(async ({ ctx, input }) => {
      const id = await db.createModeloMedidaVenda({
        ...input,
        comprimentos: JSON.stringify(input.comprimentos),
        criadoPor: ctx.user.id,
        empresaId: ctx.configuracaoEmpresa.id,
      });
      return { id };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => db.deleteModeloMedidaVenda(input.id, ctx.user.id)),
  }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await garantirVendaDaEmpresa(input.id, ctx.configuracaoEmpresa.id);
      return db.duplicateOrcamento(input.id);
    }),
});
