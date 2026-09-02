import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("isOriginAllowed", () => {
  let isOriginAllowed: (origin: string | undefined) => boolean;

  beforeEach(async () => {
    vi.resetModules();
    ({ isOriginAllowed } = await import("../../artifacts/api-server/src/app"));
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("allows requests with no origin (server-to-server / curl)", () => {
    expect(isOriginAllowed(undefined)).toBe(true);
  });

  it("allows empty-string origin", () => {
    expect(isOriginAllowed("")).toBe(true);
  });

  it("rejects an arbitrary unknown origin in production mode", () => {
    expect(isOriginAllowed("https://evil.com")).toBe(false);
  });

  it("rejects HTTP non-localhost origins", () => {
    expect(isOriginAllowed("http://some-other-site.io")).toBe(false);
  });

  it("rejects origins that look almost like Replit but are not", () => {
    expect(isOriginAllowed("https://fake-replit.dev")).toBe(false);
    expect(isOriginAllowed("https://notreplit.dev")).toBe(false);
  });
});
