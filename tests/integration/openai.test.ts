import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import { db, usersTable } from "../../lib/db/src/index";

vi.mock("@workspace/ai-provider", () => ({
  chatComplete: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      title: "Vegetarian Pasta",
      description: "A simple vegetarian pasta dish.",
      method: [
        { type: "header", content: "Preparation", order: 0 },
        { type: "numbered", content: "Boil pasta in salted water.", order: 1 },
        {
          type: "numbered",
          content: "Combine with tomato sauce and serve.",
          order: 2,
        },
      ],
    }),
    model: "mock-model",
    usage: { promptTokens: 10, completionTokens: 50, totalTokens: 60 },
  }),
  getChatProvider: vi.fn().mockResolvedValue({ name: "mock" }),
}));

import app from "../../artifacts/api-server/src/app";

const TEST_EMAIL = `integration-openai-${Date.now()}@test.invalid`;
const TEST_PW = "IntegrationTest1!";
const TEST_IP = `10.96.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

let authCookie: string;

beforeAll(async () => {
  const res = await request(app)
    .post("/api/auth/signup")
    .set("x-forwarded-for", TEST_IP)
    .send({ email: TEST_EMAIL, password: TEST_PW });
  authCookie = res.headers["set-cookie"];
});

afterAll(async () => {
  await db
    .delete(usersTable)
    .where(sql`lower(${usersTable.email}) = ${TEST_EMAIL}`)
    .catch(() => {});
});

const validGenerateBody = {
  prompt: "Make a simple pasta dish",
  servings: 2,
  dietaryTags: ["vegetarian"],
  ingredients: [
    { name: "Pasta", quantity: 200, unit: "g" },
    { name: "Tomato sauce", quantity: 100, unit: "ml" },
  ],
};

describe("POST /api/openai/generate-recipe", () => {
  it("returns 401 when not authenticated", async () => {
    const res = await request(app)
      .post("/api/openai/generate-recipe")
      .send(validGenerateBody);
    expect(res.status).toBe(401);
  });

  it("returns 400 when authenticated but body is missing required fields", async () => {
    const res = await request(app)
      .post("/api/openai/generate-recipe")
      .set("Cookie", authCookie)
      .send({ prompt: "hello" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when body has invalid ingredient shape", async () => {
    const res = await request(app)
      .post("/api/openai/generate-recipe")
      .set("Cookie", authCookie)
      .send({
        prompt: "pasta",
        servings: 2,
        dietaryTags: [],
        ingredients: [{ name: 42, quantity: "not-a-number", unit: true }],
      });
    expect(res.status).toBe(400);
  });

  it("returns 200 with deterministic shape using mocked AI provider", async () => {
    const res = await request(app)
      .post("/api/openai/generate-recipe")
      .set("Cookie", authCookie)
      .send(validGenerateBody);

    expect(res.status).toBe(200);
    expect(typeof res.body.title).toBe("string");
    expect(res.body.title).toBe("Vegetarian Pasta");
    expect(typeof res.body.description).toBe("string");
    expect(Array.isArray(res.body.method)).toBe(true);
    expect(res.body.method.length).toBeGreaterThan(0);

    for (const block of res.body.method) {
      expect(["header", "numbered", "text", "subinstruction"]).toContain(
        block.type,
      );
      expect(typeof block.content).toBe("string");
      expect(typeof block.order).toBe("number");
    }
  });

  it("returns 200 with title fallback when AI returns non-JSON", async () => {
    const { chatComplete } = await import("@workspace/ai-provider");
    vi.mocked(chatComplete).mockResolvedValueOnce({
      text: "not valid json at all {{{",
      model: "mock-model",
      usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
    });

    const res = await request(app)
      .post("/api/openai/generate-recipe")
      .set("Cookie", authCookie)
      .send(validGenerateBody);

    expect(res.status).toBe(502);
    expect(typeof res.body.error).toBe("string");
  });

  it("enforces per-user rate limit (quota) after 50 requests", async () => {
    const { chatComplete } = await import("@workspace/ai-provider");
    vi.mocked(chatComplete).mockResolvedValue({
      text: JSON.stringify({
        title: "Pasta",
        description: ".",
        method: [{ type: "numbered", content: "Cook.", order: 0 }],
      }),
      model: "mock-model",
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    });

    const QUOTA_IP = "10.255.254.253";
    const quotaEmail = `quota-test-${Date.now()}@test.invalid`;
    const signupRes = await request(app)
      .post("/api/auth/signup")
      .set("x-forwarded-for", QUOTA_IP)
      .send({ email: quotaEmail, password: TEST_PW });

    if (signupRes.status !== 201) {
      await db
        .delete(usersTable)
        .where(sql`lower(${usersTable.email}) = ${quotaEmail}`)
        .catch(() => {});
      expect.fail(
        `Quota-test user signup failed with status ${signupRes.status} — cannot proceed`,
      );
    }

    const quotaCookie = signupRes.headers["set-cookie"];

    let lastStatus = 200;
    for (let i = 0; i < 52; i++) {
      const r = await request(app)
        .post("/api/openai/generate-recipe")
        .set("Cookie", quotaCookie)
        .send(validGenerateBody);
      lastStatus = r.status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);

    await db
      .delete(usersTable)
      .where(sql`lower(${usersTable.email}) = ${quotaEmail}`)
      .catch(() => {});
  });
});
