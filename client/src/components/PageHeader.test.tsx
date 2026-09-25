import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Landmark } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  afterEach(() => cleanup());

  it("apresenta contexto, título, descrição e ações sem alterar o conteúdo recebido", () => {
    render(
      <PageHeader
        icon={Landmark}
        eyebrow="Gestão financeira"
        title="Contas a pagar"
        description="Acompanhe os compromissos da empresa por vencimento."
        actions={<button type="button">Novo lançamento</button>}
      />,
    );

    expect(screen.getByText("Gestão financeira")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contas a pagar" })).toBeInTheDocument();
    expect(screen.getByText("Acompanhe os compromissos da empresa por vencimento.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Novo lançamento" })).toBeInTheDocument();
  });

  it("não cria uma faixa de contexto quando ela não é informada", () => {
    render(<PageHeader icon={Landmark} title="Fluxo de caixa" description="Visão prevista e realizada." />);

    expect(screen.getByRole("heading", { name: "Fluxo de caixa" })).toBeInTheDocument();
    expect(screen.queryByText("Gestão financeira")).not.toBeInTheDocument();
  });
});
