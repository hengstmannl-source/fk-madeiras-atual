import type { CookieOptions, Request } from "express";
import { ENV } from "./env";

function isSecureRequest(req: Request) {
  return req.protocol === "https";
}

export function getSessionCookieOptions(
  req: Request,
  isProduction = ENV.isProduction
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  return {
    httpOnly: true,
    path: "/",
    // A aplicação e a API compartilham a mesma origem lógica (/api/*). Lax
    // preserva os cookies nas chamadas autenticadas e evita SameSite=None sem
    // Secure no HTTP local. Em produção, Secure é obrigatório mesmo atrás de
    // proxies que não propaguem x-forwarded-proto corretamente.
    sameSite: "lax",
    secure: isProduction || isSecureRequest(req),
  };
}
