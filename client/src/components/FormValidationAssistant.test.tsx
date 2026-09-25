import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormValidationAssistant } from "./FormValidationAssistant";

describe("FormValidationAssistant", () => {
  it("destaca o campo obrigatório ainda vazio quando o utilizador começa a preencher a mesma linha", () => {
    const { container } = render(
      <>
        <FormValidationAssistant />
        <div className="grid">
          <div><label htmlFor="cliente">Cliente *</label><input id="cliente" /></div>
          <div><label htmlFor="valor">Valor *</label><input id="valor" /></div>
        </div>
      </>
    );

    fireEvent.input(screen.getByLabelText("Cliente *"), { target: { value: "Madeiras Silva" } });

    expect(screen.getByLabelText("Cliente *").getAttribute("aria-invalid")).not.toBe("true");
    expect(screen.getByLabelText("Valor *").getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector(".grid")?.getAttribute("data-validation-row-incomplete")).toBe("true");
  });

  it("remove o destaque quando todos os campos obrigatórios da linha são preenchidos", () => {
    const { container } = render(
      <>
        <FormValidationAssistant />
        <div className="grid">
          <div><label htmlFor="data">Data *</label><input id="data" /></div>
          <div><label htmlFor="quantidade">Quantidade *</label><input id="quantidade" /></div>
        </div>
      </>
    );

    fireEvent.input(screen.getByLabelText("Data *"), { target: { value: "2026-08-14" } });
    fireEvent.input(screen.getByLabelText("Quantidade *"), { target: { value: "3" } });

    expect(screen.getByLabelText("Quantidade *").getAttribute("aria-invalid")).not.toBe("true");
    expect(container.querySelector(".grid")?.getAttribute("data-validation-row-incomplete")).toBe("false");
  });
});
