import type {
  ChatCompleteOptions,
  ChatCompleteResult,
  ChatProvider,
} from "../types.js";

interface OpenAICompatibleClientConfig {
  apiKey: string;
  baseURL?: string;
}

interface OpenAIChatClient {
  chat: {
    completions: {
      create: (args: Record<string, unknown>) => Promise<{
        choices: Array<{ message?: { content?: string | null } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
        model?: string;
      }>;
    };
  };
}

interface OpenAIModuleLike {
  default: new (opts: { apiKey: string; baseURL?: string }) => OpenAIChatClient;
}

/**
 * Shared implementation for any OpenAI-API-compatible chat backend.
 * The Replit AI proxy, OpenAI direct, and OpenRouter all expose the
 * same `chat.completions.create` shape, so we keep one builder and
 * vary only `apiKey` / `baseURL` / `defaultModel`.
 */
export function createOpenAICompatibleProvider(
  name: ChatProvider["name"],
  defaultModel: string,
  config: OpenAICompatibleClientConfig,
): ChatProvider {
  let clientPromise: Promise<OpenAIChatClient> | null = null;

  async function getClient(): Promise<OpenAIChatClient> {
    if (!clientPromise) {
      clientPromise = (async () => {
        const mod = (await import("openai")) as unknown as OpenAIModuleLike;
        const OpenAI = mod.default;
        return new OpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
      })();
    }
    return clientPromise;
  }

  return {
    name,
    defaultModel,
    async chatComplete(opts: ChatCompleteOptions): Promise<ChatCompleteResult> {
      const client = await getClient();
      const model = opts.model ?? defaultModel;
      const args: Record<string, unknown> = {
        model,
        messages: opts.messages,
      };
      if (opts.maxTokens != null) args.max_completion_tokens = opts.maxTokens;
      if (opts.jsonMode) args.response_format = { type: "json_object" };

      const completion = await client.chat.completions.create(args);
      const text = completion.choices[0]?.message?.content?.trim() ?? "";
      return {
        text,
        usage: {
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
        },
        model: completion.model ?? model,
      };
    },
  };
}
