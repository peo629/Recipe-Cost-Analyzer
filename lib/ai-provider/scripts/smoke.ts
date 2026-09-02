/**
 * Smoke test for `@workspace/ai-provider`. Runs one chat completion and
 * one embedding round-trip against whichever provider is currently
 * configured. Skips embeddings if no embedding-capable key is set.
 *
 *   pnpm --filter @workspace/ai-provider smoke
 */
import {
  chatComplete,
  embed,
  getChatProvider,
  getEmbeddingProvider,
} from "../src/index.js";

async function main(): Promise<void> {
  const chatProvider = await getChatProvider();
  console.log(
    `[ai-provider] chat provider: ${chatProvider.name} (default model: ${chatProvider.defaultModel})`,
  );
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
  console.log(
    `[ai-provider] chat OK: text='${chat.text}' model='${chat.model}' tokens=${chat.usage.totalTokens ?? "?"}`,
  );

  const canEmbed = Boolean(
    process.env.OPENAI_API_KEY ?? process.env.VOYAGE_API_KEY,
  );
  if (!canEmbed) {
    console.log(
      "[ai-provider] embed SKIPPED — set OPENAI_API_KEY or VOYAGE_API_KEY to exercise embeddings.",
    );
    return;
  }
  const embedProvider = await getEmbeddingProvider();
  console.log(
    `[ai-provider] embed provider: ${embedProvider.name} (default model: ${embedProvider.defaultModel})`,
  );
  const e = await embed({ input: "Le Repertoire embedding smoke test." });
  console.log(
    `[ai-provider] embed OK: dims=${e.dimensions} model='${e.model}' tokens=${e.usage.totalTokens ?? "?"}`,
  );
}

main().catch((err) => {
  console.error("[ai-provider] SMOKE FAILED:", err);
  process.exitCode = 1;
});
