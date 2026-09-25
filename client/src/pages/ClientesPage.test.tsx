import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ClientesPage from "./ClientesPage";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("xlsx", () => ({ read: vi.fn(), utils: { sheet_to_json: vi.fn() } }));
vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ mutate: vi.fn(), isPending: false }) };
  return {
    trpc: {
      useUtils: () => ({ cliente: { list: { invalidate: vi.fn() } } }),
      cliente: {
        list: { useQuery: () => ({ data: [{ id: 24, nome: "Cliente Perfil", contacto: null, email: null, nif: null, morada: null }], isLoading: false }) },
        create: mutation,
        update: mutation,
        delete: mutation,
        previsualizarImportacao: mutation,
        importar: mutation,
      },
    },
  };
});

describe("ClientesPage", () => {
  it("oferece importação de planilha com instruções e modelo", () => {
    render(<ClientesPage />);
    fireEvent.click(screen.getByRole("button", { name: /importar planilha/i }));
    expect(screen.getByText(/importar clientes por planilha/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /baixar modelo csv/i })).toBeInTheDocument();
    expect(screen.getByText(/bloqueia duplicidades por nome, telefone, e-mail e cpf\/cnpj/i)).toBeInTheDocument();
  });

  it("abre o cadastro individual ao clicar no nome do cliente", () => {
    render(<ClientesPage />);
    expect(screen.getByRole("link", { name: "Cliente Perfil" })).toHaveAttribute("href", "/clientes/24");
  });
});
