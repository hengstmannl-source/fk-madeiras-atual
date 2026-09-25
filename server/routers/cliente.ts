import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { TRPCError } from "@trpc/server";

const chaveTexto = (valor?: string | null) => String(valor ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
const chaveDocumento = (valor?: string | null) => String(valor ?? "").replace(/\D/g, "");
const LinhaImportacaoSchema = z.object({
  linha: z.number().int().positive(),
  nome: z.string().trim(),
  contacto: z.string().optional().default(""),
  email: z.string().optional().default(""),
  morada: z.string().optional().default(""),
  nif: z.string().optional().default(""),
  observacoes: z.string().optional().default(""),
});
type LinhaImportacao = z.infer<typeof LinhaImportacaoSchema>;

async function validarImportacao(linhas: LinhaImportacao[]) {
  const existentes = await db.listAllClientes();
  const nomes = new Set(existentes.map(cliente => chaveTexto(cliente.nome)).filter(Boolean));
  const contactos = new Set(existentes.map(cliente => chaveDocumento(cliente.contacto)).filter(Boolean));
  const emails = new Set(existentes.map(cliente => chaveTexto(cliente.email)).filter(Boolean));
  const documentos = new Set(existentes.map(cliente => chaveDocumento(cliente.nif)).filter(Boolean));
  const resultado = linhas.map(linha => {
    const motivos: string[] = [];
    const nome = linha.nome.trim();
    const contacto = chaveDocumento(linha.contacto);
    const email = chaveTexto(linha.email);
    const nif = chaveDocumento(linha.nif);
    const chaveNome = chaveTexto(nome);
    if (!nome) motivos.push("Informe o nome do cliente");
    if (chaveNome && nomes.has(chaveNome)) motivos.push("Nome já cadastrado ou repetido na planilha");
    if (contacto && contactos.has(contacto)) motivos.push("Telefone já cadastrado ou repetido na planilha");
    if (email && emails.has(email)) motivos.push("E-mail já cadastrado ou repetido na planilha");
    if (nif && documentos.has(nif)) motivos.push("CPF/CNPJ já cadastrado ou repetido na planilha");
    const apta = motivos.length === 0;
    if (apta) {
      nomes.add(chaveNome);
      if (contacto) contactos.add(contacto);
      if (email) emails.add(email);
      if (nif) documentos.add(nif);
    }
    return { ...linha, apta, motivos };
  });
  return { linhas: resultado, aptas: resultado.filter(linha => linha.apta) };
}

export const clienteRouter = router({
  list: protectedProcedure.query(async () => {
    return db.listClientes();
  }),
  listAll: protectedProcedure.query(async () => {
    return db.listAllClientes();
  }),
  perfil: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const perfil = await db.getPerfilCliente(input.id);
      if (!perfil) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado" });
      return perfil;
    }),

  create: protectedProcedure
    .input(z.object({
      nome: z.string().min(1, "Nome é obrigatório"),
      contacto: z.string().optional(),
      email: z.string().optional(),
      morada: z.string().optional(),
      nif: z.string().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const empresaId = (await db.getEmpresaUnica()).id;
      const created = await db.createCliente({ ...input, criadoPor: ctx.user.id, empresaId });
      return { success: true, id: created.id || null };
    }),

  previsualizarImportacao: protectedProcedure
    .input(z.object({ linhas: z.array(LinhaImportacaoSchema).min(1).max(1000) }))
    .mutation(async ({ input }) => {
      const resultado = await validarImportacao(input.linhas);
      return {
        linhas: resultado.linhas,
        resumo: { total: resultado.linhas.length, aptas: resultado.aptas.length, recusadas: resultado.linhas.length - resultado.aptas.length },
      };
    }),

  importar: protectedProcedure
    .input(z.object({ linhas: z.array(LinhaImportacaoSchema).min(1).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const empresaId = (await db.getEmpresaUnica()).id;
      const resultado = await validarImportacao(input.linhas);
      for (const linha of resultado.aptas) {
        await db.createCliente({
          empresaId, criadoPor: ctx.user.id, nome: linha.nome.trim(), contacto: linha.contacto?.trim() || undefined,
          email: linha.email?.trim() || undefined, morada: linha.morada?.trim() || undefined,
          nif: linha.nif?.trim() || undefined, observacoes: linha.observacoes?.trim() || undefined,
        });
      }
      return {
        importadas: resultado.aptas.length,
        ignoradas: resultado.linhas.length - resultado.aptas.length,
        linhas: resultado.linhas,
      };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      nome: z.string().min(1),
      contacto: z.string().optional(),
      email: z.string().optional(),
      morada: z.string().optional(),
      nif: z.string().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.updateCliente(input.id, {
        nome: input.nome, contacto: input.contacto,
        email: input.email, morada: input.morada, nif: input.nif, observacoes: input.observacoes,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteCliente(input.id);
      return { success: true };
    }),
});
