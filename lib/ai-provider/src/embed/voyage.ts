import type { EmbedOptions, EmbedResult, EmbeddingProvider } from "../types.js";

const DEFAULT_MODEL = "voyage-3";
const DEFAULT_DIMS = 1024;
const ENDPOINT = "https://api.voyageai.com/v1/embeddings";

export function createVoyageEmbeddingProvider(): EmbeddingProvider {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("EMBEDDING_PROVIDER=voyage requires VOYAGE_API_KEY.");
  }

  return {
    name: "voyage",
    defaultModel: DEFAULT_MODEL,
    defaultDimensions: DEFAULT_DIMS,
    async embed(opts: EmbedOptions): Promise<EmbedResult> {
      const model = opts.model ?? DEFAULT_MODEL;
      const input = Array.isArray(opts.input) ? opts.input : [opts.input];
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Voyage embeddings failed: ${res.status} ${body}`);
      }
      const json = (await res.json()) as {
        data: Array<{ embedding: number[]; index: number }>;
        usage?: { total_tokens?: number };
        model?: string;
      };
      const embeddings = json.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
      return {
        embeddings,
        usage: { totalTokens: json.usage?.total_tokens },
        model: json.model ?? model,
        dimensions: embeddings[0]?.length ?? DEFAULT_DIMS,
      };
    },
  };
}
