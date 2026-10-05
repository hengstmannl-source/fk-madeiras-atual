import { describe, expect, it } from "vitest";
import { safeInternalRedirectPath, safePdfUrl } from "./safeNavigation";

const origin = "https://fkmadeiras.com.br";

describe("safeInternalRedirectPath", () => {
  it("keeps valid same-site paths with query and fragment", () => {
    expect(safeInternalRedirectPath("/financeiro?aba=abertos#lista", origin)).toBe(
      "/financeiro?aba=abertos#lista",
    );
  });

  it.each([
    "https://attacker.example/",
    "//attacker.example/",
    "/\\attacker.example/",
    "javascript:alert(1)",
    "financeiro",
  ])("rejects unsafe redirect %s", (candidate) => {
    expect(safeInternalRedirectPath(candidate, origin)).toBeNull();
  });
});

describe("safePdfUrl", () => {
  it("allows the application's PDF endpoints", () => {
    expect(safePdfUrl("/api/pdf/relatorio-romaneios-carga?origem=Norte&ids=12", origin)).toBe("/api/pdf/relatorio-romaneios-carga?origem=Norte&ids=12");
    expect(safePdfUrl("/api/pdf/orcamento/42", origin)).toBe(
      "/api/pdf/orcamento/42",
    );
    expect(safePdfUrl("/api/pdf/romaneio-carga/42", origin)).toBe(
      "/api/pdf/romaneio-carga/42",
    );
  });

  it("allows a same-origin blob URL", () => {
    expect(safePdfUrl("blob:https://fkmadeiras.com.br/1234", origin)).toBe(
      "blob:https://fkmadeiras.com.br/1234",
    );
  });

  it.each([
    "https://attacker.example/file.pdf",
    "//attacker.example/file.pdf",
    "javascript:alert(1)",
    "/api/pdf/qualquer-coisa/42",
    "/api/pdf/orcamento/not-an-id",
  ])("rejects unsafe PDF URL %s", (candidate) => {
    expect(safePdfUrl(candidate, origin)).toBeNull();
  });
});
