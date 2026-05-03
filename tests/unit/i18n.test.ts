import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatUnitCost,
  formatDate,
  formatDateTime,
  formatDateForFilename,
  formatPercent,
} from "../../artifacts/recipe-coster/src/lib/i18n";

describe("formatCurrency", () => {
  it("formats a normal positive amount", () => {
    const result = formatCurrency(12.3);
    expect(result).toContain("12.30");
    expect(result).toContain("$A");
  });

  it("formats zero as $A 0.00", () => {
    expect(formatCurrency(0)).toBe("$A 0.00");
  });

  it("handles null as $A 0.00", () => {
    expect(formatCurrency(null)).toBe("$A 0.00");
  });

  it("handles undefined as $A 0.00", () => {
    expect(formatCurrency(undefined)).toBe("$A 0.00");
  });

  it("handles NaN as $A 0.00", () => {
    expect(formatCurrency(NaN)).toBe("$A 0.00");
  });

  it("formats negative values correctly", () => {
    const result = formatCurrency(-5.5);
    expect(result).toContain("5.50");
  });

  it("does not use the bare AUD prefix", () => {
    const result = formatCurrency(100);
    expect(result).not.toContain("AUD");
  });
});

describe("formatUnitCost", () => {
  it("formats a unit cost with up to 4 decimal places", () => {
    const result = formatUnitCost(0.0345);
    expect(result).toContain("0.0345");
  });

  it("handles null as $A 0.0000", () => {
    expect(formatUnitCost(null)).toBe("$A 0.0000");
  });

  it("handles undefined as $A 0.0000", () => {
    expect(formatUnitCost(undefined)).toBe("$A 0.0000");
  });
});

describe("formatDate", () => {
  it("returns empty string for null", () => {
    expect(formatDate(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatDate(undefined)).toBe("");
  });

  it("returns empty string for invalid date string", () => {
    expect(formatDate("not-a-date")).toBe("");
  });

  it("formats a Date object to DD/MM/YYYY", () => {
    const result = formatDate(new Date("2026-05-02T00:00:00Z"));
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("formats a numeric timestamp", () => {
    const result = formatDate(new Date("2026-01-15").getTime());
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

describe("formatDateTime", () => {
  it("returns empty string for null", () => {
    expect(formatDateTime(null)).toBe("");
  });

  it("formats a valid date-time string with time component", () => {
    const result = formatDateTime(new Date("2026-05-02T02:00:00Z"));
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe("formatDateForFilename", () => {
  it("returns a YYYY-MM-DD formatted string", () => {
    const result = formatDateForFilename(new Date("2026-05-02T00:00:00Z"));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns empty string for invalid input", () => {
    expect(formatDateForFilename("not-a-date")).toBe("");
  });

  it("defaults to current date when no argument provided", () => {
    const result = formatDateForFilename();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatPercent", () => {
  it("formats a percentage with 1 decimal place by default", () => {
    expect(formatPercent(25.5)).toBe("25.5%");
  });

  it("respects custom fraction digits", () => {
    expect(formatPercent(33.33, 2)).toBe("33.33%");
    expect(formatPercent(10, 0)).toBe("10%");
  });

  it("handles NaN", () => {
    expect(formatPercent(NaN)).toBe("0%");
  });
});
