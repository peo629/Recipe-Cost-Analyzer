---
title: Integration Tests
category: integration
runner: Vitest + Supertest
command: pnpm test:integration
last_updated: "2026-05-02"
---

# Integration Tests

HTTP-level tests for every route group in the Express API server. Tests use [Supertest](https://github.com/ladjs/supertest) to make in-process HTTP requests against the Express app exported from `artifacts/api-server/src/app.ts` — no separate server process is started.

**Database:** The real development Postgres database (`DATABASE_URL`) is used. Each test file creates isolated test data using a unique timestamped email address and cleans up all created records in `afterAll`.

**Authentication:** Tests that exercise protected routes first sign up a test user via the API, then use the returned session cookie for subsequent requests.

**Rate limiting:** Each test file uses a unique `x-forwarded-for` IP address to avoid sharing rate-limit buckets across suites.

## Prerequisites

- `DATABASE_URL` must be set and the database must be reachable.
- The database schema must already be migrated (run `pnpm --filter @workspace/db push` if not).

## Test files

| File                  | Routes covered                | What it asserts                                                                                                      |
| --------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `auth.test.ts`        | `/api/auth/*`                 | Signup, login, logout, session check, duplicate email, wrong password, auth guard, Google OAuth route shape/contract |
| `ingredients.test.ts` | `/api/ingredients/*`          | Full CRUD cycle, search, 404s, 400s, recipeUnitCost calculation                                                      |
| `recipes.test.ts`     | `/api/recipes/*`              | Full CRUD cycle, search, tag filter, stats summary, costSummary calculation, 404s                                    |
| `openai.test.ts`      | `/api/openai/generate-recipe` | Auth guard (401), invalid body (400), valid body with real/absent AI provider, per-user quota                        |

---

### `auth.test.ts`

**`GET /api/auth/user` (unauthenticated)**

- Returns `{ user: null }` when no session cookie is set.

**`GET /api/auth/google/available`**

- Returns 200 with a boolean `available` field.

**`GET /api/auth/google` (OAuth route shape)**

- When Google credentials are configured: returns 302 redirect to `accounts.google.com`.
- When credentials are absent: returns 503 with an `error` string body.

**`GET /api/auth/google/callback` (OAuth route shape)**

- Without valid OIDC cookies (missing `codeVerifier`/`state`): returns 302 redirect to "/" — no session granted.
- When Google is not configured: returns 503.

**`POST /api/auth/signup`**

- Returns 400 for a missing body.
- Returns 400 for a weak password that fails the policy.
- Returns 201 and a `user` object (plus `Set-Cookie`) for a valid signup.
- Returns 409 when the same email is submitted twice.

**`POST /api/auth/login`**

- Returns 401 for incorrect credentials.
- Returns 200 and a `user` object (plus `Set-Cookie`) for valid credentials.
- Returns 400 for a missing email field.

**`POST /api/auth/logout`**

- Returns 200 `{ success: true }` and clears the session.

**`GET /api/auth/user` (authenticated)**

- Returns the logged-in user object when a valid session cookie is present.

**Auth guard**

- Returns 401 on `GET /api/ingredients` without a session.
- Returns 401 on `GET /api/recipes` without a session.

---

### `ingredients.test.ts`

**`GET /api/ingredients`**

- Returns a JSON array.
- Accepts a `?search=` query parameter without error.

**`POST /api/ingredients`**

- Returns 400 for an incomplete body (missing required fields).
- Returns 201 with the created ingredient including a calculated `recipeUnitCost`.
- The `recipeUnitCost` for 5 kg at $12.50 with recipe unit `g` is approximately $0.0025/g.

**`GET /api/ingredients/:id`**

- Returns 404 for a non-existent id.
- Returns 200 with the correct ingredient for a valid id.
- Returns 400 for a non-numeric id (schema coercion failure).

**`PATCH /api/ingredients/:id`**

- Updates the ingredient's name and returns the updated record.
- Returns 404 for a non-existent id.

**`DELETE /api/ingredients/:id`**

- Returns 204 on successful deletion.
- Returns 404 for a subsequently deleted or non-existent id.

---

### `recipes.test.ts`

**`GET /api/recipes/stats/summary`**

- Returns 200 with numeric `totalRecipes`, `totalIngredients`, and a `recentRecipes` array.

**`GET /api/recipes`**

- Returns a JSON array of recipe summaries.
- Accepts `?search=` and `?tag=` without error.

**`POST /api/recipes`**

- Returns 400 for an incomplete body.
- Returns 201 with a full recipe object including a `costSummary` with numeric fields.

**`GET /api/recipes/:id`**

- Returns 404 for a non-existent id.
- Returns 200 with full recipe detail (including `ingredients` array and `costSummary`).
- Returns 400 for a non-numeric id.

**`PATCH /api/recipes/:id`**

- Updates the title and returns the updated recipe.
- Updating `servings` recalculates `costSummary.servings`.
- Returns 404 for a non-existent id.

**`DELETE /api/recipes/:id`**

- Returns 204 on successful deletion.
- Returns 404 for a non-existent id.

---

### `openai.test.ts`

**`POST /api/openai/generate-recipe`**

- Returns 401 when no session cookie is present.
- Returns 400 (or related error) when the body is invalid (missing required fields).
- Returns 200 with `title` and `method` array when both auth and AI provider are configured; returns 500/502/429/503 otherwise (all acceptable since AI credentials may not be present in CI).
