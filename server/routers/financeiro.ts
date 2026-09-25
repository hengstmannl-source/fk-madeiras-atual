import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import * as centrosCusto from "../repositories/centrosCusto";
import { obterRentabilidadeVendas, obterResumoRentabilidadeFinanceira } from "../repositories/rentabilidadeFinanceira";
import { calcularParcelas } from "../financeiro.logic";
import { storagePut } from "../storage";
import { normalizarDadosBoleto } from "../../shared/boleto";

export const TipoTituloSchema = z.enum(["receber", "pagar"]);
export const FormaPagamentoFinanceiraSchema = z.enum([
  "pix", "dinheiro", "cheque", "cartao_credito", "cartao_debito", "transferencia", "boleto", "outro",
]);
export const DataFinanceiraSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida");
const FormatoExtratoBancarioSchema = z.enum(["csv", "ofx"]);
const EstadoMovimentoBancarioSchema = z.enum(["pendente", "conciliado", "ignorado", "divergente"]);

function dataLocal(data: string): Date {
  const [ano, mes, dia] = data.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0);
}

function fimDoDiaLocal(data: string): Date {
  const resultado = dataLocal(data);
  resultado.setHours(23, 59, 59, 999);
  return resultado;
}

function adicionarMeses(data: Date, meses: number): Date {
  const proxima = new Date(data);
  proxima.setMonth(proxima.getMonth() + meses);
  return proxima;
}

const MIME_TYPES_ANEXO = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const TIPOS_ANEXO_FINANCEIRO = z.enum(["nota_fiscal", "boleto", "comprovante", "outro"]);

function assinaturaValidaAnexo(mimeType: string, bytes: Buffer): boolean {
  if (mimeType === "application/pdf") return bytes.subarray(0, 4).toString() === "%PDF";
  if (mimeType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/webp") return bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  return false;
}

function nomeSeguroAnexo(nome: string) {
  return nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "documento";
}

export const LancamentoManualSchema = z.object({
  tipo: TipoTituloSchema,
  descricao: z.string().trim().min(2, "Informe uma descrição"),
  categoriaId: z.number().int().positive(),
  centroCustoId: z.number().int().positive().nullable().optional(),
  valorOriginal: z.string().regex(/^\d+(?:[.,]\d{1,2})?$/, "Informe um valor válido"),
  dataEmissao: DataFinanceiraSchema,
  dataVencimento: DataFinanceiraSchema,
  clienteId: z.number().int().positive().nullable().optional(),
  fornecedorId: z.number().int().positive().nullable().optional(),
  contraparteNome: z.string().trim().max(300).nullable().optional(),
  desconto: z.string().regex(/^\d+(?:[.,]\d{1,2})?$/).optional(),
  juros: z.string().regex(/^\d+(?:[.,]\d{1,2})?$/).optional(),
  observacoes: z.string().max(4000).nullable().optional(),
});

const AtualizarAgendamentoSchema = z.object({
  id: z.number().int().positive(),
  dataVencimento: DataFinanceiraSchema,
});

const AtualizarTitulosEmLoteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1, "Selecione ao menos um lançamento").max(200, "Edite no máximo 200 lançamentos por vez"),
  descricao: z.string().trim().min(2).max(300).optional(),
  categoriaId: z.number().int().positive().optional(),
  centroCustoId: z.number().int().positive().nullable().optional(),
  dataEmissao: DataFinanceiraSchema.optional(),
  dataVencimento: DataFinanceiraSchema.optional(),
  contraparteNome: z.string().trim().max(300).nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
}).refine((input) => Object.keys(input).some((chave) => chave !== "ids"), {
  message: "Informe ao menos um campo para atualizar",
});

const FornecedorSchema = z.object({
  nome: z.string().trim().min(2).max(300),
  contacto: z.string().trim().max(100).nullable().optional(),
  email: z.string().email().max(300).nullable().optional(),
  documento: z.string().trim().max(30).nullable().optional(),
  endereco: z.string().max(3000).nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
});

const CategoriaSchema = z.object({
  nome: z.string().trim().min(2).max(150),
  tipo: z.enum(["receita", "despesa", "ambos"]).default("ambos"),
  categoriaPaiId: z.number().int().positive().nullable().optional(),
});

const CentroCustoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do Centro de Custo.").max(150),
  tipo: z.enum(["industrial", "comercial_administrativo", "nao_apropriavel"]),
  observacoes: z.string().trim().max(4000).nullable().optional(),
});

