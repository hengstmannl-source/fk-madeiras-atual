import { describe, expect, it } from "vitest";
import { isValidLogoImage } from "./empresa";

describe("isValidLogoImage", () => {
  it("aceita uma assinatura PNG para um ficheiro declarado como PNG", () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    expect(isValidLogoImage(png, "image/png")).toBe(true);
  });

  it("aceita uma assinatura JPEG para um ficheiro declarado como JPEG", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]);
    expect(isValidLogoImage(jpeg, "image/jpeg")).toBe(true);
  });

  it("rejeita conteúdo incompatível com o tipo declarado", () => {
    const texto = Buffer.from("conteúdo inválido");
    expect(isValidLogoImage(texto, "image/png")).toBe(false);
  });
});
