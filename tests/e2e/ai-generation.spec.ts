import { test, expect, type BrowserContext } from "@playwright/test";

const TEST_EMAIL = `e2e-aigen-${Date.now()}@test.invalid`;
const TEST_PW = "E2eAiPass1!";

const MOCK_RECIPE_RESPONSE = {
  title: "Vegetarian Pasta Bake",
  description: "A hearty vegetarian pasta bake with tomato sauce.",
  method: [
    { type: "header", content: "Method", order: 0 },
    { type: "numbered", content: "Preheat oven to 180°C.", order: 1 },
    { type: "numbered", content: "Cook pasta until al dente.", order: 2 },
    {
      type: "numbered",
      content: "Combine with tomato sauce in baking dish.",
      order: 3,
    },
    { type: "numbered", content: "Bake for 25 minutes.", order: 4 },
  ],
};

async function authenticate(
  context: BrowserContext,
  baseURL: string,
): Promise<void> {
  await context.request.post(`${baseURL}/api/auth/signup`, {
    data: { email: TEST_EMAIL, password: TEST_PW },
  });
  await context.request.post(`${baseURL}/api/auth/login`, {
    data: { email: TEST_EMAIL, password: TEST_PW },
  });
}

test.describe("AI Recipe Generation", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await authenticate(context, baseURL!);
  });

  test("recipe generator page is accessible to authenticated users", async ({
    page,
  }) => {
    await page.goto("/menu-development/recipe-generator");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('input[type="password"]')).not.toBeVisible();

    const bodyText = (await page.locator("body").textContent()) ?? "";
    expect(bodyText.toLowerCase()).toMatch(/recipe|generat|ai|prompt/);
  });

  test("recipe generator page has a prompt textarea and a generate button", async ({
    page,
  }) => {
    await page.goto("/menu-development/recipe-generator");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("textarea").first()).toBeVisible();

    const generateBtn = page.getByRole("button", {
      name: /generate|create recipe/i,
    });
    await expect(generateBtn.first()).toBeVisible();
  });

  test("AI generation with mocked API returns and renders generated recipe title", async ({
    page,
  }) => {
    await page.route("**/api/openai/generate-recipe", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RECIPE_RESPONSE),
      });
    });

    await page.goto("/menu-development/recipe-generator");
    await page.waitForLoadState("networkidle");

    await page
      .locator("textarea")
      .first()
      .fill("A simple vegetarian pasta dish");

    const generateBtn = page
      .getByRole("button", { name: /generate|create recipe/i })
      .first();
    await generateBtn.click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Vegetarian Pasta Bake")).toBeVisible();
  });

  test("mocked 500 error from AI API shows user-friendly error message", async ({
    page,
  }) => {
    await page.route("**/api/openai/generate-recipe", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "AI service unavailable" }),
      });
    });

    await page.goto("/menu-development/recipe-generator");
    await page.waitForLoadState("networkidle");

    await page.locator("textarea").first().fill("Something");

    const generateBtn = page
      .getByRole("button", { name: /generate|create recipe/i })
      .first();
    await generateBtn.click();
    await page.waitForLoadState("networkidle");

    const bodyText = (await page.locator("body").textContent()) ?? "";
    const hasErrorSignal =
      bodyText.toLowerCase().includes("error") ||
      bodyText.toLowerCase().includes("failed") ||
      bodyText.toLowerCase().includes("try again") ||
      bodyText.toLowerCase().includes("unavailable") ||
      bodyText.toLowerCase().includes("something went wrong");
    expect(hasErrorSignal).toBe(true);
  });

  test("mocked 429 quota-exceeded from AI API shows quota error", async ({
    page,
  }) => {
    await page.route("**/api/openai/generate-recipe", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "Daily AI generation limit reached." }),
      });
    });

    await page.goto("/menu-development/recipe-generator");
    await page.waitForLoadState("networkidle");

    await page.locator("textarea").first().fill("Something");

    const generateBtn = page
      .getByRole("button", { name: /generate|create recipe/i })
      .first();
    await generateBtn.click();
    await page.waitForLoadState("networkidle");

    const bodyText = (await page.locator("body").textContent()) ?? "";
    const hasQuotaSignal =
      bodyText.toLowerCase().includes("limit") ||
      bodyText.toLowerCase().includes("quota") ||
      bodyText.toLowerCase().includes("429") ||
      bodyText.toLowerCase().includes("try again");
    expect(hasQuotaSignal).toBe(true);
  });
});
