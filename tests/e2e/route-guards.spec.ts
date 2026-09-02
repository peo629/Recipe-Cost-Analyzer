import { test, expect } from "@playwright/test";

const PROTECTED_ROUTES = [
  "/menu-development/recipe-coster",
  "/menu-development/recipe-library",
  "/menu-development/recipe-generator",
  "/ingredients",
  "/recipes/new",
  "/inventory/product-search",
];

test.describe("Route guards", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`unauthenticated access to ${route} shows auth gate`, async ({
      page,
    }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");

      await expect(
        page
          .getByRole("tab", { name: /log in|sign in|login/i })
          .or(page.locator('input[type="password"]').first()),
      ).toBeVisible();

      await expect(
        page.locator("main, [data-testid='page-content']").first(),
      ).not.toContainText(
        route.includes("recipe-coster")
          ? /total recipes|avg cost/i
          : route.includes("ingredients")
            ? /add ingredient|ingredient library/i
            : route.includes("recipe-library")
              ? /recipe library/i
              : /dashboard|recipe|ingredient/i,
      );
    });
  }

  test("root route also shows auth gate when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const passwordInputVisible = await page
      .locator('input[type="password"]')
      .isVisible()
      .catch(() => false);
    const authTabVisible = await page
      .getByRole("tab", { name: /log in|login/i })
      .isVisible()
      .catch(() => false);

    expect(passwordInputVisible || authTabVisible).toBe(true);
  });
});
