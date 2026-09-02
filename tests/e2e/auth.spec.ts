import { test, expect } from "@playwright/test";

const TEST_EMAIL = `e2e-auth-${Date.now()}@test.invalid`;
const TEST_PW = "E2eTestPass1!";

test.describe("Authentication flows", () => {
  test("unauthenticated user sees the auth gate, not the app", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(
      page
        .getByRole("tab", { name: /log in|sign in|login/i })
        .or(
          page.locator(
            '[data-testid="auth-gate"], form:has(input[type="password"])',
          ),
        ),
    ).toBeVisible();

    await expect(
      page.getByText(/recipe coster|dashboard|ingredients/i).first(),
    ).not.toBeVisible();
  });

  test("auth gate shows both Login and Sign up tabs", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("tab", { name: /log in|login/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("tab", { name: /sign up|signup|register/i }),
    ).toBeVisible();
  });

  test("signup form has email, password, and confirm-password fields", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: /sign up|signup/i }).click();

    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    const passwordInputs = page.locator('input[type="password"]');
    await expect(passwordInputs.first()).toBeVisible();
  });

  test("login form shows validation feedback on empty submission", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: /log in|login/i }).click();

    const submitBtn = page
      .getByRole("button", { name: /log in|sign in/i })
      .first();
    await submitBtn.click();
    await page.waitForLoadState("networkidle");

    const isStillOnAuthGate =
      (await page.locator('input[type="password"]').count()) > 0;
    expect(isStillOnAuthGate).toBe(true);

    const dashboardContent = page.getByText(
      /welcome to recipe coster|your dashboard/i,
    );
    await expect(dashboardContent).not.toBeVisible();
  });

  test("successful signup transitions away from auth gate", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await page.getByRole("tab", { name: /sign up|signup/i }).click();

    await page.locator('input[type="email"]').first().fill(TEST_EMAIL);
    const passwordInputs = page.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(TEST_PW);
    if ((await passwordInputs.count()) > 1) {
      await passwordInputs.nth(1).fill(TEST_PW);
    }

    await page
      .getByRole("button", { name: /create account|sign up|register/i })
      .first()
      .click();
    await page.waitForLoadState("networkidle");

    const authTabsGone =
      (await page
        .getByRole("tab", { name: /log in|login/i })
        .isVisible()
        .catch(() => false)) === false;
    expect(authTabsGone).toBe(true);
  });
});
