import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

type ModuloOperacional = "financeiro" | "rh" | "vendas" | "producao";

const acessosPorModulo: Record<ModuloOperacional, readonly string[]> = {
  financeiro: ["proprietario", "administrador", "financeiro"],
  rh: ["proprietario", "administrador", "rh"],
  vendas: ["proprietario", "administrador", "vendas"],
  producao: ["proprietario", "administrador", "producao"],
};

const moduloDaRota: Record<string, ModuloOperacional> = {
  financeiro: "financeiro",
  custosGerenciais: "financeiro",
  rh: "rh",
  orcamento: "vendas",
  cliente: "vendas",
  producao: "producao",
  diesel: "producao",
  madeira: "producao",
  bitola: "producao",
};

export function mensagemDeBloqueioPorPerfil(params: { papel: string; papelPlataforma: string; caminho: string; tipo: "query" | "mutation" | "subscription" }) {
  const rotaPrincipal = params.caminho.split(".")[0];
  const modulo = moduloDaRota[rotaPrincipal];
  const usuarioPlataformaAdmin = params.papelPlataforma === "admin";
  if (modulo && !usuarioPlataformaAdmin && params.papel !== "consulta" && !acessosPorModulo[modulo].includes(params.papel)) {
    return "O seu perfil não tem acesso a este módulo.";
  }
  if (params.papel === "consulta" && params.tipo === "mutation") {
    return "O perfil de consulta não pode alterar dados.";
  }
  return null;
}

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  if (!ctx.user.papel) {
    throw new TRPCError({ code: "FORBIDDEN", message: "O seu utilizador não possui um perfil operacional ativo." });
  }

  const bloqueioPorPerfil = mensagemDeBloqueioPorPerfil({
    papel: ctx.user.papel,
    papelPlataforma: ctx.user.role,
    caminho: opts.path,
    tipo: opts.type,
  });
  if (bloqueioPorPerfil) throw new TRPCError({ code: "FORBIDDEN", message: bloqueioPorPerfil });

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      configuracaoEmpresa: ctx.configuracaoEmpresa,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/** Procedimentos de leitura do módulo financeiro, inclusive subrouters aninhados. */
export const financeiroProcedure = t.procedure.use(requireUser).use(
  t.middleware(async opts => {
    const papel = opts.ctx.user?.papel;
    const papelPlataforma = opts.ctx.user?.role;
    const autorizado = papelPlataforma === "admin" || papel === "proprietario" || papel === "administrador" || papel === "financeiro" || papel === "consulta";
    if (!autorizado) throw new TRPCError({ code: "FORBIDDEN", message: "O seu perfil não tem acesso a este módulo." });
    return opts.next();
  }),
);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    const papel = ctx.user?.papel;
    const podeAdministrarEmpresa = papel === "proprietario" || papel === "administrador";
    if (!ctx.user || !podeAdministrarEmpresa) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      configuracaoEmpresa: ctx.configuracaoEmpresa,
      },
    });
  }),
);
