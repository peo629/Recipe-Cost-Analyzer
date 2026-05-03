import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import app from "../../artifacts/api-server/src/app";
import { db, usersTable, ingredientsTable } from "../../lib/db/src/index";

const TEST_EMAIL = `integration-ingredients-${Date.now()}@test.invalid`;
const TEST_PW = "IntegrationTest1!";
const TEST_IP = `10.98.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

let authCookie: string;
let createdId: number;

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
      .delete(ingredientsTable)
      .where(sql`${ingredientsTable.id} = ${createdId}`)
      .catch(() => {});
  }
  await db
    .delete(usersTable)
    .where(sql`lower(${usersTable.email}) = ${TEST_EMAIL}`)
    .catch(() => {});
});

const validIngredient = {
  name: `Test Flour ${Date.now()}`,
  purchaseUnit: "kg",
  purchaseUnitSize: 5,
  purchaseCost: 12.5,
  recipeUnit: "g",
  supplier: "Test Supplier",
  category: "Dry Goods",
};

describe("GET /api/ingredients", () => {
  it("returns an array", async () => {
    const res = await request(app)
      .get("/api/ingredients")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("supports search query param", async () => {
    const res = await request(app)
      .get("/api/ingredients?search=flour")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe("POST /api/ingredients", () => {
  it("rejects invalid body with 400", async () => {
    const res = await request(app)
      .post("/api/ingredients")
      .set("Cookie", authCookie)
      .send({ name: "Missing required fields" });
    expect(res.status).toBe(400);
  });

  it("creates a new ingredient and returns 201 with recipeUnitCost", async () => {
    const res = await request(app)
      .post("/api/ingredients")
      .set("Cookie", authCookie)
      .send(validIngredient);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(validIngredient.name);
    expect(typeof res.body.recipeUnitCost).toBe("number");
    expect(res.body.recipeUnitCost).toBeCloseTo(0.0025, 4);
    createdId = res.body.id;
  });
});

describe("GET /api/ingredients/:id", () => {
  it("returns 404 for non-existent id", async () => {
    const res = await request(app)
      .get("/api/ingredients/999999999")
      .set("Cookie", authCookie);
    expect(res.status).toBe(404);
  });

  it("returns the created ingredient by id", async () => {
    const res = await request(app)
      .get(`/api/ingredients/${createdId}`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdId);
    expect(res.body.name).toBe(validIngredient.name);
  });

  it("returns 400 for non-numeric id", async () => {
    const res = await request(app)
      .get("/api/ingredients/abc")
      .set("Cookie", authCookie);
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/ingredients/:id", () => {
  it("updates the ingredient name", async () => {
    const newName = `Updated Flour ${Date.now()}`;
    const res = await request(app)
      .patch(`/api/ingredients/${createdId}`)
      .set("Cookie", authCookie)
      .send({ name: newName });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe(newName);
  });

  it("returns 404 for non-existent id", async () => {
    const res = await request(app)
      .patch("/api/ingredients/999999999")
      .set("Cookie", authCookie)
      .send({ name: "Ghost" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/ingredients/:id", () => {
  it("deletes the ingredient and returns 204", async () => {
    const res = await request(app)
      .delete(`/api/ingredients/${createdId}`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(204);
    createdId = 0;
  });

  it("returns 404 for already-deleted ingredient", async () => {
    const res = await request(app)
      .delete("/api/ingredients/999999999")
      .set("Cookie", authCookie);
    expect(res.status).toBe(404);
  });
});
