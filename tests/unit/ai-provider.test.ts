import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getChatProvider — provider selection", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...origEnv };
    delete process.env.AI_PROVIDER;
  });

  afterEach(() => {
    process.env = { ...origEnv };
    vi.resetModules();
  });

  it("throws when AI_PROVIDER=replit and keys are missing", async () => {
    process.env.AI_PROVIDER = "replit";
    delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const { getChatProvider, _resetProviderCache } =
      await import("../../lib/ai-provider/src/index");
    _resetProviderCache();
    await expect(getChatProvider()).rejects.toThrow(/AI_PROVIDER=replit/);
  });

  it("throws when AI_PROVIDER=openai and OPENAI_API_KEY is missing", async () => {
    process.env.AI_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;
    const { getChatProvider, _resetProviderCache } =
      await import("../../lib/ai-provider/src/index");
    _resetProviderCache();
    await expect(getChatProvider()).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it("throws when AI_PROVIDER=openrouter and OPENROUTER_API_KEY is missing", async () => {
    process.env.AI_PROVIDER = "openrouter";
    delete process.env.OPENROUTER_API_KEY;
    const { getChatProvider, _resetProviderCache } =
      await import("../../lib/ai-provider/src/index");
    _resetProviderCache();
    await expect(getChatProvider()).rejects.toThrow(/OPENROUTER_API_KEY/);
  });

  it("throws for an unknown AI_PROVIDER value", async () => {
    process.env.AI_PROVIDER = "unknown-provider";
    const { getChatProvider, _resetProviderCache } =
      await import("../../lib/ai-provider/src/index");
    _resetProviderCache();
    await expect(getChatProvider()).rejects.toThrow(/Unknown AI_PROVIDER/);
  });
});

describe("getEmbeddingProvider — provider selection", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...origEnv };
    delete process.env.EMBEDDING_PROVIDER;
    delete process.env.VOYAGE_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...origEnv };
    vi.resetModules();
  });

  it("throws when EMBEDDING_PROVIDER=voyage and VOYAGE_API_KEY is missing", async () => {
    process.env.EMBEDDING_PROVIDER = "voyage";
    delete process.env.VOYAGE_API_KEY;
    const { getEmbeddingProvider, _resetProviderCache } =
      await import("../../lib/ai-provider/src/index");
    _resetProviderCache();
    await expect(getEmbeddingProvider()).rejects.toThrow(/VOYAGE_API_KEY/);
  });

  it("throws when EMBEDDING_PROVIDER=openai and OPENAI_API_KEY is missing", async () => {
    process.env.EMBEDDING_PROVIDER = "openai";
    delete process.env.OPENAI_API_KEY;
    const { getEmbeddingProvider, _resetProviderCache } =
      await import("../../lib/ai-provider/src/index");
    _resetProviderCache();
    await expect(getEmbeddingProvider()).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it("throws for an unknown EMBEDDING_PROVIDER value", async () => {
    process.env.EMBEDDING_PROVIDER = "bad-provider";
    const { getEmbeddingProvider, _resetProviderCache } =
      await import("../../lib/ai-provider/src/index");
    _resetProviderCache();
    await expect(getEmbeddingProvider()).rejects.toThrow(
      /Unknown EMBEDDING_PROVIDER/,
    );
  });

  it("_resetProviderCache clears the cached provider", async () => {
    const { _resetProviderCache } =
      await import("../../lib/ai-provider/src/index");
    _resetProviderCache();
  });
});
