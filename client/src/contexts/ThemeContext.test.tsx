import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeContext";

function ControleTema() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>Tema atual: {theme}</button>;
}

describe("ThemeProvider", () => {
  afterEach(() => {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("theme");
  });

  it("alterna o tema e persiste a preferência do usuário", () => {
    render(<ThemeProvider defaultTheme="light" switchable><ControleTema /></ThemeProvider>);

    expect(screen.getByRole("button", { name: "Tema atual: light" })).toBeInTheDocument();
    expect(document.documentElement).not.toHaveClass("dark");

    fireEvent.click(screen.getByRole("button", { name: "Tema atual: light" }));

    expect(screen.getByRole("button", { name: "Tema atual: dark" })).toBeInTheDocument();
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
  });
});
