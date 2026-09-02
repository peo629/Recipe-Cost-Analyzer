import { describe, it, expect, vi, beforeEach } from "vitest";

describe("checkAndConsumeQuota", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("allows a first request for a user", async () => {
    const { checkAndConsumeQuota } =
      await import("../../artifacts/api-server/src/lib/aiQuota");
    const result = checkAndConsumeQuota(`user-first-${Date.now()}`);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeDefined();
    expect(result.remaining).toBeGreaterThan(0);
  });

  it("decrements remaining count with each call", async () => {
    const { checkAndConsumeQuota } =
      await import("../../artifacts/api-server/src/lib/aiQuota");
    const userId = `user-decrement-${Date.now()}`;
    const first = checkAndConsumeQuota(userId);
    const second = checkAndConsumeQuota(userId);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    if (first.remaining !== undefined && second.remaining !== undefined) {
      expect(second.remaining).toBe(first.remaining - 1);
    }
  });

  it("rejects after the per-user daily limit is exhausted", async () => {
    const { checkAndConsumeQuota } =
      await import("../../artifacts/api-server/src/lib/aiQuota");
    const userId = `user-exhaust-${Date.now()}`;
    let lastResult = { allowed: false, reason: "", remaining: 0 };
    for (let i = 0; i < 51; i++) {
      lastResult = checkAndConsumeQuota(userId) as typeof lastResult;
      if (!lastResult.allowed) break;
    }
    expect(lastResult.allowed).toBe(false);
    expect(lastResult.reason).toBeDefined();
    expect(lastResult.reason).toContain("daily");
  });

  it("returns remaining: 0 when user limit is hit", async () => {
    const { checkAndConsumeQuota } =
      await import("../../artifacts/api-server/src/lib/aiQuota");
    const userId = `user-zero-${Date.now()}`;
    let result = checkAndConsumeQuota(userId);
    for (let i = 0; i < 100; i++) {
      result = checkAndConsumeQuota(userId);
      if (!result.allowed) break;
    }
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
