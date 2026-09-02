import { defineConfig, devices } from "@playwright/test";

const DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN ?? "localhost";
const BASE_URL = DEV_DOMAIN.includes("localhost")
  ? `http://localhost:${process.env.PORT ?? 3000}`
  : `https://${DEV_DOMAIN}`;

const REPLIT_CHROMIUM = process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  timeout: 15000,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["list"],
    [
      "json",
      { outputFile: "tests/tests-results/.last-playwright-output.json" },
    ],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: REPLIT_CHROMIUM
          ? { executablePath: REPLIT_CHROMIUM }
          : {},
      },
    },
  ],
});