export const ContaSchema = z.object({
  nome: z.string().trim().min(2).max(150),
  tipo: z.enum(["caixa", "caixa_cheque", "banco", "carteira", "outro"]).default("caixa"),
  banco: z.string().trim().max(150).nullable().optional(),
  agencia: z.string().trim().max(40).nullable().optional(),
  numeroConta: z.string().trim().max(60).nullable().optional(),
  dataInicio: DataFinanceiraSchema.nullable().optional(),
  saldoInicial: z.string().regex(/^-?\d+(?:[.,]\d{1,2})?$/).default("0"),
  observacoes: z.string().max(4000).nullable().optional(),
});

export const TransferenciaFinanceiraSchema = z.object({
  contaOrigemId: z.number().int().positive(),
  contaDestinoId: z.number().int().positive(),
  valor: z.string().regex(/^\d+(?:[.,]\d{1,2})?$/, "Informe um valor válido"),
  dataTransferencia: DataFinanceiraSchema,
  descricao: z.string().trim().max(300).nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
});

export const RecorrenciaSchema = z.object({
  tipo: TipoTituloSchema,
  descricao: z.string().trim().min(2).max(300),
  categoriaId: z.number().int().positive(),
  centroCustoId: z.number().int().positive().nullable().optional(),
  contaFinanceiraId: z.number().int().positive().nullable().optional(),
  clienteId: z.number().int().positive().nullable().optional(),
  fornecedorId: z.number().int().positive().nullable().optional(),
  contraparteNome: z.string().trim().max(300).nullable().optional(),
  valor: z.string().regex(/^\d+(?:[.,]\d{1,2})?$/, "Informe um valor válido"),
  frequencia: z.enum(["semanal", "mensal", "trimestral", "semestral", "anual"]),
  proximoVencimento: DataFinanceiraSchema,
  dataFim: DataFinanceiraSchema.nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
});

