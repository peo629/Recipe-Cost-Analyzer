import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import app from "../../artifacts/api-server/src/app";
import {
  db,
  usersTable,
  recipesTable,
  ingredientsTable,
} from "../../lib/db/src/index";

const TEST_EMAIL = `integration-recipes-${Date.now()}@test.invalid`;
const TEST_PW = "IntegrationTest1!";
const TEST_IP = `10.97.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

let authCookie: string;
let createdId: number;
let costRecipeId: number;
let costIngredientId: number;

beforeAll(async () => {
  const res = await request(app)
    .post("/api/auth/signup")
    .set("x-forwarded-for", TEST_IP)
    .send({ email: TEST_EMAIL, password: TEST_PW });
  authCookie = res.headers["set-cookie"];
});

afterAll(async () => {
  if (createdId) {
    await db
      .delete(recipesTable)
      .where(sql`${recipesTable.id} = ${createdId}`)
      .catch(() => {});
  }
  if (costRecipeId) {
    await db
      .delete(recipesTable)
      .where(sql`${recipesTable.id} = ${costRecipeId}`)
      .catch(() => {});
  }
  if (costIngredientId) {
    await db
      .delete(ingredientsTable)
      .where(sql`${ingredientsTable.id} = ${costIngredientId}`)
      .catch(() => {});
  }
  await db
    .delete(usersTable)
    .where(sql`lower(${usersTable.email}) = ${TEST_EMAIL}`)
    .catch(() => {});
});

const validRecipe = {
  title: `Test Recipe ${Date.now()}`,
  description: "A test recipe",
  servings: 4,
  wastagePercent: 10,
  foodCostPercent: 30,
  tags: ["test"],
  allergens: [],
  method: [{ type: "text", content: "Mix everything together.", order: 0 }],
  ingredients: [],
};

describe("GET /api/recipes/stats/summary", () => {
  it("returns summary stats", async () => {
    const res = await request(app)
      .get("/api/recipes/stats/summary")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalRecipes).toBe("number");
    expect(typeof res.body.totalIngredients).toBe("number");
    expect(Array.isArray(res.body.recentRecipes)).toBe(true);
  });
});

describe("GET /api/recipes", () => {
  it("returns an array of recipe summaries", async () => {
    const res = await request(app)
      .get("/api/recipes")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("supports search query param", async () => {
    const res = await request(app)
      .get("/api/recipes?search=pasta")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("supports tag filter", async () => {
    const res = await request(app)
      .get("/api/recipes?tag=vegetarian")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /api/recipes", () => {
  it("rejects missing required fields with 400", async () => {
    const res = await request(app)
      .post("/api/recipes")
      .set("Cookie", authCookie)
      .send({ title: "Incomplete" });
    expect(res.status).toBe(400);
  });

  it("creates a recipe and returns 201 with full recipe object", async () => {
    const res = await request(app)
      .post("/api/recipes")
      .set("Cookie", authCookie)
      .send(validRecipe);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe(validRecipe.title);
    expect(res.body.costSummary).toBeDefined();
    expect(typeof res.body.costSummary.totalIngredientCost).toBe("number");
    createdId = res.body.id;
  });
});

describe("GET /api/recipes/:id", () => {
  it("returns 404 for non-existent recipe", async () => {
    const res = await request(app)
      .get("/api/recipes/999999999")
      .set("Cookie", authCookie);
    expect(res.status).toBe(404);
  });

  it("returns the created recipe by id", async () => {
    const res = await request(app)
      .get(`/api/recipes/${createdId}`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdId);
    expect(res.body.title).toBe(validRecipe.title);
    expect(res.body.ingredients).toBeDefined();
    expect(res.body.costSummary).toBeDefined();
  });

  it("returns 400 for non-numeric id", async () => {
    const res = await request(app)
      .get("/api/recipes/not-a-number")
      .set("Cookie", authCookie);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/recipes/:id", () => {
  it("updates the recipe title", async () => {
    const newTitle = `Updated Recipe ${Date.now()}`;
    const res = await request(app)
      .patch(`/api/recipes/${createdId}`)
      .set("Cookie", authCookie)
      .send({ title: newTitle });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe(newTitle);
  });

  it("updates servings and recalculates costSummary", async () => {
    const res = await request(app)
      .patch(`/api/recipes/${createdId}`)
      .set("Cookie", authCookie)
      .send({ servings: 8 });
    expect(res.status).toBe(200);
    expect(res.body.servings).toBe(8);
    expect(res.body.costSummary.servings).toBe(8);
  });

  it("returns 404 for non-existent recipe", async () => {
    const res = await request(app)
      .patch("/api/recipes/999999999")
      .set("Cookie", authCookie)
      .send({ title: "Ghost" });
    expect(res.status).toBe(404);
  });
});

describe("POST/GET /api/recipes with real ingredients (cost math end-to-end)", () => {
  it("creates an ingredient + recipe and returns correct cost values via the API", async () => {
    const ingredientPayload = {
      name: `Cost Math Flour ${Date.now()}`,
      purchaseUnit: "kg",
      purchaseUnitSize: 5,
      purchaseCost: 12.5,
      recipeUnit: "g",
      supplier: "Cost Math Supplier",
      category: "Dry Goods",
    };

    const ingRes = await request(app)
      .post("/api/ingredients")
      .set("Cookie", authCookie)
      .send(ingredientPayload);
    expect(ingRes.status).toBe(201);
    expect(ingRes.body.recipeUnitCost).toBeCloseTo(0.0025, 6);
    costIngredientId = ingRes.body.id;

    const recipePayload = {
      title: `Cost Math Recipe ${Date.now()}`,
      description: "Recipe to verify cost math end-to-end",
      servings: 4,
      wastagePercent: 10,
      foodCostPercent: 30,
      tags: ["test"],
      allergens: [],
      method: [{ type: "text", content: "Combine ingredients.", order: 0 }],
      ingredients: [
        {
          ingredientId: costIngredientId,
          quantity: 200,
          unit: "g",
        },
      ],
    };

    const recRes = await request(app)
      .post("/api/recipes")
      .set("Cookie", authCookie)
      .send(recipePayload);
    expect(recRes.status).toBe(201);
    costRecipeId = recRes.body.id;

    const getRes = await request(app)
      .get(`/api/recipes/${costRecipeId}`)
      .set("Cookie", authCookie);
    expect(getRes.status).toBe(200);

    expect(getRes.body.ingredients).toHaveLength(1);
    const line = getRes.body.ingredients[0];
    expect(line.ingredientId).toBe(costIngredientId);
    expect(line.quantity).toBe(200);
    expect(line.unit).toBe("g");
    expect(line.recipeUnitCost).toBeCloseTo(0.0025, 6);
    expect(line.lineCost).toBeCloseTo(0.5, 6);

    const cs = getRes.body.costSummary;
    expect(cs.totalIngredientCost).toBeCloseTo(0.5, 6);
    expect(cs.servings).toBe(4);
    expect(cs.costPerPortion).toBeCloseTo(0.125, 6);
    expect(cs.wastagePercent).toBe(10);
    expect(cs.wastageCost).toBeCloseTo(0.05, 6);
    expect(cs.totalCostWithWastage).toBeCloseTo(0.55, 6);
    expect(cs.costPerPortionWithWastage).toBeCloseTo(0.1375, 6);
    expect(cs.foodCostPercent).toBe(30);
    expect(cs.recommendedSalePrice).toBeCloseTo(0.4583333, 5);
  });
});

describe("DELETE /api/recipes/:id", () => {
  it("deletes the recipe and returns 204", async () => {
    const res = await request(app)
      .delete(`/api/recipes/${createdId}`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(204);
    createdId = 0;
  });

  it("returns 404 for already-deleted recipe", async () => {
    const res = await request(app)
      .delete("/api/recipes/999999999")
      .set("Cookie", authCookie);
    expect(res.status).toBe(404);
  });
});
