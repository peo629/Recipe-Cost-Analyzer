import { Router, type IRouter } from "express";
import { ilike, or, sql, desc, inArray } from "drizzle-orm";
import { db, recipesTable, ingredientsTable } from "@workspace/db";
import {
  ListRecipesQueryParams,
  CreateRecipeBody,
  GetRecipeParams,
  UpdateRecipeParams,
  UpdateRecipeBody,
  DeleteRecipeParams,
} from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { calcRecipeUnitCost } from "./ingredients";
import { resolveImageUrl } from "./storage";

const router: IRouter = Router();

interface StoredIngredientInput {
  ingredientId: number;
  quantity: number;
  unit: string;
}

interface MethodBlockInput {
  type: string;
  content: string;
  order: number;
}

async function buildRecipeIngredients(
  ingredientInputs: StoredIngredientInput[],
) {
  if (ingredientInputs.length === 0) return [];

  const ids = ingredientInputs.map((i) => i.ingredientId);
  const dbIngredients = await db
    .select()
    .from(ingredientsTable)
    .where(inArray(ingredientsTable.id, ids));

  const ingredientMap = new Map(dbIngredients.map((i) => [i.id, i]));

  return ingredientInputs.map((input) => {
    const ing = ingredientMap.get(input.ingredientId);
    if (!ing) {
      return {
        ingredientId: input.ingredientId,
        ingredientName: "Unknown",
        quantity: input.quantity,
        unit: input.unit,
        purchaseCost: 0,
        purchaseUnit: input.unit,
        purchaseUnitSize: 1,
        recipeUnit: input.unit,
        recipeUnitCost: 0,
        lineCost: 0,
      };
    }

    const recipeUnitCost = calcRecipeUnitCost(
      ing.purchaseCost,
      ing.purchaseUnitSize,
      ing.purchaseUnit,
      ing.recipeUnit,
    );
    const lineCost = input.quantity * recipeUnitCost;

    return {
      ingredientId: input.ingredientId,
      ingredientName: ing.name,
      quantity: input.quantity,
      unit: input.unit,
      purchaseCost: ing.purchaseCost,
      purchaseUnit: ing.purchaseUnit,
      purchaseUnitSize: ing.purchaseUnitSize,
      recipeUnit: ing.recipeUnit,
      recipeUnitCost,
      lineCost,
    };
  });
}

function calcCostSummary(
  recipeIngredients: Array<{ lineCost: number }>,
  servings: number,
  wastagePercent: number,
  foodCostPercent: number,
) {
  const totalIngredientCost = recipeIngredients.reduce(
    (sum, i) => sum + i.lineCost,
    0,
  );
  const costPerPortion = servings > 0 ? totalIngredientCost / servings : 0;
  const wastageCost = totalIngredientCost * (wastagePercent / 100);
  const totalCostWithWastage = totalIngredientCost + wastageCost;
  const costPerPortionWithWastage =
    servings > 0 ? totalCostWithWastage / servings : 0;
  const recommendedSalePrice =
    foodCostPercent > 0
      ? costPerPortionWithWastage / (foodCostPercent / 100)
      : 0;

  return {
    totalIngredientCost,
    servings,
    costPerPortion,
    wastageCost,
    wastagePercent,
    totalCostWithWastage,
    costPerPortionWithWastage,
    foodCostPercent,
    recommendedSalePrice,
  };
}

