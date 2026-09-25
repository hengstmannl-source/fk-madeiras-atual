export function criarUrlPublica(origemConfigurada: string, caminho: string) {
  let origem: URL;
  try {
    origem = new URL(origemConfigurada);
  } catch {
    throw new Error("A origem pública do sistema não está configurada corretamente.");
  }

  const origemLoopback = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(origem.hostname);
  if (!["http:", "https:"].includes(origem.protocol) || (origem.protocol !== "https:" && !origemLoopback)) {
    throw new Error("A origem pública precisa usar HTTPS; HTTP é permitido somente em loopback.");
  }

  return new URL(caminho, origem.origin).toString();
}
