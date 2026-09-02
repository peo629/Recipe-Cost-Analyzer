#!/usr/bin/env tsx
/**
 * Smoke test for @workspace/storage-provider.
 *
 * Skips cleanly (exit 0 with SKIPPED marker) when the required
 * environment variables are not present. Exits with code 1 on failure.
 *
 * Can be run directly:
 *   tsx tests/smoke/storage-provider.ts
 */

interface SmokeResult {
  provider: string;
  status: "passed" | "failed" | "skipped";
  detail: string;
  durationMs?: number;
}

const results: SmokeResult[] = [];

async function runStorageSmoke(): Promise<void> {
  const which = (process.env.STORAGE_PROVIDER ?? "replit").toLowerCase();

  if (which === "replit") {
    const hasToken = process.env.REPLIT_OBJECT_STORAGE_TOKEN;
    if (!hasToken) {
      results.push({
        provider: "replit",
        status: "skipped",
        detail:
          "SKIPPED: REPLIT_OBJECT_STORAGE_TOKEN not set; App Storage requires the Replit Object Storage integration",
      });
      return;
    }
  } else if (which === "s3") {
    const hasS3 =
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.S3_BUCKET;
    if (!hasS3) {
      results.push({
        provider: "s3",
        status: "skipped",
        detail:
          "SKIPPED: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET must all be set for S3 provider",
      });
      return;
    }
  }

  const start = Date.now();
  try {
    const { getStorageProvider, _resetStorageCache } =
      await import("../../lib/storage-provider/src/index.js");
    _resetStorageCache();
    const provider = await getStorageProvider();

    const key = `smoke-test/${Date.now()}.txt`;
    const body = `hello from le-repertoire smoke test at ${new Date().toISOString()}`;

    await provider.putObject(key, body, {
      contentType: "text/plain; charset=utf-8",
    });

    const got = await provider.getObject(key);
    const text = got.toString("utf8");
    if (text !== body) {
      throw new Error(
        `Round-trip mismatch.\n  expected: ${body}\n  got:      ${text}`,
      );
    }

    const url = await provider.getSignedUrl(key, 60);
    if (!url || url.length < 10) {
      throw new Error("Signed URL is empty or suspiciously short");
    }

    await provider.deleteObject(key);

    results.push({
      provider: provider.name,
      status: "passed",
      detail: `put+get+signed-url+delete OK bucket=${provider.bucket} bytes=${body.length}`,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    results.push({
      provider: which,
      status: "failed",
      detail: String(err instanceof Error ? err.message : err),
      durationMs: Date.now() - start,
    });
  }
}

async function main(): Promise<void> {
  console.log(
    "[smoke/storage-provider] Starting storage provider smoke tests…",
  );
  await runStorageSmoke();

  for (const r of results) {
    const icon =
      r.status === "passed" ? "✓" : r.status === "skipped" ? "○" : "✗";
    const dur = r.durationMs !== undefined ? ` (${r.durationMs}ms)` : "";
    console.log(`  ${icon} [${r.provider}] ${r.detail}${dur}`);
  }

  const failed = results.filter((r) => r.status === "failed");
  if (failed.length > 0) {
    console.error("[smoke/storage-provider] FAILED");
    process.exitCode = 1;
  } else {
    console.log("[smoke/storage-provider] DONE");
  }
}

export { results, runStorageSmoke };

if (process.argv[1]?.includes("storage-provider")) {
  main().catch((err) => {
    console.error("[smoke/storage-provider] FATAL:", err);
    process.exitCode = 1;
  });
}
