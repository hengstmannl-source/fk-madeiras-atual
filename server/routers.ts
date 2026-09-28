import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { criarUrlPublica } from "./_core/publicUrl";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { COOKIE_SESSAO_LOCAL, criarSessaoLocal, DURACAO_SESSAO_LOCAL_MS, gerarHashSenha, normalizarEmail, validarSenha } from "./autenticacao-local";
import * as db from "./db";
import { madeiraRouter } from "./routers/madeira";
import { bitolaRouter } from "./routers/bitola";
import { clienteRouter } from "./routers/cliente";
import { orcamentoRouter } from "./routers/orcamento";
import { dashboardRouter } from "./routers/dashboard";
import { empresaRouter } from "./routers/empresa";
import { financeiroRouter } from "./routers/financeiro";
import { producaoRouter } from "./routers/producao";
import { dieselRouter } from "./routers/diesel";
import { rhRouter } from "./routers/rh";
import { custosGerenciaisRouter } from "./routers/custosGerenciais";
import { publicUser } from "./_core/publicUser";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => publicUser(opts.ctx.user)),
    contexto: protectedProcedure.query(async ({ ctx }) => ({
      usuario: publicUser(ctx.user),
      empresa: ctx.configuracaoEmpresa,
      papel: ctx.user.papel,
    })),
    entrar: publicProcedure
      .input(z.object({ email: z.string().trim().email().max(320), senha: z.string().min(1).max(200) }))
      .mutation(async ({ ctx, input }) => {
        const emailNormalizado = normalizarEmail(input.email);
        const acesso = await db.getCredencialPorEmail(emailNormalizado);
        const erroPadrao = new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
        if (!acesso || (acesso.credencial.bloqueadoAte && acesso.credencial.bloqueadoAte > new Date())) throw erroPadrao;
        if (!(await validarSenha(input.senha, acesso.credencial.senhaHash))) {
          const proximaTentativa = acesso.credencial.tentativasFalhas + 1;
          await db.registrarFalhaAutenticacao(acesso.credencial.id, proximaTentativa >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null);
          throw erroPadrao;
        }
        if (!acesso.usuario.papel) throw new TRPCError({ code: "FORBIDDEN", message: "O utilizador não possui um perfil operacional ativo." });
        await db.limparFalhasAutenticacao(acesso.credencial.id);
        const token = criarSessaoLocal(acesso.usuario.id);
        ctx.res.cookie(COOKIE_SESSAO_LOCAL, token, { ...getSessionCookieOptions(ctx.req), maxAge: DURACAO_SESSAO_LOCAL_MS });
        return { success: true, empresa: ctx.configuracaoEmpresa, papel: acesso.usuario.papel };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      ctx.res.clearCookie(COOKIE_SESSAO_LOCAL, cookieOptions);
      return { success: true } as const;
    }),
  }),
  equipe: router({
    listar: adminProcedure.query(() => db.listarUsuariosDoSistema()),
    criarConvite: adminProcedure
      .input(z.object({ email: z.string().email(), papel: z.enum(["administrador", "financeiro", "rh", "vendas", "producao", "consulta"]) }))
      .mutation(async ({ ctx, input }) => {
        const papelAtual = ctx.user.papel;
        if (papelAtual !== "proprietario" && papelAtual !== "administrador") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas proprietários e administradores podem convidar colaboradores." });
        }
        const token = randomBytes(32).toString("base64url");
        const tokenHash = createHash("sha256").update(token).digest("hex");
        let conviteUrl: string;
        try {
          conviteUrl = criarUrlPublica(ENV.publicBaseUrl, `/convite/${token}`);
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error instanceof Error ? error.message : "A origem pública do sistema não está configurada corretamente.",
          });
        }
        await db.criarConviteEmpresa({
          emailNormalizado: normalizarEmail(input.email),
          papel: input.papel,
          tokenHash,
          expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          convidadoPor: ctx.user.id,
        });
        return { success: true, conviteUrl, expiraEm: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) };
      }),
    consultarConvite: publicProcedure
      .input(z.object({ token: z.string().min(20).max(200) }))
      .query(async ({ input }) => {
        const convite = await db.getConviteValidoPorHash(createHash("sha256").update(input.token).digest("hex"));
        if (!convite) throw new TRPCError({ code: "NOT_FOUND", message: "Este convite é inválido ou expirou." });
        return { email: convite.convite.emailNormalizado, papel: convite.convite.papel };
      }),
    aceitarConvite: publicProcedure
      .input(z.object({ token: z.string().min(20).max(200), nome: z.string().trim().min(2).max(300), senha: z.string().min(8).max(200).regex(/[A-Z]/).regex(/[0-9]/) }))
      .mutation(async ({ ctx, input }) => {
        try {
          const criado = await db.aceitarConviteCriandoUsuario({
            tokenHash: createHash("sha256").update(input.token).digest("hex"),
            nome: input.nome,
            senhaHash: await gerarHashSenha(input.senha),
            openId: `local:${randomBytes(24).toString("hex")}`,
          });
          ctx.res.cookie(COOKIE_SESSAO_LOCAL, criarSessaoLocal(criado.usuarioId), { ...getSessionCookieOptions(ctx.req), maxAge: DURACAO_SESSAO_LOCAL_MS });
          return { success: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (message === "CONVITE_INVALIDO") throw new TRPCError({ code: "BAD_REQUEST", message: "Este convite é inválido ou expirou." });
          if (message === "EMAIL_JA_CADASTRADO") throw new TRPCError({ code: "CONFLICT", message: "Já existe uma conta com este e-mail." });
          throw error;
        }
      }),
  }),
  madeira: madeiraRouter,
  bitola: bitolaRouter,
  cliente: clienteRouter,
  orcamento: orcamentoRouter,
  dashboard: dashboardRouter,
  empresa: empresaRouter,
  financeiro: financeiroRouter,
  producao: producaoRouter,
  diesel: dieselRouter,
  rh: rhRouter,
  custosGerenciais: custosGerenciaisRouter,
});

export type AppRouter = typeof appRouter;
