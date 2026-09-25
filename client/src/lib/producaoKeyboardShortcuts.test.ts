// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { tratarAtalhosProducao } from "./producaoKeyboardShortcuts";

function eventoTeclado(alvo: HTMLInputElement, key: string, shiftKey = false) {
  return {
    key,
    target: alvo,
    shiftKey,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent<HTMLElement>;
}

describe("atalhos de teclado da Produção", () => {
  it("avança entre comprimentos e entre quantidades sem cruzar as colunas", () => {
    document.body.innerHTML = `<div role="dialog">
      <input aria-label="Comprimento da linha 1" />
      <input aria-label="Quantidade da linha 1" />
      <input aria-label="Comprimento da linha 2" />
      <input aria-label="Quantidade da linha 2" />
    </div>`;
    const comprimento1 = document.querySelector<HTMLInputElement>('[aria-label="Comprimento da linha 1"]')!;
    const quantidade1 = document.querySelector<HTMLInputElement>('[aria-label="Quantidade da linha 1"]')!;

    const tabComprimento = eventoTeclado(comprimento1, "Tab");
    tratarAtalhosProducao(tabComprimento);
    expect(tabComprimento.preventDefault).toHaveBeenCalledOnce();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Comprimento da linha 2");

    const tabQuantidade = eventoTeclado(quantidade1, "Tab");
    tratarAtalhosProducao(tabQuantidade);
    expect(tabQuantidade.preventDefault).toHaveBeenCalledOnce();
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Quantidade da linha 2");
  });

  it("inclui uma nova tora de terceiros ao pressionar Enter no comprimento", () => {
    document.body.innerHTML = `<div role="dialog"><input aria-label="Comprimento da tora 1" /><button>Adicionar tora</button></div>`;
    const botao = document.querySelector<HTMLButtonElement>("button")!;
    const clique = vi.fn();
    botao.addEventListener("click", clique);

    const enter = eventoTeclado(document.querySelector<HTMLInputElement>("input")!, "Enter");
    tratarAtalhosProducao(enter);
    expect(enter.preventDefault).toHaveBeenCalledOnce();
    expect(clique).toHaveBeenCalledOnce();
  });
});
