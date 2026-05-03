import type { EmbedOptions, EmbedResult, EmbeddingProvider } from "../types.js";

const DEFAULT_MODEL = "text-embedding-3-small";
const DEFAULT_DIMS = 1536;

interface OpenAIEmbeddingsClient {
  embeddings: {
    create: (args: { model: string; input: string | string[] }) => Promise<{
      data: Array<{ embedding: number[] }>;
      usage?: { prompt_tokens?: number; total_tokens?: number };
      model?: string;
    }>;
  };
}

interface OpenAIModuleLike {
  default: new (opts: { apiKey: string }) => OpenAIEmbeddingsClient;
}

export function createOpenAIEmbeddingProvider(): EmbeddingProvider {
  const envKey = process.env.OPENAI_API_KEY;
  if (!envKey) {
    throw new Error(
      "EMBEDDING_PROVIDER=openai requires OPENAI_API_KEY (the Replit AI proxy does not expose embeddings).",
    );
  }
  const apiKey: string = envKey;

  let clientPromise: Promise<OpenAIEmbeddingsClient> | null = null;
  async function getClient(): Promise<OpenAIEmbeddingsClient> {
    if (!clientPromise) {
      clientPromise = (async () => {
        const mod = (await import("openai")) as unknown as OpenAIModuleLike;
        const OpenAI = mod.default;
        return new OpenAI({ apiKey });
      })();
    }
    return clientPromise;
  }

  return {
    name: "openai",
    defaultModel: DEFAULT_MODEL,
    defaultDimensions: DEFAULT_DIMS,
    async embed(opts: EmbedOptions): Promise<EmbedResult> {
      const client = await getClient();
      const model = opts.model ?? DEFAULT_MODEL;
      const res = await client.embeddings.create({ model, input: opts.input });
      const embeddings = res.data.map((d) => d.embedding);
      return {
        embeddings,
        usage: {
          promptTokens: res.usage?.prompt_tokens,
          totalTokens: res.usage?.total_tokens,
        },
        model: res.model ?? model,
        dimensions: embeddings[0]?.length ?? DEFAULT_DIMS,
      };
    },
  };
}
