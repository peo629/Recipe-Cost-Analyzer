#!/usr/bin/env tsx
/**
 * Smoke test for @workspace/ai-provider.
 *
 * Skips cleanly (exit 0 with SKIPPED marker) when the required
 * environment variables are not present. Exits with code 1 on failure.
 *
 * Can be run directly:
 *   tsx tests/smoke/ai-provider.ts
 */

interface SmokeResult {
  provider: string;
  status: "passed" | "failed" | "skipped";
  detail: string;
  durationMs?: number;
}

const results: SmokeResult[] = [];

async function runChatSmoke(): Promise<void> {
  const which = (process.env.AI_PROVIDER ?? "replit").toLowerCase();

  if (which === "replit") {
    const hasReplit =
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY &&
      process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    if (!hasReplit) {
      results.push({
        provider: "replit",
        status: "skipped",
        detail:
          "SKIPPED: AI_INTEGRATIONS_OPENAI_API_KEY / AI_INTEGRATIONS_OPENAI_BASE_URL not set",
      });
      return;
    }
  } else if (which === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      results.push({
        provider: "openai",
        status: "skipped",
        detail: "SKIPPED: OPENAI_API_KEY not set",
      });
      return;
    }
  } else if (which === "openrouter") {
    if (!process.env.OPENROUTER_API_KEY) {
      results.push({
        provider: "openrouter",
        status: "skipped",
        detail: "SKIPPED: OPENROUTER_API_KEY not set",
      });
      return;
    }
  }

  const start = Date.now();
  try {
    const { chatComplete, getChatProvider } =
      await import("../../lib/ai-provider/src/index.js");
    const provider = await getChatProvider();
    const chat = await chatComplete({
      messages: [
        {
          role: "system",
          content: "Reply with exactly the word PONG and nothing else.",
        },
        { role: "user", content: "ping" },
      ],
      maxTokens: 16,
    });
    results.push({
      provider: provider.name,
      status: "passed",
      detail: `text='${chat.text.trim()}' model='${chat.model}' tokens=${chat.usage.totalTokens ?? "?"}`,
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

async function runEmbedSmoke(): Promise<void> {
  const canEmbed = process.env.OPENAI_API_KEY || process.env.VOYAGE_API_KEY;
  if (!canEmbed) {
    results.push({
      provider: "embedding",
      status: "skipped",
      detail:
        "SKIPPED: set OPENAI_API_KEY or VOYAGE_API_KEY to exercise embeddings",
    });
    return;
  }

  const start = Date.now();
  try {
    const { embed, getEmbeddingProvider } =
      await import("../../lib/ai-provider/src/index.js");
    const provider = await getEmbeddingProvider();
    const result = await embed({
      input: "Le Repertoire embedding smoke test.",
    });
    results.push({
      provider: `embedding/${provider.name}`,
      status: "passed",
      detail: `dims=${result.dimensions} model='${result.model}' tokens=${result.usage.totalTokens ?? "?"}`,
      durationMs: Date.now() - start,
    });
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    const isQuota = msg.includes("429") || msg.toLowerCase().includes("quota");
    results.push({
      provider: "embedding",
      status: isQuota ? "skipped" : "failed",
      detail: isQuota
        ? `SKIPPED: API quota exceeded — ${msg.slice(0, 120)}`
        : msg,
      durationMs: Date.now() - start,
    });
  }
}

async function main(): Promise<void> {
  console.log("[smoke/ai-provider] Starting AI provider smoke tests…");
  await runChatSmoke();
  await runEmbedSmoke();

  for (const r of results) {
    const icon =
      r.status === "passed" ? "✓" : r.status === "skipped" ? "○" : "✗";
    const dur = r.durationMs !== undefined ? ` (${r.durationMs}ms)` : "";
    console.log(`  ${icon} [${r.provider}] ${r.detail}${dur}`);
  }

  const failed = results.filter((r) => r.status === "failed");
  if (failed.length > 0) {
    console.error("[smoke/ai-provider] FAILED");
    process.exitCode = 1;
  } else {
    console.log("[smoke/ai-provider] DONE");
  }
}

export { results, runChatSmoke, runEmbedSmoke };

if (process.argv[1]?.includes("ai-provider")) {
  main().catch((err) => {
    console.error("[smoke/ai-provider] FATAL:", err);
    process.exitCode = 1;
  });
}
