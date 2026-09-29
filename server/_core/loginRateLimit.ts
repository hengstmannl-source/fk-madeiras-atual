import type { RequestHandler } from "express";
import { isIP } from "node:net";

// IPv6 privacy addresses in the same /64 share a budget. Never read XFF directly.
export function chaveIp(ip: string) {
  if (ip.startsWith("::ffff:") && isIP(ip.slice(7)) === 4) return ip.slice(7);
  if (isIP(ip) !== 6) return ip;
  const [left, right = ""] = ip.split("::");
  const a = left ? left.split(":") : [], b = right ? right.split(":") : [];
  const parts = [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b];
  return parts.slice(0, 4).map(x => parseInt(x, 16).toString(16)).join(":") + "::/64";
}

export function criarLimitadorLogin(now = Date.now): RequestHandler {
  const janela = 15 * 60_000;
  const buckets = new Map<string, { count: number; until: number }>();
  return (req, res, next) => {
    let path: string;
    try { path = decodeURIComponent(req.path); } catch { res.status(400).end(); return; }
    const custo = path.replace(/^\//, "").split(",").filter(p => p === "auth.entrar" || p === "equipe.aceitarConvite").length;
    if (!custo) { next(); return; }
    const agora = now();
    for (const [key, value] of Array.from(buckets)) if (value.until <= agora) buckets.delete(key);
    const key = chaveIp(req.ip || req.socket.remoteAddress || "unknown");
    const bucket = buckets.get(key) ?? { count: 0, until: agora + janela };
    if (bucket.count + custo > 120 || (!buckets.has(key) && buckets.size >= 10_000)) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((bucket.until - agora) / 1000))));
      res.set("Cache-Control", "no-store");
      res.status(429).json({ error: "Muitas tentativas. Tente novamente mais tarde." });
      return;
    }
    bucket.count += custo;
    buckets.set(key, bucket);
    next();
  };
}
