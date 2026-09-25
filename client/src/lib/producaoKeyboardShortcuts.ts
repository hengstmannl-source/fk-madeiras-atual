import type { KeyboardEvent } from "react";

const campoPorColuna = /^(Comprimento da (?:linha|peça de terceiros) |Quantidade da (?:linha|peça de terceiros) )(\d+)$/;

export function tratarAtalhosProducao(evento: KeyboardEvent<HTMLElement>) {
  if (evento.altKey || evento.ctrlKey || evento.metaKey) return;
  const alvo = evento.target;
  if (!(alvo instanceof HTMLInputElement)) return;

  const rotulo = alvo.getAttribute("aria-label") ?? "";
  if (evento.key === "Enter" && /^Comprimento da tora \d+$/.test(rotulo)) {
    const dialogo = alvo.closest('[role="dialog"]');
    const adicionarTora = Array.from((dialogo ?? document).querySelectorAll("button"))
      .find((botao) => botao.textContent?.trim() === "Adicionar tora");
    if (adicionarTora) {
      evento.preventDefault();
      adicionarTora.click();
    }
    return;
  }

  if (evento.key !== "Tab") return;
  const correspondencia = rotulo.match(campoPorColuna);
  if (!correspondencia) return;

  const prefixo = correspondencia[1];
  const indiceAtual = Number(correspondencia[2]);
  const proximoIndice = indiceAtual + (evento.shiftKey ? -1 : 1);
  if (proximoIndice < 1) return;
  const proximoCampo = (alvo.closest('[role="dialog"]') ?? document)
    .querySelector<HTMLInputElement>(`input[aria-label="${prefixo}${proximoIndice}"]`);
  if (!proximoCampo) return;

  evento.preventDefault();
  proximoCampo.focus();
}
