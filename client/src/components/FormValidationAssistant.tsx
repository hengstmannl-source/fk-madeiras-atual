import { useEffect } from "react";

const seletorControles = "input, textarea, select, button[data-slot='select-trigger'], [role='combobox']";
const rotulosObrigatorios = [
  "nome", "cliente", "fornecedor", "categoria", "conta", "data", "referência", "referencia",
  "essência", "essencia", "diâmetro", "diametro", "espessura", "largura", "comprimento",
  "quantidade", "valor", "tarifa", "forma de pagamento", "descrição", "descricao", "código", "codigo",
];

function textoDoRotulo(campo: HTMLElement): string {
  const porId = campo.id ? document.querySelector(`label[for="${CSS.escape(campo.id)}"]`)?.textContent : "";
  const rotuloEnvolvente = campo.closest("label")?.textContent;
  const campoEnvolvente = campo.closest("[data-validation-field]")?.textContent;
  const rotuloDoBloco = campo.parentElement?.querySelector("label")?.textContent;
  const rotuloDoPai = campo.parentElement?.parentElement?.querySelector(":scope > label")?.textContent;
  return `${porId ?? ""} ${rotuloEnvolvente ?? ""} ${campoEnvolvente ?? ""} ${rotuloDoBloco ?? ""} ${rotuloDoPai ?? ""}`.replace(/\s+/g, " ").trim();
}

function campoObrigatorio(campo: HTMLElement): boolean {
  if (campo.getAttribute("aria-required") === "true" || campo.dataset.validationRequired === "true") return true;
  const rotulo = textoDoRotulo(campo).toLocaleLowerCase("pt-BR");
  const reconhecido = rotulosObrigatorios.some((nome) => rotulo.startsWith(nome));
  if (campo instanceof HTMLInputElement || campo instanceof HTMLTextAreaElement || campo instanceof HTMLSelectElement) return campo.required || /\*$/.test(rotulo) || reconhecido;
  return /\*$/.test(rotulo) || reconhecido;
}

function campoVazio(campo: HTMLElement): boolean {
  if (campo instanceof HTMLInputElement || campo instanceof HTMLTextAreaElement || campo instanceof HTMLSelectElement) return !campo.value.trim() || !campo.validity.valid;
  return campo.hasAttribute("data-placeholder") || campo.getAttribute("aria-expanded") === "false" && !campo.textContent?.trim();
}

function agrupamentoDo(campo: HTMLElement): HTMLElement | null {
  return campo.closest("[data-validation-row]") ?? campo.closest(".grid") ?? campo.closest("form") ?? campo.closest("[role='dialog']");
}

function atualizarAgrupamento(grupo: HTMLElement) {
  const obrigatorios = Array.from(grupo.querySelectorAll<HTMLElement>(seletorControles)).filter(campoObrigatorio);
  if (!obrigatorios.length) return;
  let incompletos = 0;
  for (const campo of obrigatorios) {
    const invalido = campoVazio(campo);
    if (invalido) incompletos += 1;
    if (invalido) campo.setAttribute("aria-invalid", "true");
    else if (campo.dataset.serverInvalid !== "true") campo.removeAttribute("aria-invalid");
  }
  grupo.dataset.validationRowIncomplete = incompletos ? "true" : "false";
}

/**
 * Aplica um retorno visual consistente depois que o utilizador começa a preencher
 * um conjunto de campos. Não exibe erros em formulários intocados e também atende
 * controles nativos, campos de texto e seletores Radix usados no sistema.
 */
export function FormValidationAssistant() {
  useEffect(() => {
    const aoInteragir = (evento: Event) => {
      const campo = evento.target instanceof HTMLElement ? evento.target.closest<HTMLElement>(seletorControles) : null;
      if (!campo) return;
      const grupo = agrupamentoDo(campo);
      if (grupo) atualizarAgrupamento(grupo);
    };
    const aoClicar = (evento: MouseEvent) => {
      const alvo = evento.target instanceof HTMLElement ? evento.target : null;
      if (!alvo?.closest("[role='option'], [data-slot='select-item']")) return;
      window.setTimeout(() => document.querySelectorAll<HTMLElement>("[data-validation-row-incomplete]").forEach(atualizarAgrupamento), 0);
    };
    document.addEventListener("input", aoInteragir, true);
    document.addEventListener("change", aoInteragir, true);
    document.addEventListener("focusout", aoInteragir, true);
    document.addEventListener("click", aoClicar, true);
    return () => {
      document.removeEventListener("input", aoInteragir, true);
      document.removeEventListener("change", aoInteragir, true);
      document.removeEventListener("focusout", aoInteragir, true);
      document.removeEventListener("click", aoClicar, true);
    };
  }, []);
  return null;
}
