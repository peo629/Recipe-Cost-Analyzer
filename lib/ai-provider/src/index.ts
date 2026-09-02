import type { ChatProvider, EmbeddingProvider } from "./types.js";

export type {
  ChatMessage,
  ChatRole,
  ChatCompleteOptions,
  ChatCompleteResult,
  ChatUsage,
  ChatProvider,
  EmbedOptions,
  EmbedResult,
  EmbedUsage,
  EmbeddingProvider,
} from "./types.js";

let cachedChatProvider: ChatProvider | null = null;
let cachedEmbeddingProvider: EmbeddingProvider | null = null;

/**
 * Resolve and cache the active chat provider. Selected by `AI_PROVIDER`:
 *
 *   - `replit`     (default — Replit AI Integrations proxy, no key needed)
 *   - `openai`     (OPENAI_API_KEY)
 *   - `openrouter` (OPENROUTER_API_KEY)
 *
 * Lazy: the underlying SDK is only loaded the first time `chatComplete`
 * runs, so unused providers don't bloat the bundle.
 */
export async function getChatProvider(): Promise<ChatProvider> {
  if (cachedChatProvider) return cachedChatProvider;
  const which = (process.env.AI_PROVIDER ?? "replit").toLowerCase();
  switch (which) {
    case "replit": {
      const { createReplitChatProvider } = await import("./chat/replit.js");
      cachedChatProvider = createReplitChatProvider();
      break;
    }
    case "openai": {
      const { createOpenAIChatProvider } = await import("./chat/openai.js");
      cachedChatProvider = createOpenAIChatProvider();
      break;
    }
    case "openrouter": {
      const { createOpenRouterChatProvider } =
        await import("./chat/openrouter.js");
      cachedChatProvider = createOpenRouterChatProvider();
      break;
    }
    default:
      throw new Error(
        `Unknown AI_PROVIDER='${which}'. Expected one of: replit, openai, openrouter.`,
      );
  }
  return cachedChatProvider;
}

/**
 * Resolve and cache the active embedding provider. Selected by
 * `EMBEDDING_PROVIDER`:
 *
 *   - `voyage` (VOYAGE_API_KEY) — preferred for retrieval / RAG
 *   - `openai` (OPENAI_API_KEY) — default fallback
 *
 * Default: `voyage` if VOYAGE_API_KEY is present, otherwise `openai`.
 * The Replit AI proxy does not expose embeddings, so neither default
 * uses it.
 */
export async function getEmbeddingProvider(): Promise<EmbeddingProvider> {
  if (cachedEmbeddingProvider) return cachedEmbeddingProvider;
  const explicit = process.env.EMBEDDING_PROVIDER?.toLowerCase();
  const which = explicit ?? (process.env.VOYAGE_API_KEY ? "voyage" : "openai");
  switch (which) {
    case "voyage": {
      const { createVoyageEmbeddingProvider } =
        await import("./embed/voyage.js");
      cachedEmbeddingProvider = createVoyageEmbeddingProvider();
      break;
    }
    case "openai": {
      const { createOpenAIEmbeddingProvider } =
        await import("./embed/openai.js");
      cachedEmbeddingProvider = createOpenAIEmbeddingProvider();
      break;
    }
    default:
      throw new Error(
        `Unknown EMBEDDING_PROVIDER='${which}'. Expected one of: openai, voyage.`,
      );
  }
  return cachedEmbeddingProvider;
}

/** Convenience passthrough that resolves the active provider per call. */
export async function chatComplete(
  opts: import("./types.js").ChatCompleteOptions,
): Promise<import("./types.js").ChatCompleteResult> {
  const provider = await getChatProvider();
  return provider.chatComplete(opts);
}

export async function embed(
  opts: import("./types.js").EmbedOptions,
): Promise<import("./types.js").EmbedResult> {
  const provider = await getEmbeddingProvider();
  return provider.embed(opts);
}

/** Test helper — resets the cached providers so a new env can be picked up. */
export function _resetProviderCache(): void {
  cachedChatProvider = null;
  cachedEmbeddingProvider = null;
}