export const financeiroRouter = router({
  fornecedores: router({
    list: protectedProcedure.query(({ ctx }) => db.listFornecedores()),
    modeloCsv: protectedProcedure.query(() => db.getModeloImportacaoFornecedoresCsv()),
    prepararImportacaoCsv: protectedProcedure.input(z.object({
      conteudo: z.string().min(1, "Selecione um arquivo CSV").max(1_000_000, "O arquivo excede o limite de 1 MB"),
    })).mutation(({ ctx, input }) => db.prepararImportacaoFornecedoresCsv(input.conteudo, { empresaId: ctx.configuracaoEmpresa.id })),
    importarCsv: protectedProcedure.input(z.object({
      conteudo: z.string().min(1, "Selecione um arquivo CSV").max(1_000_000, "O arquivo excede o limite de 1 MB"),
    })).mutation(({ ctx, input }) => db.importarFornecedoresCsv(input.conteudo, ctx.user.id)),
    create: protectedProcedure.input(FornecedorSchema).mutation(({ ctx, input }) => (
      db.createFornecedor({ ...input, criadoPor: ctx.user.id, ativo: true, empresaId: ctx.configuracaoEmpresa.id })
    )),
    update: protectedProcedure.input(FornecedorSchema.partial().extend({ id: z.number().int().positive() })).mutation(({ ctx, input }) => {
      const { id, ...dados } = input;
      return db.updateFornecedor(id, dados);
    }),
    archive: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => db.archiveFornecedor(input.id)),
  }),

  categorias: router({
    list: protectedProcedure.query(({ ctx }) => db.listCategoriasFinanceiras()),
    create: protectedProcedure.input(CategoriaSchema).mutation(({ ctx, input }) => (
      db.createCategoriaFinanceira({ ...input, criadoPor: ctx.user.id, ativo: true, empresaId: ctx.configuracaoEmpresa.id })
    )),
    update: protectedProcedure.input(CategoriaSchema.partial().extend({ id: z.number().int().positive() })).mutation(({ ctx, input }) => {
      const { id, ...dados } = input;
      return db.updateCategoriaFinanceira(id, dados);
    }),
  }),

  centrosCusto: router({
    list: protectedProcedure.input(z.object({ incluirInativos: z.boolean().optional() }).optional())
      .query(({ input }) => centrosCusto.listarCentrosCusto(input?.incluirInativos)),
    create: protectedProcedure.input(CentroCustoSchema)
      .mutation(({ ctx, input }) => centrosCusto.criarCentroCusto({ ...input, criadoPor: ctx.user.id })),
    update: protectedProcedure.input(CentroCustoSchema.partial().extend({ id: z.number().int().positive(), ativo: z.boolean().optional() })
      .refine((input) => Object.keys(input).some((chave) => chave !== "id"), "Informe ao menos um campo para atualizar."))
      .mutation(({ input }) => centrosCusto.atualizarCentroCusto(input)),
  }),

  rentabilidade: router({
    resumo: protectedProcedure.input(z.object({ competencia: DataFinanceiraSchema }))
      .query(({ input }) => obterResumoRentabilidadeFinanceira(dataLocal(input.competencia))),
    vendas: protectedProcedure.input(z.object({ competencia: DataFinanceiraSchema }))
      .query(({ input }) => obterRentabilidadeVendas(dataLocal(input.competencia))),
  }),

  contas: router({
    list: protectedProcedure.query(({ ctx }) => db.listContasFinanceiras()),
    create: protectedProcedure.input(ContaSchema).mutation(({ ctx, input }) => (
      db.createContaFinanceira({
        ...input,
        dataInicio: input.dataInicio ? dataLocal(input.dataInicio) : null,
        saldoInicial: input.saldoInicial.replace(",", "."),
        criadoPor: ctx.user.id,
        ativa: true,
        empresaId: ctx.configuracaoEmpresa.id,
      })
    )),
    update: protectedProcedure.input(ContaSchema.partial().extend({ id: z.number().int().positive() })).mutation(({ ctx, input }) => {
      const { id, saldoInicial, dataInicio, ...dados } = input;
      return db.updateContaFinanceira(id, {
        ...dados,
        ...(dataInicio !== undefined ? { dataInicio: dataInicio ? dataLocal(dataInicio) : null } : {}),
        ...(saldoInicial !== undefined ? { saldoInicial: saldoInicial.replace(",", ".") } : {}),
      });
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => (
      db.excluirContaFinanceira(input.id)
    )),
  }),

  transferencias: router({
    list: protectedProcedure.input(z.object({
      contaFinanceiraId: z.number().int().positive().optional(),
      incluirEstornadas: z.boolean().optional(),
    }).optional()).query(({ ctx, input }) => db.listTransferenciasFinanceiras(input ?? {})),
    movimentosPorConta: protectedProcedure.input(z.object({ contaFinanceiraId: z.number().int().positive() }))
      .query(({ ctx, input }) => db.listMovimentosTransferenciasPorConta(input.contaFinanceiraId)),
    create: protectedProcedure.input(TransferenciaFinanceiraSchema).mutation(({ ctx, input }) => db.criarTransferenciaFinanceira({
      ...input,
      valor: input.valor.replace(",", "."),
      dataTransferencia: dataLocal(input.dataTransferencia),
      criadoPor: ctx.user.id,
    })),
    estornar: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      motivo: z.string().trim().min(3, "Informe o motivo do estorno").max(4000),
    })).mutation(({ ctx, input }) => db.estornarTransferenciaFinanceira({
      ...input,
      estornadoPor: ctx.user.id,
    })),
  }),

  cheques: router({
    resumo: protectedProcedure.query(({ ctx }) => db.getResumoCaixaCheque()),
    list: protectedProcedure.input(z.object({
      contaFinanceiraId: z.number().int().positive().optional(),
      estado: z.enum(["disponivel", "utilizado", "estornado", "depositado"]).optional(),
    }).optional()).query(({ ctx, input }) => db.listChequesFinanceiros(input ?? {})),
    depositar: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      contaDestinoId: z.number().int().positive(),
      dataDeposito: DataFinanceiraSchema,
    })).mutation(({ ctx, input }) => db.depositarChequeFinanceiro({
      ...input,
      dataDeposito: dataLocal(input.dataDeposito),
    })),
    historicoDepositos: protectedProcedure.input(z.object({
      contaFinanceiraId: z.number().int().positive().optional(),
    }).optional()).query(({ ctx, input }) => db.listHistoricoDepositosPorConta(input?.contaFinanceiraId)),
  }),

  alertas: router({
    list: protectedProcedure.query(({ ctx }) => db.listAlertasFinanceiros()),
  }),

  relatorios: router({
    fluxoCaixa: protectedProcedure.input(z.object({
      dataInicio: DataFinanceiraSchema,
      dataFim: DataFinanceiraSchema,
    }).refine((periodo) => periodo.dataInicio <= periodo.dataFim, {
      message: "A data inicial não pode ser posterior à data final",
      path: ["dataFim"],
    })).query(({ input }) => db.getRelatorioFluxoCaixa({
      dataInicio: dataLocal(input.dataInicio),
      dataFim: fimDoDiaLocal(input.dataFim),
    })),
    previsaoSemanal: protectedProcedure.input(z.object({
      semanas: z.number().int().min(1).max(26).default(8),
    }).default({ semanas: 8 })).query(({ input }) => db.getPrevisaoSemanalCaixa(input.semanas)),
    fluxoGerencial: protectedProcedure.input(z.object({
      dataInicio: DataFinanceiraSchema,
      dataFim: DataFinanceiraSchema,
      contaFinanceiraId: z.number().int().positive().optional(),
    }).refine((periodo) => periodo.dataInicio <= periodo.dataFim, {
      message: "A data inicial não pode ser posterior à data final",
      path: ["dataFim"],
    })).query(({ input }) => db.getFluxoCaixaGerencial({
      dataInicio: dataLocal(input.dataInicio),
      dataFim: fimDoDiaLocal(input.dataFim),
      contaFinanceiraId: input.contaFinanceiraId,
    })),
  }),

  contasOperacionais: router({
    list: protectedProcedure.input(z.object({
      tipo: TipoTituloSchema,
      estado: z.enum(["aberto", "parcial"]).optional(),
      situacao: z.enum(["vencido", "vence_hoje", "proximos_7_dias", "proximos_30_dias", "a_vencer"]).optional(),
      aging: z.enum(["a_vencer", "vence_hoje", "1_7", "8_30", "31_60", "61_90", "mais_90"]).optional(),
      clienteId: z.number().int().positive().optional(),
      fornecedorId: z.number().int().positive().optional(),
      categoriaId: z.number().int().positive().optional(),
      origem: z.enum(["orcamento", "romaneio_carga", "nota_diesel", "serragem_terceiros", "folha_pagamento", "manual", "recorrencia"]).optional(),
      descricao: z.string().trim().min(1).max(300).optional(),
      valorMinimo: z.number().nonnegative().optional(),
      valorMaximo: z.number().nonnegative().optional(),
      dataInicio: DataFinanceiraSchema.optional(),
      dataFim: DataFinanceiraSchema.optional(),
      contaFinanceiraId: z.number().int().positive().optional(),
      ordenar: z.enum(["prioridade", "vencimento_asc", "vencimento_desc", "saldo_desc", "contraparte"]).default("prioridade"),
    }).refine((filtro) => !filtro.dataInicio || !filtro.dataFim || filtro.dataInicio <= filtro.dataFim, {
      message: "A data inicial não pode ser posterior à data final",
      path: ["dataFim"],
    })).query(({ ctx, input }) => {
      const { dataInicio, dataFim, ...filtros } = input;
      return db.getContasOperacionais({
        ...filtros,
        dataInicio: dataInicio ? dataLocal(dataInicio) : undefined,
        dataFim: dataFim ? fimDoDiaLocal(dataFim) : undefined,
      }, { empresaId: ctx.configuracaoEmpresa.id });
    }),
  }),

  intercambios: router({
    modeloLancamentosCsv: protectedProcedure.query(() => db.getModeloImportacaoLancamentosCsv()),
    exportarLancamentosCsv: protectedProcedure.input(z.object({
      tipo: TipoTituloSchema.optional(),
    }).optional()).query(({ ctx, input }) => db.exportarLancamentosFinanceirosCsv(input)),
    importarLancamentosCsv: protectedProcedure.input(z.object({
      conteudo: z.string().min(1, "Selecione um arquivo CSV").max(1_000_000, "O arquivo excede o limite de 1 MB"),
    })).mutation(({ ctx, input }) => db.importarLancamentosFinanceirosCsv(input.conteudo, ctx.user.id)),
  }),

  conciliacao: router({
    modeloCsv: protectedProcedure.query(() => db.getModeloImportacaoExtratoBancarioCsv()),
    prepararImportacao: protectedProcedure.input(z.object({
      conteudo: z.string().min(1, "Selecione um extrato").max(1_000_000, "O arquivo excede o limite de 1 MB"),
      formato: FormatoExtratoBancarioSchema,
    })).mutation(({ input }) => db.prepararImportacaoExtratoBancario(input.conteudo, input.formato)),
    importar: protectedProcedure.input(z.object({
      contaFinanceiraId: z.number().int().positive(),
      nomeArquivo: z.string().trim().min(1).max(300),
      formato: FormatoExtratoBancarioSchema,
      conteudo: z.string().min(1, "Selecione um extrato").max(1_000_000, "O arquivo excede o limite de 1 MB"),
    })).mutation(({ ctx, input }) => db.importarExtratoBancario(input, ctx.user.id)),
    list: protectedProcedure.input(z.object({
      contaFinanceiraId: z.number().int().positive().optional(),
      estado: EstadoMovimentoBancarioSchema.optional(),
    }).optional()).query(({ ctx, input }) => db.listConciliacaoBancaria(input)),
    confirmar: protectedProcedure.input(z.object({
      movimentoId: z.number().int().positive(),
      baixaFinanceiraId: z.number().int().positive(),
    })).mutation(({ ctx, input }) => db.confirmarConciliacaoBancaria(input, ctx.user.id)),
    confirmarTransferencia: protectedProcedure.input(z.object({
      movimentoId: z.number().int().positive(),
      movimentoTransferenciaFinanceiraId: z.number().int().positive(),
    })).mutation(({ ctx, input }) => db.confirmarConciliacaoTransferenciaBancaria(input, ctx.user.id)),
    desfazer: protectedProcedure.input(z.object({
      movimentoId: z.number().int().positive(),
      motivo: z.string().trim().max(1000).optional(),
    })).mutation(({ ctx, input }) => db.desfazerConciliacaoBancaria(input.movimentoId, ctx.user.id, input.motivo)),
    criarLancamento: protectedProcedure.input(z.object({
      movimentoId: z.number().int().positive(),
      categoriaId: z.number().int().positive(),
      centroCustoId: z.number().int().positive().nullable().optional(),
      descricao: z.string().trim().min(2).max(300),
      observacoes: z.string().trim().max(4000).nullable().optional(),
    })).mutation(({ ctx, input }) => db.criarLancamentoDaConciliacao(input, ctx.user.id)),
    definirEstado: protectedProcedure.input(z.object({
      movimentoId: z.number().int().positive(),
      estado: z.enum(["ignorado", "divergente"]),
      observacoes: z.string().trim().max(4000).nullable().optional(),
    })).mutation(({ ctx, input }) => db.definirEstadoMovimentoBancario(input, ctx.user.id)),
  }),

  titulos: router({
    list: protectedProcedure.input(z.object({
      tipo: TipoTituloSchema.optional(),
      estado: z.enum(["aberto", "parcial", "quitado", "vencido", "cancelado"]).optional(),
      origem: z.enum(["orcamento", "romaneio_carga", "nota_diesel", "serragem_terceiros", "folha_pagamento", "manual", "recorrencia"]).optional(),
      clienteId: z.number().int().positive().optional(),
      fornecedorId: z.number().int().positive().optional(),
      categoriaId: z.number().int().positive().optional(),
      centroCustoId: z.number().int().positive().optional(),
      descricao: z.string().trim().min(1).max(300).optional(),
      valorMinimo: z.number().nonnegative().optional(),
      valorMaximo: z.number().nonnegative().optional(),
      dataInicio: z.date().optional(),
      dataFim: z.date().optional(),
      criterioData: z.enum(["vencimento", "baixa"]).default("vencimento"),
    }).optional()).query(({ ctx, input }) => db.listTitulosFinanceiros(input, { empresaId: ctx.configuracaoEmpresa.id })),

    createManual: protectedProcedure.input(LancamentoManualSchema).mutation(({ ctx, input }) => (
      db.createTituloFinanceiro({
        ...input,
        origem: "manual",
        valorOriginal: input.valorOriginal.replace(",", "."),
        desconto: input.desconto?.replace(",", "."),
        juros: input.juros?.replace(",", "."),
        dataEmissao: dataLocal(input.dataEmissao),
        dataVencimento: dataLocal(input.dataVencimento),
        criadoPor: ctx.user.id,
        empresaId: ctx.configuracaoEmpresa.id,
      })
    )),

    createParcelado: protectedProcedure.input(LancamentoManualSchema.extend({
      quantidadeParcelas: z.number().int().min(2).max(120),
    })).mutation(async ({ ctx, input }) => {
      const valores = calcularParcelas(input.valorOriginal.replace(",", "."), input.quantidadeParcelas);
      const grupoParcelamento = `PARC-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const vencimentoInicial = dataLocal(input.dataVencimento);
      const titulos = await Promise.all(valores.map((valorOriginal, indice) => (
        db.createTituloFinanceiro({
          ...input,
          origem: "manual",
          valorOriginal,
          desconto: indice === 0 ? input.desconto?.replace(",", ".") : "0",
          juros: indice === 0 ? input.juros?.replace(",", ".") : "0",
          dataEmissao: dataLocal(input.dataEmissao),
          dataVencimento: adicionarMeses(vencimentoInicial, indice),
          grupoParcelamento,
          numeroParcela: indice + 1,
          totalParcelas: input.quantidadeParcelas,
          criadoPor: ctx.user.id,
          empresaId: ctx.configuracaoEmpresa.id,
        })
      )));
      return { grupoParcelamento, titulos };
    }),

    updateAgendamento: protectedProcedure.input(AtualizarAgendamentoSchema).mutation(({ input }) => (
      db.atualizarAgendamentoFinanceiro({
        id: input.id,
        dataVencimento: dataLocal(input.dataVencimento),
      })
    )),

    update: protectedProcedure.input(LancamentoManualSchema.extend({ id: z.number().int().positive() })).mutation(({ ctx, input }) => {
      const { id, ...dados } = input;
      return db.atualizarTituloFinanceiro(id, {
        ...dados,
        valorOriginal: dados.valorOriginal.replace(",", "."),
        desconto: dados.desconto?.replace(",", "."),
        juros: dados.juros?.replace(",", "."),
        dataEmissao: dataLocal(dados.dataEmissao),
        dataVencimento: dataLocal(dados.dataVencimento),
      });
    }),

    updateEmLote: protectedProcedure.input(AtualizarTitulosEmLoteSchema).mutation(({ ctx, input }) => {
      const { ids, dataEmissao, dataVencimento, ...dados } = input;
      return db.atualizarTitulosFinanceirosEmLote(ids, {
        ...dados,
        ...(dataEmissao ? { dataEmissao: dataLocal(dataEmissao) } : {}),
        ...(dataVencimento ? { dataVencimento: dataLocal(dataVencimento) } : {}),
      });
    }),

    baixas: protectedProcedure.input(z.object({ tituloId: z.number().int().positive() })).query(({ ctx, input }) => db.listBaixasFinanceiras(input.tituloId)),
    baixar: protectedProcedure.input(z.object({
      tituloId: z.number().int().positive(),
      contaFinanceiraId: z.number().int().positive(),
      valor: z.string().regex(/^\d+(?:[.,]\d{1,2})?$/),
      dataBaixa: DataFinanceiraSchema,
      formaPagamento: FormaPagamentoFinanceiraSchema,
      observacoes: z.string().max(4000).optional(),
      chequesRecebidos: z.array(z.object({
        referencia: z.string().trim().min(1).max(120),
        valor: z.string().regex(/^\d+(?:[.,]\d{1,2})?$/),
        clienteId: z.number().int().positive().optional(),
        dataCompensacao: DataFinanceiraSchema.optional(),
      })).min(1).max(100).optional(),
      chequeIdsUtilizados: z.array(z.number().int().positive()).min(1).max(100).optional(),
    })).mutation(({ ctx, input }) => db.registrarBaixaFinanceira({
      ...input,
      valor: input.valor.replace(",", "."),
      dataBaixa: dataLocal(input.dataBaixa),
      chequesRecebidos: input.chequesRecebidos?.map((cheque) => ({
        ...cheque,
        valor: cheque.valor.replace(",", "."),
        dataCompensacao: cheque.dataCompensacao ? dataLocal(cheque.dataCompensacao) : null,
      })),
      criadoPor: ctx.user.id,
    })),
    conciliarBaixa: protectedProcedure.input(z.object({ id: z.number().int().positive(), conciliada: z.boolean() }))
      .mutation(({ ctx, input }) => db.conciliarBaixaFinanceira(input.id, input.conciliada)),
    estornarBaixa: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      motivo: z.string().trim().min(3, "Informe o motivo do estorno").max(2000),
    })).mutation(({ ctx, input }) => db.estornarBaixaFinanceira(input.id, ctx.user.id, input.motivo, undefined)),
    devolverCheque: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      motivo: z.string().trim().min(3, "Informe o motivo da devolução").max(2000),
      dataDevolucao: DataFinanceiraSchema,
    })).mutation(({ ctx, input }) => db.devolverChequeFinanceiro({
      ...input,
      dataDevolucao: dataLocal(input.dataDevolucao),
      userId: ctx.user.id,
    })),
    cancelar: protectedProcedure.input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => db.cancelarTituloFinanceiro(input.id, ctx.user.id, undefined)),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() }))
      .mutation(({ ctx, input }) => db.excluirTituloFinanceiro(input.id, ctx.user.id)),
  }),

  anexos: router({
    list: protectedProcedure.input(z.object({ tituloId: z.number().int().positive() }))
      .query(({ ctx, input }) => db.listAnexosFinanceiros(input.tituloId)),
    upload: protectedProcedure.input(z.object({
      tituloId: z.number().int().positive(),
      nomeArquivo: z.string().trim().min(1).max(300),
      mimeType: z.string().max(100),
      tamanhoBytes: z.number().int().positive().max(8 * 1024 * 1024),
      tipo: TIPOS_ANEXO_FINANCEIRO,
      base64: z.string().min(8).max(12_000_000),
    })).mutation(async ({ ctx, input }) => {
      if (!MIME_TYPES_ANEXO.has(input.mimeType)) throw new Error("Formato não permitido. Envie PDF, JPG, PNG ou WEBP.");
      const bytes = Buffer.from(input.base64, "base64");
      if (!bytes.length || bytes.length !== input.tamanhoBytes || !assinaturaValidaAnexo(input.mimeType, bytes)) {
        throw new Error("O conteúdo do arquivo não corresponde ao formato informado.");
      }
      const armazenado = await storagePut(
        `financeiro/titulo-${input.tituloId}/${Date.now()}-${nomeSeguroAnexo(input.nomeArquivo)}`,
        bytes,
        input.mimeType,
      );
      return db.createAnexoFinanceiro({
        tituloId: input.tituloId,
        nomeArquivo: input.nomeArquivo,
        mimeType: input.mimeType,
        tamanhoBytes: input.tamanhoBytes,
        tipo: input.tipo,
        storageKey: armazenado.key,
        url: armazenado.url,
        criadoPor: ctx.user.id,
      });
    }),
    remove: protectedProcedure.input(z.object({ id: z.number().int().positive(), tituloId: z.number().int().positive() }))
      .mutation(({ input }) => db.removerAnexoFinanceiro(input)),
    atualizarBoleto: protectedProcedure.input(z.object({
      tituloId: z.number().int().positive(),
      codigo: z.string().trim().max(200).nullable(),
    })).mutation(({ ctx, input }) => {
      const dados = input.codigo ? normalizarDadosBoleto(input.codigo) : { codigoBarras: null, linhaDigitavel: null };
      if (!dados) throw new Error("Informe um código de barras com 44 dígitos ou uma linha digitável com 47 ou 48 dígitos.");
      return db.atualizarDadosBoleto({
        tituloId: input.tituloId,
        codigoBarrasBoleto: dados.codigoBarras,
        linhaDigitavelBoleto: dados.linhaDigitavel,
      });
    }),
  }),

  recorrencias: router({
    list: protectedProcedure.query(() => db.listRecorrenciasFinanceiras()),
    create: protectedProcedure.input(RecorrenciaSchema).mutation(({ ctx, input }) => (
      db.createRecorrenciaFinanceira({
        ...input,
        valor: input.valor.replace(",", "."),
        proximoVencimento: dataLocal(input.proximoVencimento),
        dataFim: input.dataFim ? dataLocal(input.dataFim) : null,
        ativa: true,
        criadoPor: ctx.user.id,
        empresaId: ctx.configuracaoEmpresa.id,
      })
    )),
    update: protectedProcedure.input(RecorrenciaSchema.partial().extend({ id: z.number().int().positive(), ativa: z.boolean().optional() })).mutation(({ input }) => {
      const { id, valor, proximoVencimento, dataFim, ...dados } = input;
      return db.updateRecorrenciaFinanceira(id, {
        ...dados,
        ...(valor !== undefined ? { valor: valor.replace(",", ".") } : {}),
        ...(proximoVencimento !== undefined ? { proximoVencimento: dataLocal(proximoVencimento) } : {}),
        ...(dataFim !== undefined ? { dataFim: dataFim ? dataLocal(dataFim) : null } : {}),
      });
    }),
  }),
});
