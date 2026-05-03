import { describe, it, expect } from "vitest";

import { calcRecipeUnitCost } from "../../artifacts/api-server/src/routes/ingredients";

describe("calcRecipeUnitCost", () => {
  it("converts kg purchase to g recipe unit: 1kg for $10 → $0.01/g", () => {
    const cost = calcRecipeUnitCost(10, 1, "kg", "g");
    expect(cost).toBeCloseTo(0.01, 5);
  });

  it("same unit purchase and recipe: 1kg for $10 → $10/kg", () => {
    const cost = calcRecipeUnitCost(10, 1, "kg", "kg");
    expect(cost).toBeCloseTo(10, 5);
  });

  it("converts L purchase to ml recipe unit: 2L for $4 → $0.002/ml", () => {
    const cost = calcRecipeUnitCost(4, 2, "L", "ml");
    expect(cost).toBeCloseTo(0.002, 5);
  });

  it("converts ml purchase to L recipe unit", () => {
    const cost = calcRecipeUnitCost(2, 500, "ml", "L");
    expect(cost).toBeCloseTo(4, 5);
  });

  it("handles 'each' to 'each' (no conversion): 12 each for $6 → $0.50/each", () => {
    const cost = calcRecipeUnitCost(6, 12, "each", "each");
    expect(cost).toBeCloseTo(0.5, 5);
  });

  it("handles dozen purchase to each recipe unit: 1 dozen for $3.60 → $0.30/each", () => {
    const cost = calcRecipeUnitCost(3.6, 1, "dozen", "each");
    expect(cost).toBeCloseTo(0.3, 5);
  });

  it("handles large purchase unit size: 5kg flour for $12.50 → $0.0025/g", () => {
    const cost = calcRecipeUnitCost(12.5, 5, "kg", "g");
    expect(cost).toBeCloseTo(0.0025, 5);
  });

  it("returns purchaseCost when recipe unit is unknown (factor=1 fallback)", () => {
    const cost = calcRecipeUnitCost(10, 1, "kg", "oz");
    expect(cost).toBeCloseTo(10, 5);
  });

  it("handles zero purchaseUnitSize gracefully (returns purchaseCost)", () => {
    const cost = calcRecipeUnitCost(10, 0, "kg", "g");
    expect(cost).toBe(10);
  });
});
