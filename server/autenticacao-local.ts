import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ENV } from "./_core/env";

const scrypt = promisify(scryptCallback);
const DURACAO_SESSAO_MS = 1000 * 60 * 60 * 12;
export const COOKIE_SESSAO_LOCAL = "fk_sessao_local";

function segredoObrigatorio() {
  if (!ENV.cookieSecret || ENV.cookieSecret.length < 32) {
    throw new Error("A chave segura da sessão não está configurada");
  }
  return ENV.cookieSecret;
}

export function normalizarEmail(email: string) {
  return email.trim().toLocaleLowerCase("pt-BR");
}

export async function gerarHashSenha(senha: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivada = (await scrypt(senha, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivada.toString("base64url")}`;
}

export async function validarSenha(senha: string, senhaHash: string) {
  const [algoritmo, salt, hash] = senhaHash.split("$");
  if (algoritmo !== "scrypt" || !salt || !hash) return false;
  const derivada = (await scrypt(senha, salt, 64)) as Buffer;
  const esperada = Buffer.from(hash, "base64url");
  return esperada.length === derivada.length && timingSafeEqual(esperada, derivada);
}

function assinar(valor: string) {
  return createHmac("sha256", segredoObrigatorio()).update(valor).digest("base64url");
}

export function criarSessaoLocal(usuarioId: number, agora = Date.now()) {
  const expiraEm = agora + DURACAO_SESSAO_MS;
  const corpo = `${usuarioId}.${expiraEm}`;
  return `${corpo}.${assinar(corpo)}`;
}

export function lerSessaoLocal(token: string | undefined, agora = Date.now()) {
  if (!token) return undefined;
  const [idTexto, expiraTexto, assinatura, ...resto] = token.split(".");
  if (resto.length || !idTexto || !expiraTexto || !assinatura) return undefined;
  const corpo = `${idTexto}.${expiraTexto}`;
  const esperada = assinar(corpo);
  const assinaturaValida = Buffer.from(assinatura);
  const esperadaBuffer = Buffer.from(esperada);
  if (assinaturaValida.length !== esperadaBuffer.length || !timingSafeEqual(assinaturaValida, esperadaBuffer)) return undefined;
  const usuarioId = Number(idTexto);
  const expiraEm = Number(expiraTexto);
  if (!Number.isInteger(usuarioId) || usuarioId <= 0 || !Number.isFinite(expiraEm) || expiraEm <= agora) return undefined;
  return { usuarioId, expiraEm };
}

export const DURACAO_SESSAO_LOCAL_MS = DURACAO_SESSAO_MS;
