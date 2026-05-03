/**
 * Smoke test for `@workspace/storage-provider`. Runs a put → get →
 * signed-url → delete round-trip against whichever provider is currently
 * configured.
 *
 *   pnpm --filter @workspace/storage-provider smoke
 */
import { getStorageProvider } from "../src/index.js";

async function main(): Promise<void> {
  const provider = await getStorageProvider();
  console.log(
    `[storage-provider] provider=${provider.name} bucket=${provider.bucket}`,
  );

  const key = `smoke/${Date.now()}.txt`;
  const body = `hello from le-repertoire smoke test at ${new Date().toISOString()}`;

  await provider.putObject(key, body, {
    contentType: "text/plain; charset=utf-8",
  });
  console.log(`[storage-provider] put OK key=${key} bytes=${body.length}`);

  const got = await provider.getObject(key);
  const text = got.toString("utf8");
  if (text !== body) {
    throw new Error(
      `Round-trip mismatch.\n  expected: ${body}\n  got:      ${text}`,
    );
  }
  console.log(
    `[storage-provider] get OK roundtrip matched (${got.length} bytes)`,
  );

  const url = await provider.getSignedUrl(key, 60);
  console.log(`[storage-provider] signed URL OK len=${url.length}`);

  await provider.deleteObject(key);
  console.log(`[storage-provider] delete OK`);
}

main().catch((err) => {
  console.error("[storage-provider] SMOKE FAILED:", err);
  process.exitCode = 1;
});
