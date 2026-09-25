import type { Express, Request, Response } from "express";
import * as db from "./db";
import { sdk } from "./_core/sdk";

export function registerFinanceiroScheduleRoutes(app: Express) {
  app.post("/api/scheduled/financeiro-diario", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const configuracao = await db.getConfiguracaoFinanceiraByTaskUid(user.taskUid);
      if (!configuracao) return res.json({ ok: true, skipped: "orphan" });
      const resultado = await db.processarRecorrenciasFinanceiras();
      return res.json({ ok: true, ...resultado });
    } catch (error) {
      const erro = error instanceof Error ? error : new Error(String(error));
      console.error("[Financeiro] Falha no processamento diário", erro);
      return res.status(500).json({
        error: erro.message,
        stack: erro.stack,
        context: { path: "/api/scheduled/financeiro-diario" },
        timestamp: new Date().toISOString(),
      });
    }
  });
}
