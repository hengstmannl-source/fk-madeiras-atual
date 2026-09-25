import { describe, expect, it } from "vitest";
import { calculatePrecoLinearCm, calculateVolumeCm, parseDecimalInput } from "./utils";

describe("medidas de vendas em centímetros", () => {
  it("preserva a vírgula decimal de uma bitola de 2,3 × 5 cm", () => {
    expect(parseDecimalInput("2,3")).toBe(2.3);
    expect(calculatePrecoLinearCm(2.3, 5, 900)).toBeCloseTo(1.035, 8);
  });

  it("calcula o volume com centímetros, sem ampliar a bitola por dez", () => {
    expect(calculateVolumeCm(2.3, 5, 3, 32)).toBeCloseTo(0.1104, 8);
  });
});
