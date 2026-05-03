import type { StorageProvider } from "./types.js";

export type { ListEntry, PutObjectOptions, StorageProvider } from "./types.js";

let cached: StorageProvider | null = null;

/**
 * Resolve and cache the active storage provider. Selected by
 * `STORAGE_PROVIDER`:
 *
 *   - `replit` (default — Replit App Storage / GCS-backed bucket)
 *   - `s3`     (AWS S3, R2, MinIO, B2 — requires AWS_* env vars)
 *
 * SDKs are dynamically imported so an `s3`-only deployment never loads
 * the Replit SDK and vice-versa.
 */
export async function getStorageProvider(): Promise<StorageProvider> {
  if (cached) return cached;
  const which = (process.env.STORAGE_PROVIDER ?? "replit").toLowerCase();
  switch (which) {
    case "replit": {
      const { createReplitStorageProvider } =
        await import("./providers/replit.js");
      cached = await createReplitStorageProvider();
      break;
    }
    case "s3": {
      const { createS3StorageProvider } = await import("./providers/s3.js");
      cached = await createS3StorageProvider();
      break;
    }
    default:
      throw new Error(
        `Unknown STORAGE_PROVIDER='${which}'. Expected one of: replit, s3.`,
      );
  }
  return cached;
}

/** Test helper — resets the cached provider so a new env can be picked up. */
export function _resetStorageCache(): void {
  cached = null;
}
