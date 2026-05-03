import { test, expect, type BrowserContext } from "@playwright/test";

const TEST_EMAIL = `e2e-ingredients-${Date.now()}@test.invalid`;
const TEST_PW = "E2eIngPass1!";
const INGREDIENT_NAME = `E2E Flour ${Date.now()}`;
const UPDATED_NAME = `E2E Updated Flour ${Date.now()}`;

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

test.describe("Ingredient Library", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await authenticate(context, baseURL!);
  });

  test("/ingredients renders the ingredient library page", async ({ page }) => {
    await page.goto("/ingredients");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('input[type="password"]')).not.toBeVisible();

    const bodyText = (await page.locator("body").textContent()) ?? "";
    expect(bodyText.toLowerCase()).toMatch(/ingredient/);
  });

  test("ingredient library has a search input", async ({ page }) => {
    await page.goto("/ingredients");
    await page.waitForLoadState("networkidle");

    const searchInput = page
      .getByPlaceholder(/search/i)
      .or(page.locator('input[type="search"]'))
      .or(page.locator('input[name*="search" i]'))
      .first();

    await expect(searchInput).toBeVisible();
  });

  test("adding an ingredient via API is reflected in the page", async ({
    page,
    context,
    baseURL,
  }) => {
    const createRes = await context.request.post(`${baseURL}/api/ingredients`, {
      data: {
        name: INGREDIENT_NAME,
        purchaseUnit: "kg",
        purchaseUnitSize: 1,
        purchaseCost: 5.0,
        recipeUnit: "g",
        supplier: "E2E Supplier",
        category: "Dry Goods",
      },
    });
    expect(createRes.status()).toBe(201);

    await page.goto("/ingredients");
    await page.waitForLoadState("networkidle");

    const searchInput = page
      .getByPlaceholder(/search/i)
      .or(page.locator('input[type="search"]'))
      .first();

    await expect(searchInput).toBeVisible();
    await searchInput.fill(INGREDIENT_NAME.split(" ")[0]);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(INGREDIENT_NAME)).toBeVisible();
  });

  test("searching for a non-existent ingredient shows empty state", async ({
    page,
  }) => {
    await page.goto("/ingredients");
    await page.waitForLoadState("networkidle");

    const searchInput = page
      .getByPlaceholder(/search/i)
      .or(page.locator('input[type="search"]'))
      .first();

    await expect(searchInput).toBeVisible();
    await searchInput.fill("xyzzy-ingredient-that-does-not-exist-12345");
    await page.waitForLoadState("networkidle");

    const bodyText = (await page.locator("body").textContent()) ?? "";
    const hasEmptySignal =
      bodyText.toLowerCase().includes("no ingredient") ||
      bodyText.toLowerCase().includes("not found") ||
      bodyText.toLowerCase().includes("no result") ||
      bodyText.toLowerCase().includes("0 ingredient");
    expect(hasEmptySignal).toBe(true);
  });

  test("updating an ingredient name via the API is reflected in the page", async ({
    page,
    context,
    baseURL,
  }) => {
    // Create the ingredient
    const createRes = await context.request.post(`${baseURL}/api/ingredients`, {
      data: {
        name: INGREDIENT_NAME,
        purchaseUnit: "kg",
        purchaseUnitSize: 1,
        purchaseCost: 3.5,
        recipeUnit: "g",
      },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as { id: string };

    // Rename it via PATCH
    const patchRes = await context.request.patch(
      `${baseURL}/api/ingredients/${created.id}`,
      { data: { name: UPDATED_NAME } },
    );
    expect(patchRes.status()).toBe(200);
    const updated = (await patchRes.json()) as { name: string };
    expect(updated.name).toBe(UPDATED_NAME);

    // Navigate to the page and search for the new name
    await page.goto("/ingredients");
    await page.waitForLoadState("networkidle");

    const searchInput = page
      .getByPlaceholder(/search/i)
      .or(page.locator('input[type="search"]'))
      .first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill(UPDATED_NAME.split(" ")[0]);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(UPDATED_NAME)).toBeVisible();

    // Cleanup
    await context.request.delete(`${baseURL}/api/ingredients/${created.id}`);
  });

  test("deleting an ingredient via the API removes it from the page", async ({
    page,
    context,
    baseURL,
  }) => {
    // Create the ingredient
    const createRes = await context.request.post(`${baseURL}/api/ingredients`, {
      data: {
        name: INGREDIENT_NAME,
        purchaseUnit: "kg",
        purchaseUnitSize: 1,
        purchaseCost: 2.0,
        recipeUnit: "g",
      },
    });
    expect(createRes.status()).toBe(201);
    const created = (await createRes.json()) as { id: string };

    // Confirm it appears on the page
    await page.goto("/ingredients");
    await page.waitForLoadState("networkidle");

    const searchInput = page
      .getByPlaceholder(/search/i)
      .or(page.locator('input[type="search"]'))
      .first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill(INGREDIENT_NAME.split(" ")[0]);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(INGREDIENT_NAME)).toBeVisible();

    // Delete it via API
    const deleteRes = await context.request.delete(
      `${baseURL}/api/ingredients/${created.id}`,
    );
    expect(deleteRes.status()).toBe(200);

    // Reload and verify it is gone
    await page.reload();
    await page.waitForLoadState("networkidle");
    await searchInput.fill(INGREDIENT_NAME.split(" ")[0]);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(INGREDIENT_NAME)).not.toBeVisible();
  });
});
