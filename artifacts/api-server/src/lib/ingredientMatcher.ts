import { eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db, ingredientsTable, type Ingredient } from "@workspace/db";
import { embed, getEmbeddingProvider } from "@workspace/ai-provider";

export interface MatchOptions {
  /** Maximum number of candidates to return (default 5). */
  limit?: number;
  /** Minimum cosine similarity (0..1) to include a match (default 0). */
  minScore?: number;
  /**
   * If true, ingredients without a cached embedding are embedded on the fly
   * and persisted before scoring. Defaults to true so the matcher works on
   * a cold cache.
   */
  backfill?: boolean;
}

export interface MatchResult {
  ingredient: Ingredient;
  score: number;
}

/**
 * Build the canonical text we embed for a candidate SKU. Including supplier
 * and category gives the embedding more signal when ingredient names alone
 * are ambiguous (e.g. "cream" — "Quality Dairy / Dairy" vs "Cleaning Co /
 * Chemicals").
 */
export function ingredientEmbeddingText(ing: {
  name: string;
  supplier: string | null;
  category: string | null;
}): string {
  const parts = [ing.name];
  if (ing.category) parts.push(ing.category);
  if (ing.supplier) parts.push(ing.supplier);
  return parts.join(" — ");
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i]!;
    const bv = b[i]!;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Embed any candidates that are missing a cached vector OR whose cached
 * vector was produced by a different provider/model. Persisted in the
 * `embedding` + `embedding_model` columns. Returns the updated rows.
 */
export async function ensureEmbeddings(
  rows: Ingredient[],
): Promise<Ingredient[]> {
  const provider = await getEmbeddingProvider();
  const modelTag = `${provider.name}:${provider.defaultModel}`;
  const stale = rows.filter(
    (r) =>
      !Array.isArray(r.embedding) ||
      r.embedding.length === 0 ||
      r.embeddingModel !== modelTag,
  );
  if (stale.length === 0) return rows;

  const inputs = stale.map(ingredientEmbeddingText);
  const result = await embed({ input: inputs });

  const updated = new Map<number, Ingredient>();
  for (let i = 0; i < stale.length; i++) {
    const row = stale[i]!;
    const vector = result.embeddings[i]!;
    const [persisted] = await db
      .update(ingredientsTable)
      .set({ embedding: vector, embeddingModel: modelTag })
      .where(eq(ingredientsTable.id, row.id))
      .returning();
    if (persisted) updated.set(persisted.id, persisted);
  }
  return rows.map((r) => updated.get(r.id) ?? r);
}

/**
 * Match a free-text ingredient query against the inventory using vector
 * similarity. Works under any `EMBEDDING_PROVIDER` because both the query
 * and the candidates go through the same provider.
 */
export async function matchIngredient(
  query: string,
  opts: MatchOptions = {},
): Promise<MatchResult[]> {
  const limit = opts.limit ?? 5;
  const minScore = opts.minScore ?? 0;
  const backfill = opts.backfill ?? true;

  const trimmed = query.trim();
  if (!trimmed) return [];

  const provider = await getEmbeddingProvider();
  const modelTag = `${provider.name}:${provider.defaultModel}`;

  const allRows = await db.select().from(ingredientsTable);
  if (allRows.length === 0) return [];

  const candidates = backfill
    ? await ensureEmbeddings(allRows)
    : allRows.filter(
        (r) =>
          Array.isArray(r.embedding) &&
          r.embedding.length > 0 &&
          r.embeddingModel === modelTag,
      );

  const queryResult = await embed({ input: trimmed });
  const queryVec = queryResult.embeddings[0];
  if (!queryVec) return [];

  const scored: MatchResult[] = [];
  for (const row of candidates) {
    const vec = row.embedding;
    if (!Array.isArray(vec) || vec.length !== queryVec.length) continue;
    const score = cosineSimilarity(queryVec, vec);
    if (score >= minScore) scored.push({ ingredient: row, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Invalidate the cached embedding for one or more ingredients. Call this
 * from any code path that mutates name / supplier / category.
 */
export async function invalidateEmbeddings(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  await db
    .update(ingredientsTable)
    .set({ embedding: null, embeddingModel: null })
    .where(inArray(ingredientsTable.id, ids));
}

/** Diagnostic — count rows missing an embedding for the active provider. */
export async function countMissingEmbeddings(): Promise<number> {
  const provider = await getEmbeddingProvider();
  const modelTag = `${provider.name}:${provider.defaultModel}`;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ingredientsTable)
    .where(
      or(
        isNull(ingredientsTable.embedding),
        sql`${ingredientsTable.embeddingModel} IS DISTINCT FROM ${modelTag}`,
      ),
    );
  return row?.count ?? 0;
}
