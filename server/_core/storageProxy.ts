import type { Express } from "express";
import { and, eq } from "drizzle-orm";
import { anexosFinanceiros, empresaConfiguracoes, titulosFinanceiros } from "../../drizzle/schema";
import { getDb } from "../repositories/core";
import { storageGetSignedUrl } from "../storage";
import { createContext } from "./context";
import { mensagemDeBloqueioPorPerfil } from "./trpc";

export async function moduloDoArquivo(key: string, empresaId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [anexo] = await db.select({ id: anexosFinanceiros.id }).from(anexosFinanceiros)
    .innerJoin(titulosFinanceiros, and(eq(titulosFinanceiros.id, anexosFinanceiros.tituloId), eq(titulosFinanceiros.empresaId, empresaId)))
    .where(and(eq(anexosFinanceiros.storageKey, key), eq(anexosFinanceiros.empresaId, empresaId))).limit(1);
  if (anexo) return "financeiro";
  const [logo] = await db.select({ id: empresaConfiguracoes.id }).from(empresaConfiguracoes)
    .where(and(eq(empresaConfiguracoes.logoKey, key), eq(empresaConfiguracoes.empresaId, empresaId))).limit(1);
  return logo ? "empresa" : null;
}

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    try {
      const ctx = await createContext({ req, res, info: {} as never });
      if (!ctx.user) { res.status(401).send("Autenticação necessária."); return; }
      if (!ctx.user.papel) { res.status(403).send("Acesso negado."); return; }
      const key = (req.params as Record<string, string>)[0];
      if (!key || key.length > 500) { res.status(404).send("Arquivo não encontrado."); return; }
      const modulo = await moduloDoArquivo(key, ctx.configuracaoEmpresa.id);
      if (!modulo) { res.status(404).send("Arquivo não encontrado."); return; }
      if (mensagemDeBloqueioPorPerfil({ papel: ctx.user.papel, papelPlataforma: ctx.user.role, caminho: modulo, tipo: "query" })) {
        res.status(403).send("Acesso negado."); return;
      }
      const url = await storageGetSignedUrl(key);
      if (new URL(url).protocol !== "https:") throw new Error("Invalid storage URL");
      res.redirect(307, url);
    } catch {
      res.status(502).send("Não foi possível obter o arquivo.");
    }
  });
}
