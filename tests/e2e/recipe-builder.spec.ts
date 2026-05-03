import { test, expect, type BrowserContext } from "@playwright/test";

const TEST_EMAIL = `e2e-recipe-${Date.now()}@test.invalid`;
const TEST_PW = "E2eRecipePass1!";
const RECIPE_TITLE = `E2E Test Recipe ${Date.now()}`;
const UPDATED_TITLE = `E2E Updated Recipe ${Date.now()}`;

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

test.describe("Recipe Builder", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await authenticate(context, baseURL!);
  });

  test("navigating to /recipes/new shows the recipe builder form", async ({
    page,
  }) => {
    await page.goto("/recipes/new");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('input[type="password"]')).not.toBeVisible();

    const titleField = page
      .getByLabel(/title/i)
      .or(page.locator('input[placeholder*="title" i], input[name*="title" i]'))
      .first();
    await expect(titleField).toBeVisible();
  });

  test("recipe builder has servings and cost controls", async ({ page }) => {
    await page.goto("/recipes/new");
    await page.waitForLoadState("networkidle");

    const servingsControl = page
      .getByLabel(/servings/i)
      .or(page.locator('input[name*="serving" i]'))
      .first();
    await expect(servingsControl).toBeVisible();

    const bodyText = (await page.locator("body").textContent()) ?? "";
    expect(bodyText.toLowerCase()).toMatch(/wastage|food cost|cost/);
  });

  test("filling in title and saving creates a recipe retrievable via the API", async ({
    page,
    context,
    baseURL,
  }) => {
    await page.goto("/recipes/new");
    await page.waitForLoadState("networkidle");

    const titleField = page
      .getByLabel(/title/i)
      .or(page.locator('input[placeholder*="title" i], input[name*="title" i]'))
      .first();
    await expect(titleField).toBeVisible();
    await titleField.fill(RECIPE_TITLE);

    const saveBtn = page
      .getByRole("button", { name: /save|create|add/i })
      .first();
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    await page.waitForLoadState("networkidle");

    const listRes = await context.request.get(
      `${baseURL}/api/recipes?search=${encodeURIComponent(RECIPE_TITLE)}`,
    );
    expect(listRes.status()).toBe(200);
    const recipes = (await listRes.json()) as Array<{ title: string }>;
    const saved = recipes.find((r) => r.title === RECIPE_TITLE);
    expect(saved).toBeDefined();
  });

  test("cost breakdown preview tab is present and shows cost content", async ({
    page,
  }) => {
    await page.goto("/recipes/new");
    await page.waitForLoadState("networkidle");

    const costTab = page
      .getByRole("tab", { name: /cost|breakdown/i })
      .or(page.locator('[data-value="cost"], [value="cost"]'))
      .first();

    await expect(costTab).toBeVisible();
    await costTab.click();
    await page.waitForLoadState("networkidle");

    const bodyText = (await page.locator("body").textContent()) ?? "";
    expect(bodyText.toLowerCase()).toMatch(/cost|price|total/);
  });

  test("updating a recipe title via the API is reflected in the page", async ({
    page,
    context,
    baseURL,
  }) => {
    // Create a recipe via API
    const createRes = await context.request.post(`${baseURL}/api/recipes`, {
      data: { title: RECIPE_TITLE, servings: 4 },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as { id: string; title: string };

    // Update it via PATCH
    const patchRes = await context.request.patch(
      `${baseURL}/api/recipes/${created.id}`,
      { data: { title: UPDATED_TITLE } },
    );
    expect(patchRes.status()).toBe(200);
    const updated = (await patchRes.json()) as { title: string };
    expect(updated.title).toBe(UPDATED_TITLE);

    // Verify the updated title appears in the recipe library
    await page.goto("/recipes");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(UPDATED_TITLE)).toBeVisible();

    // Cleanup
    await context.request.delete(`${baseURL}/api/recipes/${created.id}`);
  });

  test("deleting a recipe via the API removes it from the recipe library", async ({
    page,
    context,
    baseURL,
  }) => {
    // Create a recipe via API
    const createRes = await context.request.post(`${baseURL}/api/recipes`, {
      data: { title: RECIPE_TITLE, servings: 2 },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as { id: string };

    // Confirm it appears in the library
    await page.goto("/recipes");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(RECIPE_TITLE)).toBeVisible();

    // Delete via API
    const deleteRes = await context.request.delete(
      `${baseURL}/api/recipes/${created.id}`,
    );
    expect(deleteRes.status()).toBe(200);

    // Reload and verify it is gone
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(RECIPE_TITLE)).not.toBeVisible();
  });
});
