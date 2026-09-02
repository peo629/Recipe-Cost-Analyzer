import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("getStorageProvider — provider selection", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...origEnv };
    delete process.env.STORAGE_PROVIDER;
    delete process.env.REPLIT_OBJECT_STORAGE_TOKEN;
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;
  });

  afterEach(() => {
    process.env = { ...origEnv };
    vi.resetModules();
  });

  it("throws for an unknown STORAGE_PROVIDER value", async () => {
    process.env.STORAGE_PROVIDER = "unknown-storage";
    const { getStorageProvider, _resetStorageCache } =
      await import("../../lib/storage-provider/src/index");
    _resetStorageCache();
    await expect(getStorageProvider()).rejects.toThrow(
      /Unknown STORAGE_PROVIDER/,
    );
  });

  it("throws when STORAGE_PROVIDER=s3 and AWS_ACCESS_KEY_ID is missing", async () => {
    process.env.STORAGE_PROVIDER = "s3";
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;
    delete process.env.S3_BUCKET;
    const { getStorageProvider, _resetStorageCache } =
      await import("../../lib/storage-provider/src/index");
    _resetStorageCache();
    await expect(getStorageProvider()).rejects.toThrow();
  });

  it("_resetStorageCache clears the cached provider", async () => {
    const { _resetStorageCache } =
      await import("../../lib/storage-provider/src/index");
    _resetStorageCache();
  });
});
