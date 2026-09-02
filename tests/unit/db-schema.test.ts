import { describe, it, expect } from "vitest";
import {
  ingredientsTable,
  insertIngredientSchema,
  recipesTable,
  insertRecipeSchema,
  sessionsTable,
  usersTable,
} from "../../lib/db/src/schema/index";

describe("ingredientsTable schema", () => {
  it("has a serial primary key column 'id'", () => {
    expect(ingredientsTable.id).toBeDefined();
    expect(ingredientsTable.id.primary).toBe(true);
  });

  it("has required text columns: name, purchaseUnit, recipeUnit", () => {
    expect(ingredientsTable.name).toBeDefined();
    expect(ingredientsTable.purchaseUnit).toBeDefined();
    expect(ingredientsTable.recipeUnit).toBeDefined();
  });

  it("has optional text columns: supplier, category", () => {
    expect(ingredientsTable.supplier).toBeDefined();
    expect(ingredientsTable.category).toBeDefined();
  });

  it("has doublePrecision numeric columns: purchaseUnitSize, purchaseCost", () => {
    expect(ingredientsTable.purchaseUnitSize).toBeDefined();
    expect(ingredientsTable.purchaseCost).toBeDefined();
  });

  it("has timestamp columns: createdAt, updatedAt", () => {
    expect(ingredientsTable.createdAt).toBeDefined();
    expect(ingredientsTable.updatedAt).toBeDefined();
  });

  it("has cached embedding columns: embedding (jsonb), embeddingModel (text)", () => {
    expect(ingredientsTable.embedding).toBeDefined();
    expect(ingredientsTable.embeddingModel).toBeDefined();
  });
});

describe("insertIngredientSchema (Zod)", () => {
  const validIngredient = {
    name: "Plain Flour",
    purchaseUnit: "kg",
    purchaseUnitSize: 5,
    purchaseCost: 12.5,
    recipeUnit: "g",
    supplier: "Quality Grains",
    category: "Dry Goods",
  };

  it("accepts a valid ingredient object", () => {
    const result = insertIngredientSchema.safeParse(validIngredient);
    expect(result.success).toBe(true);
  });

  it("rejects when name is missing", () => {
    const { name: _, ...withoutName } = validIngredient;
    const result = insertIngredientSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
  });

  it("rejects when purchaseCost is not a number", () => {
    const result = insertIngredientSchema.safeParse({
      ...validIngredient,
      purchaseCost: "not-a-number",
    });
    expect(result.success).toBe(false);
  });

  it("accepts any numeric purchaseUnitSize (drizzle-zod does not add min(0) by default)", () => {
    const result = insertIngredientSchema.safeParse({
      ...validIngredient,
      purchaseUnitSize: -1,
    });
    expect(result.success).toBe(true);
  });

  it("allows supplier and category to be null/undefined (optional)", () => {
    const { supplier: _, category: __, ...minimal } = validIngredient;
    const result = insertIngredientSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it("does not include id, createdAt, or updatedAt (they are omitted)", () => {
    const shape = insertIngredientSchema.shape;
    expect((shape as Record<string, unknown>).id).toBeUndefined();
    expect((shape as Record<string, unknown>).createdAt).toBeUndefined();
    expect((shape as Record<string, unknown>).updatedAt).toBeUndefined();
  });
});

describe("recipesTable schema", () => {
  it("has a serial primary key column 'id'", () => {
    expect(recipesTable.id).toBeDefined();
    expect(recipesTable.id.primary).toBe(true);
  });

  it("has required text column: title", () => {
    expect(recipesTable.title).toBeDefined();
  });

  it("has integer column: servings", () => {
    expect(recipesTable.servings).toBeDefined();
  });

  it("has doublePrecision columns: wastagePercent, foodCostPercent", () => {
    expect(recipesTable.wastagePercent).toBeDefined();
    expect(recipesTable.foodCostPercent).toBeDefined();
  });

  it("has jsonb columns: method, ingredients", () => {
    expect(recipesTable.method).toBeDefined();
    expect(recipesTable.ingredients).toBeDefined();
  });

  it("has text array columns: tags, allergens", () => {
    expect(recipesTable.tags).toBeDefined();
    expect(recipesTable.allergens).toBeDefined();
  });
});

describe("insertRecipeSchema (Zod)", () => {
  const validRecipe = {
    title: "Roast Chicken",
    description: "Classic roast chicken",
    servings: 4,
    wastagePercent: 10,
    foodCostPercent: 30,
    tags: ["protein", "poultry"],
    allergens: [],
    method: [{ type: "numbered", content: "Roast at 180°C.", order: 0 }],
    ingredients: [],
    authorName: "Chef Test",
  };

  it("accepts a valid recipe object", () => {
    const result = insertRecipeSchema.safeParse(validRecipe);
    expect(result.success).toBe(true);
  });

  it("rejects when title is missing", () => {
    const { title: _, ...withoutTitle } = validRecipe;
    const result = insertRecipeSchema.safeParse(withoutTitle);
    expect(result.success).toBe(false);
  });

  it("accepts recipe with missing optional fields (description, authorName)", () => {
    const { description: _, authorName: __, ...minimal } = validRecipe;
    const result = insertRecipeSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it("does not include id, createdAt, or updatedAt", () => {
    const shape = insertRecipeSchema.shape;
    expect((shape as Record<string, unknown>).id).toBeUndefined();
    expect((shape as Record<string, unknown>).createdAt).toBeUndefined();
    expect((shape as Record<string, unknown>).updatedAt).toBeUndefined();
  });
});

describe("sessionsTable schema", () => {
  it("has a varchar primary key 'sid'", () => {
    expect(sessionsTable.sid).toBeDefined();
    expect(sessionsTable.sid.primary).toBe(true);
  });

  it("has a jsonb 'sess' column and timestamp 'expire' column", () => {
    expect(sessionsTable.sess).toBeDefined();
    expect(sessionsTable.expire).toBeDefined();
  });
});

describe("usersTable schema", () => {
  it("has a varchar primary key 'id'", () => {
    expect(usersTable.id).toBeDefined();
    expect(usersTable.id.primary).toBe(true);
  });

  it("has required 'email' column", () => {
    expect(usersTable.email).toBeDefined();
  });

  it("has optional auth columns: passwordHash, googleSub", () => {
    expect(usersTable.passwordHash).toBeDefined();
    expect(usersTable.googleSub).toBeDefined();
  });

  it("has permissions text-array column", () => {
    expect(usersTable.permissions).toBeDefined();
  });

  it("has jsonb columns for embedded subdocuments: address, nextOfKin", () => {
    expect(usersTable.address).toBeDefined();
    expect(usersTable.nextOfKin).toBeDefined();
  });

  it("exports User and UpsertUser inferred types", async () => {
    const schemaModule = await import("../../lib/db/src/schema/auth");
    expect(typeof schemaModule.usersTable).toBe("object");
  });
});
