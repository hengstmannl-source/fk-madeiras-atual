import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { Empresa, User } from "../../drizzle/schema";
import { getEmpresaUnica, getUserById } from "../db";
import { COOKIE_SESSAO_LOCAL, lerSessaoLocal } from "../autenticacao-local";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  configuracaoEmpresa: Empresa;
};

function lerCookie(cabecalhoCookie: string | undefined, nome: string) {
  if (!cabecalhoCookie) return undefined;
  return cabecalhoCookie
    .split(";")
    .map(parte => parte.trim())
    .find(parte => parte.startsWith(`${nome}=`))
    ?.slice(nome.length + 1);
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const sessao = lerSessaoLocal(lerCookie(opts.req.headers.cookie, COOKIE_SESSAO_LOCAL));
    if (sessao) user = (await getUserById(sessao.usuarioId)) ?? null;
    if (!user) user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const configuracaoEmpresa = await getEmpresaUnica();

  return {
    req: opts.req,
    res: opts.res,
    user,
    configuracaoEmpresa,
  };
}
