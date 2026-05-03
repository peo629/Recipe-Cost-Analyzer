import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  ingredientEmbeddingText,
} from "../../artifacts/api-server/src/lib/ingredientMatcher";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 6);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1, 6);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 when one vector is zero", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("is invariant to scale", () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 6);
  });
});

describe("ingredientEmbeddingText", () => {
  it("uses just the name when supplier and category are null", () => {
    expect(
      ingredientEmbeddingText({
        name: "Plain Flour",
        supplier: null,
        category: null,
      }),
    ).toBe("Plain Flour");
  });

  it("includes category when present", () => {
    expect(
      ingredientEmbeddingText({
        name: "Cream",
        supplier: null,
        category: "Dairy",
      }),
    ).toBe("Cream — Dairy");
  });

  it("includes both category and supplier in canonical order", () => {
    expect(
      ingredientEmbeddingText({
        name: "Cream",
        supplier: "Quality Dairy",
        category: "Dairy",
      }),
    ).toBe("Cream — Dairy — Quality Dairy");
  });

  it("includes supplier even when category is missing", () => {
    expect(
      ingredientEmbeddingText({
        name: "Tomato",
        supplier: "Fresh Produce Co",
        category: null,
      }),
    ).toBe("Tomato — Fresh Produce Co");
  });
});
