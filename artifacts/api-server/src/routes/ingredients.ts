import { Router, type IRouter } from "express";
import { ilike, or, and, eq } from "drizzle-orm";
import { db, ingredientsTable } from "@workspace/db";
import {
  ListIngredientsQueryParams,
  CreateIngredientBody,
  GetIngredientParams,
  UpdateIngredientParams,
  UpdateIngredientBody,
  DeleteIngredientParams,
} from "@workspace/api-zod";
import { resolveImageUrl } from "./storage";
import { matchIngredient } from "../lib/ingredientMatcher";
import { z } from "zod/v4";

const router: IRouter = Router();

const MatchIngredientBody = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(50).optional(),
  minScore: z.number().min(0).max(1).optional(),
});

function calcRecipeUnitCost(
  purchaseCost: number,
  purchaseUnitSize: number,
  purchaseUnit: string,
  recipeUnit: string,
): number {
  // Determine conversion factor from purchase unit to recipe unit
  const conversions: Record<string, Record<string, number>> = {
    kg: { g: 1000, kg: 1 },
    g: { g: 1, kg: 0.001 },
    L: { ml: 1000, L: 1 },
    ml: { ml: 1, L: 0.001 },
    each: { each: 1 },
    dozen: { each: 12 },
  };

  const fromConversions = conversions[purchaseUnit];
  const factor = fromConversions?.[recipeUnit] ?? 1;

  const totalRecipeUnits = purchaseUnitSize * factor;
  return totalRecipeUnits > 0 ? purchaseCost / totalRecipeUnits : purchaseCost;
}

async function formatIngredient(row: typeof ingredientsTable.$inferSelect) {
  return {
    ...row,
    recipeUnitCost: calcRecipeUnitCost(
      row.purchaseCost,
      row.purchaseUnitSize,
      row.purchaseUnit,
      row.recipeUnit,
    ),
    imageKey: row.imageKey ?? null,
    imageUrl: await resolveImageUrl(row.imageKey),
  };
}

router.get("/ingredients", async (req, res): Promise<void> => {
  const query = ListIngredientsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const conditions = [];

  if (query.data.search) {
    conditions.push(
      or(
        ilike(ingredientsTable.name, `%${query.data.search}%`),
        ilike(ingredientsTable.category, `%${query.data.search}%`),
      ),
    );
  }

  if (query.data.supplier) {
    conditions.push(eq(ingredientsTable.supplier, query.data.supplier));
  }

  const rows = await db
    .select()
    .from(ingredientsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(ingredientsTable.name);

  res.json(await Promise.all(rows.map(formatIngredient)));
});

router.post("/ingredients", async (req, res): Promise<void> => {
  const parsed = CreateIngredientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .insert(ingredientsTable)
    .values({
      name: parsed.data.name,
      supplier: parsed.data.supplier ?? null,
      purchaseUnit: parsed.data.purchaseUnit,
      purchaseUnitSize: parsed.data.purchaseUnitSize,
      purchaseCost: parsed.data.purchaseCost,
      recipeUnit: parsed.data.recipeUnit,
      category: parsed.data.category ?? null,
    })
    .returning();

  res.status(201).json(await formatIngredient(row));
});

router.post("/ingredients/match", async (req, res): Promise<void> => {
  const parsed = MatchIngredientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const matches = await matchIngredient(parsed.data.query, {
      limit: parsed.data.limit,
      minScore: parsed.data.minScore,
    });
    res.json(
      await Promise.all(
        matches.map(async (m) => ({
          score: m.score,
          ingredient: await formatIngredient(m.ingredient),
        })),
      ),
    );
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Embedding match failed",
    });
  }
});

router.get("/ingredients/:id", async (req, res): Promise<void> => {
  const params = GetIngredientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(ingredientsTable)
    .where(eq(ingredientsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Ingredient not found" });
    return;
  }

  res.json(await formatIngredient(row));
});

router.patch("/ingredients/:id", async (req, res): Promise<void> => {
  const params = UpdateIngredientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateIngredientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<typeof ingredientsTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.supplier !== undefined)
    updateData.supplier = parsed.data.supplier ?? null;
  if (parsed.data.purchaseUnit !== undefined)
    updateData.purchaseUnit = parsed.data.purchaseUnit;
  if (parsed.data.purchaseUnitSize !== undefined)
    updateData.purchaseUnitSize = parsed.data.purchaseUnitSize;
  if (parsed.data.purchaseCost !== undefined)
    updateData.purchaseCost = parsed.data.purchaseCost;
  if (parsed.data.recipeUnit !== undefined)
    updateData.recipeUnit = parsed.data.recipeUnit;
  if (parsed.data.category !== undefined)
    updateData.category = parsed.data.category ?? null;

  // If any of the embedded text fields change, drop the cached vector so
  // the next match call re-embeds with the canonical text.
  const embedTextChanged =
    parsed.data.name !== undefined ||
    parsed.data.supplier !== undefined ||
    parsed.data.category !== undefined;
  if (embedTextChanged) {
    updateData.embedding = null;
    updateData.embeddingModel = null;
  }

  const [row] = await db
    .update(ingredientsTable)
    .set(updateData)
    .where(eq(ingredientsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Ingredient not found" });
    return;
  }

  res.json(await formatIngredient(row));
});

router.delete("/ingredients/:id", async (req, res): Promise<void> => {
  const params = DeleteIngredientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(ingredientsTable)
    .where(eq(ingredientsTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Ingredient not found" });
    return;
  }

  res.sendStatus(204);
});

export { calcRecipeUnitCost };
export default router;
