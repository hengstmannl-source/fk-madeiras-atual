import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { configurable: true, value: () => false });
Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { configurable: true, value: vi.fn() });
Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { configurable: true, value: vi.fn() });

afterEach(cleanup);

describe("Select", () => {
  it("pesquisa as opções e mantém Criar novo como a primeira ação disponível", async () => {
    const user = userEvent.setup();
    const criar = vi.fn();
    render(
      <Select onCreate={criar} createLabel="Criar novo fornecedor">
        <SelectTrigger aria-label="Fornecedor"><SelectValue placeholder="Selecione" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Posto Central</SelectItem>
          <SelectItem value="2">Posto Cedrinho</SelectItem>
        </SelectContent>
      </Select>
    );

    await user.click(screen.getByRole("combobox", { name: "Fornecedor" }));
    const pesquisa = screen.getByRole("textbox", { name: "Pesquisar na lista" });
    await user.type(pesquisa, "cedrinho");

    expect(screen.getByRole("option", { name: /Criar novo fornecedor/i })).toBeTruthy();
    expect(screen.getByText("Posto Cedrinho")).toBeTruthy();
    expect(screen.queryByText("Posto Central")).toBeNull();

    await user.click(screen.getByRole("option", { name: /Criar novo fornecedor/i }));
    expect(criar).toHaveBeenCalledOnce();
  });
});
