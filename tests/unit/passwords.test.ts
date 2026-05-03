import { describe, it, expect } from "vitest";
import {
  validatePasswordPolicy,
  hashPassword,
  verifyPassword,
} from "../../artifacts/api-server/src/lib/passwords";

describe("validatePasswordPolicy", () => {
  it("returns no errors for a valid password", () => {
    expect(validatePasswordPolicy("ValidPass1!!x")).toEqual([]);
  });

  it("returns an error when the password is too short", () => {
    const reasons = validatePasswordPolicy("Short1!");
    expect(reasons.some((r) => r.includes("12 characters"))).toBe(true);
  });

  it("returns an error when missing a lower-case letter", () => {
    const reasons = validatePasswordPolicy("UPPERCASE123!");
    expect(reasons.some((r) => r.includes("lower-case"))).toBe(true);
  });

  it("returns an error when missing an upper-case letter", () => {
    const reasons = validatePasswordPolicy("lowercase123!");
    expect(reasons.some((r) => r.includes("upper-case"))).toBe(true);
  });

  it("returns an error when missing a digit", () => {
    const reasons = validatePasswordPolicy("NoDigitHere!!");
    expect(reasons.some((r) => r.includes("digit"))).toBe(true);
  });

  it("returns an error when missing a special character", () => {
    const reasons = validatePasswordPolicy("NoSpecial1234");
    expect(reasons.some((r) => r.includes("special"))).toBe(true);
  });

  it("returns multiple errors for a completely invalid password", () => {
    const reasons = validatePasswordPolicy("weak");
    expect(reasons.length).toBeGreaterThan(2);
  });

  it("returns empty array for a 12-char password meeting all criteria", () => {
    expect(validatePasswordPolicy("Abcdef1!ghij")).toEqual([]);
  });

  it("rejects non-string input gracefully", () => {
    const reasons = validatePasswordPolicy(123 as unknown as string);
    expect(reasons.some((r) => r.includes("12 characters"))).toBe(true);
  });
});

describe("hashPassword + verifyPassword", () => {
  it("hashes a password and verifies it correctly", async () => {
    const pw = "GoodPass123!";
    const hash = await hashPassword(pw);
    expect(hash).not.toBe(pw);
    expect(hash.startsWith("$2")).toBe(true);
    const ok = await verifyPassword(pw, hash);
    expect(ok).toBe(true);
  });

  it("returns false for a wrong password", async () => {
    const hash = await hashPassword("Correct1Password!!");
    const ok = await verifyPassword("WrongPassword1!!", hash);
    expect(ok).toBe(false);
  });
});
