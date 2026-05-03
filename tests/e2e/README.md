---
title: E2E Tests
category: e2e
runner: Playwright (Chromium)
command: pnpm test:e2e
last_updated: "2026-05-02"
---

# E2E Tests

Browser-level end-to-end tests for the `artifacts/recipe-coster` React frontend. Tests run against the live dev server using Playwright with Chromium.

**Target URL:** Resolved from `REPLIT_DEV_DOMAIN` env var (see `playwright.config.ts`). The app must be running before executing these tests.

## Prerequisites

- The Recipe Coster web artifact workflow must be running.
- The API Server workflow must be running (frontend calls `/api/*`).
- `REPLIT_DEV_DOMAIN` must be set (automatically set in the Replit environment).

> **NixOS / Replit setup:** Playwright's bundled Chromium can't load `libglib-2.0.so.0` on NixOS, so we use the Replit-provided patchelfed Chromium binary instead. The `playwright-driver` Nix package supplies it via the `REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE` environment variable, and `playwright.config.ts` passes it through `launchOptions.executablePath` when present. This makes `pnpm test:e2e` launch and run Chromium successfully inside Replit. (`playwright-driver` is declared in `replit.nix`; if it ever goes missing, reinstall with the package management tool.)

## Test files

| File                         | What it covers                                                                                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.spec.ts`               | Auth gate presence, Login/Sign-up tabs, signup form fields, login empty-submit stays on auth gate, successful signup transitions away                                                                                |
| `dashboard.spec.ts`          | Authenticated user sees app (not auth gate), numeric stats present, AUD currency format ($A), page title non-empty, no critical JS errors                                                                            |
| `route-guards.spec.ts`       | 6 protected routes unauthenticated → shows auth gate and not page content                                                                                                                                            |
| `recipe-builder.spec.ts`     | `/recipes/new` shows builder form, has servings/wastage/cost controls, save creates a recipe (verified via API), cost breakdown tab, recipe update via API reflected in library, delete via API removes from library |
| `ingredient-library.spec.ts` | `/ingredients` renders library, has search input, added ingredient appears, empty search shows empty state, update via API reflected in page, delete via API removes from page                                       |
| `ai-generation.spec.ts`      | Recipe generator accessible, `page.route()` mocks: successful generation renders title, 500 error shows user-friendly message, 429 quota shows quota message                                                         |

---

### `auth.spec.ts`

**Unauthenticated user sees auth gate, not the app**

- Asserts auth tab is visible AND recipe/ingredient content is NOT visible.

**Auth gate shows Login and Sign up tabs**

- Confirms both tabs are present on the initial auth screen.

**Signup form has email and password fields**

- Clicks Sign up tab and checks for email + password inputs.

**Login form empty submit stays on auth gate**

- Submits empty form, confirms password field still visible and no dashboard content.

**Successful signup transitions away from auth gate**

- Fills signup form with unique test credentials, submits, and asserts auth tabs disappear.

---

### `dashboard.spec.ts`

**Authenticated user sees app, not auth gate**

- Creates test user via API, logs in, navigates to `/menu-development/recipe-coster`, asserts no auth tabs visible.

**Dashboard shows numeric stats**

- Confirms digits appear in body text (recipe/ingredient counts).

**AUD currency format**

- Asserts `$X.XX` pattern if any currency values are rendered.

**Page title non-empty and not generic**

- Confirms `document.title` is set and not the Vite default.

**No critical JS errors on load**

- `pageerror` listener confirms no unhandled errors on initial navigation.

---

### `route-guards.spec.ts`

Tests 6 protected routes: `/menu-development/recipe-coster`, `/menu-development/recipe-library`, `/menu-development/recipe-generator`, `/ingredients`, `/recipes/new`, `/inventory/product-search`. Each confirms auth gate is shown and page-specific content is absent.

---

### `recipe-builder.spec.ts`

**`/recipes/new` shows the builder form**

- Confirms auth gate not shown and title input visible.

**Has servings, wastage, and food-cost controls**

- Asserts servings input present and body mentions cost.

**Save creates a recipe verifiable via API**

- Fills title, clicks save, then queries `GET /api/recipes?search=<title>` and confirms the recipe exists.

**Cost breakdown tab accessible**

- Clicks cost breakdown tab (if present) and confirms cost-related content.

**Recipe update is reflected in the library**

- Creates a recipe via API, PATCHes its title, navigates to `/recipes`, asserts the updated title is visible.

**Recipe delete removes it from the library**

- Creates a recipe via API, confirms it appears in `/recipes`, DELETEs it via API, reloads, asserts it is gone.

---

### `ingredient-library.spec.ts`

**Page renders ingredient library**

- Navigates to `/ingredients`, no auth gate, body mentions "ingredient".

**Has a search input**

- Confirms `<input>` with search placeholder is visible.

**Ingredient added via API appears in the list**

- Creates ingredient via `POST /api/ingredients`, navigates to page, searches by name, asserts it's visible.

**Empty search shows empty state**

- Searches for a random non-existent name, asserts empty-state text.

**Ingredient update is reflected in the page**

- Creates ingredient via API, PATCHes its name, navigates to `/ingredients`, searches for the new name, asserts it's visible.

**Ingredient delete removes it from the page**

- Creates ingredient via API, confirms it appears, DELETEs via API, reloads and searches again, asserts it is gone.

---

### `ai-generation.spec.ts`

**Recipe generator is accessible to authenticated users**

- No auth gate, body mentions recipe/generate/ai.

**Mocked success response renders recipe title**

- `page.route()` intercepts `/api/openai/generate-recipe` and returns `{ title: "Vegetarian Pasta Bake", ... }`. Fills prompt, clicks generate, asserts title appears in body.

**Mocked 500 error shows user-friendly message**

- Route returns 500, asserts error/failed/try-again text visible.

**Mocked 429 quota-exceeded shows quota message**

- Route returns 429, asserts limit/quota message visible.