async function formatRecipe(row: typeof recipesTable.$inferSelect) {
  const ingredientInputs = (row.ingredients as StoredIngredientInput[]) ?? [];
  const recipeIngredients = await buildRecipeIngredients(ingredientInputs);
  const costSummary = calcCostSummary(
    recipeIngredients,
    row.servings,
    row.wastagePercent,
    row.foodCostPercent,
  );

  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    servings: row.servings,
    wastagePercent: row.wastagePercent,
    foodCostPercent: row.foodCostPercent,
    tags: row.tags ?? [],
    allergens: row.allergens ?? [],
    method: (row.method as MethodBlockInput[]) ?? [],
    ingredients: recipeIngredients,
    costSummary,
    authorName: row.authorName ?? null,
    imageKey: row.imageKey ?? null,
    imageUrl: await resolveImageUrl(row.imageKey),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function formatRecipeSummary(
  row: typeof recipesTable.$inferSelect,
  costPerPortion: number,
  recommendedSalePrice: number,
  ingredientNames: string[] = [],
) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    servings: row.servings,
    tags: row.tags ?? [],
    allergens: row.allergens ?? [],
    ingredientNames,
    costPerPortion,
    recommendedSalePrice,
    imageKey: row.imageKey ?? null,
    imageUrl: await resolveImageUrl(row.imageKey),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

router.get("/recipes/stats/summary", async (req, res): Promise<void> => {
  const [recipeCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recipesTable);
  const [ingredientCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ingredientsTable);

  const recentRows = await db
    .select()
    .from(recipesTable)
    .orderBy(desc(recipesTable.createdAt))
    .limit(5);

  const recentRecipes = await Promise.all(
    recentRows.map(async (row) => {
      const ingInputs = (row.ingredients as StoredIngredientInput[]) ?? [];
      const recipeIngs = await buildRecipeIngredients(ingInputs);
      const costSummary = calcCostSummary(
        recipeIngs,
        row.servings,
        row.wastagePercent,
        row.foodCostPercent,
      );
      return formatRecipeSummary(
        row,
        costSummary.costPerPortion,
        costSummary.recommendedSalePrice,
        recipeIngs.map((i) => i.ingredientName),
      );
    }),
  );

  const avgCostPerPortion =
    recentRecipes.length > 0
      ? recentRecipes.reduce((s, r) => s + r.costPerPortion, 0) /
        recentRecipes.length
      : 0;
  const avgRecommendedSalePrice =
    recentRecipes.length > 0
      ? recentRecipes.reduce((s, r) => s + r.recommendedSalePrice, 0) /
        recentRecipes.length
      : 0;

  res.json({
    totalRecipes: recipeCount?.count ?? 0,
    totalIngredients: ingredientCount?.count ?? 0,
    avgCostPerPortion,
    avgRecommendedSalePrice,
    recentRecipes,
  });
});

router.get("/recipes", async (req, res): Promise<void> => {
  const query = ListRecipesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  let rows;
  if (query.data.search) {
    rows = await db
      .select()
      .from(recipesTable)
      .where(
        or(
          ilike(recipesTable.title, `%${query.data.search}%`),
          ilike(recipesTable.description, `%${query.data.search}%`),
        ),
      )
      .orderBy(desc(recipesTable.updatedAt));
  } else if (query.data.tag) {
    const tag = query.data.tag;
    rows = await db
      .select()
      .from(recipesTable)
      .where(sql`${recipesTable.tags} @> ARRAY[${tag}]::text[]`)
      .orderBy(desc(recipesTable.updatedAt));
  } else {
    rows = await db
      .select()
      .from(recipesTable)
      .orderBy(desc(recipesTable.updatedAt));
  }

  const summaries = await Promise.all(
    rows.map(async (row) => {
      const ingInputs = (row.ingredients as StoredIngredientInput[]) ?? [];
      const recipeIngs = await buildRecipeIngredients(ingInputs);
      const costSummary = calcCostSummary(
        recipeIngs,
        row.servings,
        row.wastagePercent,
        row.foodCostPercent,
      );
      return formatRecipeSummary(
        row,
        costSummary.costPerPortion,
        costSummary.recommendedSalePrice,
        recipeIngs.map((i) => i.ingredientName),
      );
    }),
  );

  res.json(summaries);
});

router.post("/recipes", async (req, res): Promise<void> => {
  const parsed = CreateRecipeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .insert(recipesTable)
    .values({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      servings: parsed.data.servings,
      wastagePercent: parsed.data.wastagePercent,
      foodCostPercent: parsed.data.foodCostPercent,
      tags: parsed.data.tags ?? [],
      allergens: parsed.data.allergens ?? [],
      method: parsed.data.method as MethodBlockInput[],
      ingredients: parsed.data.ingredients as StoredIngredientInput[],
      authorName: parsed.data.authorName ?? null,
    })
    .returning();

  const formatted = await formatRecipe(row);
  res.status(201).json(formatted);
});

router.get("/recipes/:id", async (req, res): Promise<void> => {
  const params = GetRecipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(recipesTable)
    .where(eq(recipesTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  const formatted = await formatRecipe(row);
  res.json(formatted);
});

router.patch("/recipes/:id", async (req, res): Promise<void> => {
  const params = UpdateRecipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRecipeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<typeof recipesTable.$inferInsert> = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined)
    updateData.description = parsed.data.description ?? null;
  if (parsed.data.servings !== undefined)
    updateData.servings = parsed.data.servings;
  if (parsed.data.wastagePercent !== undefined)
    updateData.wastagePercent = parsed.data.wastagePercent;
  if (parsed.data.foodCostPercent !== undefined)
    updateData.foodCostPercent = parsed.data.foodCostPercent;
  if (parsed.data.tags !== undefined) updateData.tags = parsed.data.tags;
  if (parsed.data.allergens !== undefined)
    updateData.allergens = parsed.data.allergens;
  if (parsed.data.method !== undefined)
    updateData.method = parsed.data.method as MethodBlockInput[];
  if (parsed.data.ingredients !== undefined)
    updateData.ingredients = parsed.data.ingredients as StoredIngredientInput[];
  if (parsed.data.authorName !== undefined)
    updateData.authorName = parsed.data.authorName ?? null;

  const [row] = await db
    .update(recipesTable)
    .set(updateData)
    .where(eq(recipesTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  const formatted = await formatRecipe(row);
  res.json(formatted);
});

router.delete("/recipes/:id", async (req, res): Promise<void> => {
  const params = DeleteRecipeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .delete(recipesTable)
    .where(eq(recipesTable.id, params.data.id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Recipe not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
