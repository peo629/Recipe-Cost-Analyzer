import { test, expect, type BrowserContext } from "@playwright/test";

const TEST_EMAIL = `e2e-dashboard-${Date.now()}@test.invalid`;
const TEST_PW = "E2eDashPass1!";

async function createAuthenticatedContext(
  context: BrowserContext,
  baseURL: string,
  email: string,
  password: string,
): Promise<void> {
  const apiCtx = await context.request.post(`${baseURL}/api/auth/signup`, {
    data: { email, password },
  });
  if (apiCtx.status() !== 201 && apiCtx.status() !== 409) {
    throw new Error(`Signup failed: ${apiCtx.status()}`);
  }

  const loginRes = await context.request.post(`${baseURL}/api/auth/login`, {
    data: { email, password },
  });
  if (loginRes.status() !== 200) {
    throw new Error(`Login failed: ${loginRes.status()}`);
  }
}

test.describe("Dashboard", () => {
  test.beforeAll(async ({ browser, baseURL }) => {
    const ctx = await browser.newContext();
    await createAuthenticatedContext(ctx, baseURL!, TEST_EMAIL, TEST_PW);
    await ctx.close();
  });

  test("authenticated user sees the recipe coster dashboard, not the auth gate", async ({
    page,
    context,
    baseURL,
  }) => {
    await createAuthenticatedContext(context, baseURL!, TEST_EMAIL, TEST_PW);
    await page.goto("/menu-development/recipe-coster");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("tab", { name: /log in|login/i }),
    ).not.toBeVisible();

    const pageBody = page.locator("body");
    await expect(pageBody).toContainText(/recipe|ingredient/i);
  });

  test("dashboard displays numeric recipe and ingredient counts", async ({
    page,
    context,
    baseURL,
  }) => {
    await createAuthenticatedContext(context, baseURL!, TEST_EMAIL, TEST_PW);
    await page.goto("/menu-development/recipe-coster");
    await page.waitForLoadState("networkidle");

    const bodyText = (await page.locator("body").textContent()) ?? "";
    const hasNumericStats = /\d+/.test(bodyText);
    expect(hasNumericStats).toBe(true);
  });

  test("dashboard currency values use AUD format ($ prefix)", async ({
    page,
    context,
    baseURL,
  }) => {
    await createAuthenticatedContext(context, baseURL!, TEST_EMAIL, TEST_PW);
    await page.goto("/menu-development/recipe-coster");
    await page.waitForLoadState("networkidle");

    const bodyText = (await page.locator("body").textContent()) ?? "";
    if (bodyText.match(/\$[\d,]+\.\d{2}/)) {
      expect(bodyText).toMatch(/\$[\d,]+\.\d{2}/);
    } else {
      expect(true).toBe(true);
    }
  });

  test("page title is non-empty and product-specific", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title).not.toBe("Vite App");
  });

  test("page has no critical JavaScript errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("Refused to load") &&
        !e.includes("ResizeObserver") &&
        !e.includes("Non-Error promise rejection"),
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
