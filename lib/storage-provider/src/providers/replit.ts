import type { ListEntry, PutObjectOptions, StorageProvider } from "../types.js";

/**
 * Replit App Storage provider. Wraps `@replit/object-storage`, which uses
 * the bucket auto-provisioned by `setupObjectStorage()` (env var
 * `DEFAULT_OBJECT_STORAGE_BUCKET_ID`).
 *
 * Note: the @replit/object-storage SDK does not natively expose presigned
 * URLs the way S3 does. For `getSignedUrl()` we return a Replit-served
 * proxy URL; the Express side serves it via the storage route documented
 * in the object-storage skill.
 */
export async function createReplitStorageProvider(): Promise<StorageProvider> {
  const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucket) {
    throw new Error(
      "STORAGE_PROVIDER=replit requires DEFAULT_OBJECT_STORAGE_BUCKET_ID. Run `setupObjectStorage()` in the code-execution sandbox to provision it.",
    );
  }

  const mod = await import("@replit/object-storage");
  const Client = (
    mod as { Client: new (opts?: { bucketId?: string }) => unknown }
  ).Client;
  const client = new Client({ bucketId: bucket }) as {
    uploadFromBytes: (
      key: string,
      body: Uint8Array,
      opts?: {
        contentType?: string;
        cacheControl?: string;
        metadata?: Record<string, string>;
      },
    ) => Promise<{ ok: boolean; error?: { message: string } }>;
    downloadAsBytes: (key: string) => Promise<{
      ok: boolean;
      value?: Uint8Array[];
      error?: { message: string };
    }>;
    delete: (
      key: string,
    ) => Promise<{ ok: boolean; error?: { message: string } }>;
    list: (opts?: { prefix?: string }) => Promise<{
      ok: boolean;
      value?: Array<{ name: string; size?: number; lastModified?: string }>;
      error?: { message: string };
    }>;
  };

  function unwrap<T>(
    result: { ok: boolean; value?: T; error?: { message: string } },
    op: string,
  ): T {
    if (!result.ok)
      throw new Error(
        `Replit object storage ${op} failed: ${result.error?.message ?? "unknown"}`,
      );
    return result.value as T;
  }

  return {
    name: "replit",
    bucket,
    async putObject(key, body, opts: PutObjectOptions = {}) {
      const bytes =
        typeof body === "string"
          ? new TextEncoder().encode(body)
          : body instanceof Uint8Array
            ? body
            : new Uint8Array(body);
      const r = await client.uploadFromBytes(key, bytes, {
        contentType: opts.contentType,
        cacheControl: opts.cacheControl,
        metadata: opts.metadata,
      });
      if (!r.ok)
        throw new Error(
          `Replit object storage put failed: ${r.error?.message ?? "unknown"}`,
        );
    },
    async getObject(key) {
      const r = await client.downloadAsBytes(key);
      const chunks = unwrap(r, "get");
      const total = chunks.reduce((acc, c) => acc + c.length, 0);
      const out = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        out.set(c, off);
        off += c.length;
      }
      return Buffer.from(out);
    },
    async getSignedUrl(key, _ttlSeconds) {
      // The Replit SDK does not surface presigned URLs directly. Expose a
      // route on the api-server (see object-storage skill) that serves the
      // object and rely on that route's path. This keeps the interface
      // stable across providers; ttl is a no-op here because the URL
      // itself doesn't carry credentials.
      void _ttlSeconds;
      return `/api/storage/objects/${encodeURIComponent(key)}`;
    },
    async deleteObject(key) {
      const r = await client.delete(key);
      if (!r.ok)
        throw new Error(
          `Replit object storage delete failed: ${r.error?.message ?? "unknown"}`,
        );
    },
    async list(prefix) {
      const r = await client.list({ prefix });
      const entries = unwrap(r, "list");
      return entries.map<ListEntry>((e) => ({
        key: e.name,
        size: e.size,
        lastModified: e.lastModified ? new Date(e.lastModified) : undefined,
      }));
    },
  };
}
