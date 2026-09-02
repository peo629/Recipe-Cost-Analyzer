---
title: Unit Tests
category: unit
runner: Vitest
command: pnpm test:unit
last_updated: "2026-05-02"
---

# Unit Tests

Pure function tests — no database, no network, no filesystem I/O. All external dependencies are either not imported or mocked via `vi.mock` / `vi.resetModules`.

## Test files

| File                         | Source module                                    | What it covers                                                                                                           |
| ---------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `passwords.test.ts`          | `artifacts/api-server/src/lib/passwords.ts`      | Password policy validation, bcrypt hash/verify                                                                           |
| `aiQuota.test.ts`            | `artifacts/api-server/src/lib/aiQuota.ts`        | Per-user and global daily AI request quota tracking                                                                      |
| `isOriginAllowed.test.ts`    | `artifacts/api-server/src/app.ts`                | CORS origin allowlisting in production mode                                                                              |
| `i18n.test.ts`               | `artifacts/recipe-coster/src/lib/i18n.ts`        | Currency, date, date-time, filename-date, and percent formatters                                                         |
| `csp.test.ts`                | `artifacts/recipe-coster/src/lib/csp.ts`         | CSP string construction and security header set                                                                          |
| `api-zod.test.ts`            | `lib/api-zod/src/generated/api.ts`               | Zod schema validation for all major API request/response shapes                                                          |
| `ai-provider.test.ts`        | `lib/ai-provider/src/index.ts`                   | Provider selection logic, error on missing keys, cache reset                                                             |
| `storage-provider.test.ts`   | `lib/storage-provider/src/index.ts`              | Provider selection logic, error on missing keys, cache reset                                                             |
| `calcRecipeUnitCost.test.ts` | `artifacts/api-server/src/routes/ingredients.ts` | Unit conversion math (kg→g, L→ml, dozen→each, fallback)                                                                  |
| `db-schema.test.ts`          | `lib/db/src/schema/`                             | Drizzle table column types, insertIngredientSchema/insertRecipeSchema Zod validation, sessionsTable/usersTable structure |
| `logger.test.ts`             | `artifacts/api-server/src/lib/logger.ts`         | Pino logger interface, log level, child logger, redaction smoke, production-mode assertion                               |

---

### `passwords.test.ts`

**`validatePasswordPolicy`**

- Accepts a valid 12+ character password meeting all criteria.
- Returns an error message when the password is shorter than 12 characters.
- Returns an error when the password is missing a lower-case letter.
- Returns an error when the password is missing an upper-case letter.
- Returns an error when the password is missing a digit.
- Returns an error when the password is missing a special character.
- Returns multiple errors for a completely weak password.
- Returns an empty array for a password exactly meeting all rules.
- Handles non-string input without throwing.

**`hashPassword` + `verifyPassword`**

- Hashes a password with bcrypt and verifies it correctly (round-trip).
- Returns `false` when the wrong password is verified against a hash.

---

### `aiQuota.test.ts`

**`checkAndConsumeQuota`**

- Allows the first request for any userId.
- Decrements the `remaining` count with each successive call for the same user.
- Rejects calls once the per-user daily limit (50) is exhausted, returning `allowed: false` with a human-readable `reason`.
- Returns `remaining: 0` when the user limit is hit.

---

### `isOriginAllowed.test.ts`

**`isOriginAllowed`** (exported from `app.ts`)

- Allows requests with no `Origin` header (server-to-server / curl).
- Allows empty-string origin (treated as no origin).
- Rejects an arbitrary unknown origin (`https://evil.com`).
- Rejects non-localhost HTTP origins.
- Rejects origins that superficially resemble Replit hostnames but are not.

---

### `i18n.test.ts`

**`formatCurrency`**

- Formats a positive amount with `$A` prefix and two decimal places.
- Formats zero as `$A 0.00`.
- Returns `$A 0.00` for `null`, `undefined`, and `NaN`.
- Does not include the bare `AUD` string.

**`formatUnitCost`**

- Formats with up to four decimal places.
- Returns `$A 0.0000` for `null`/`undefined`.

**`formatDate`**

- Returns `""` for `null`, `undefined`, and invalid strings.
- Formats a `Date` object to `DD/MM/YYYY`.
- Accepts a numeric timestamp.

**`formatDateTime`**

- Returns `""` for null.
- Formats a valid date-time with a time component (`HH:MM`).

**`formatDateForFilename`**

- Returns `YYYY-MM-DD`.
- Returns `""` for invalid input.
- Defaults to the current date when called with no argument.

**`formatPercent`**

- Formats to one decimal place by default.
- Respects custom `fractionDigits`.
- Handles `NaN`.

---

### `csp.test.ts`

**`buildCsp`**

- Contains `default-src 'self'` in both production and development.
- Production `script-src` does not contain `unsafe-inline` or `unsafe-eval`.
- Development `script-src` allows `unsafe-inline` and `unsafe-eval` (for Vite HMR).
- Production `frame-ancestors` is `'none'`.
- Development `frame-ancestors` allows Replit preview origins.
- Always includes `object-src 'none'`.

**`getSecurityHeaders`**

- Returns a `Content-Security-Policy` header containing `default-src`.
- Always includes `X-Content-Type-Options: nosniff`.
- `X-Frame-Options` is `DENY` in prod, `SAMEORIGIN` in dev.
- `Strict-Transport-Security` is present in prod only.
- `Referrer-Policy` is present in both modes.

---

### `api-zod.test.ts`

**`CreateIngredientBody`** — accepts valid body; rejects missing `name` or `purchaseCost`; accepts optional `supplier`/`category`.

**`SignupBody`** — accepts valid body with optional names; rejects short email; rejects password shorter than 12 chars; rejects missing email.

**`LoginBody`** — accepts valid credentials; rejects missing password; rejects empty password.

**`ListIngredientsQueryParams`** — accepts empty params, `search`, `supplier`.

**`ListRecipesQueryParams`** — accepts empty params and `search`.

**`GetIngredientParams`** — coerces string id to number; rejects non-numeric id.

**`GetRecipeParams`** — coerces string id to number.

**`GenerateRecipeBody`** — accepts valid body; accepts empty `dietaryTags`; rejects missing `ingredients`.

---

### `ai-provider.test.ts`

**`getChatProvider`** — throws descriptive error for each provider when required env vars are absent (`replit`, `openai`, `openrouter`); throws for unknown provider value.

**`getEmbeddingProvider`** — throws when `VOYAGE_API_KEY` missing for `voyage`; throws when `OPENAI_API_KEY` missing for `openai`; throws for unknown provider; `_resetProviderCache()` runs without error.

---

### `storage-provider.test.ts`

**`getStorageProvider`** — throws for unknown `STORAGE_PROVIDER` value; throws when `s3` is selected but AWS credentials are absent; `_resetStorageCache()` runs without error.

---

### `calcRecipeUnitCost.test.ts`

Tests the ingredient unit-cost conversion function exported from `ingredients.ts`:

- `kg` → `g`: 1 kg at $10 = $0.01/g
- Same-unit `kg` → `kg`: 1 kg at $10 = $10/kg
- `L` → `ml`: 2 L at $4 = $0.002/ml
- `ml` → `L`: 500 ml at $2 = $4/L
- `each` → `each`: 12 each at $6 = $0.50/each
- `dozen` → `each`: 1 dozen at $3.60 = $0.30/each
- Large purchase size: 5 kg flour at $12.50 = $0.0025/g
- Unknown recipe unit falls back gracefully.
- Zero `purchaseUnitSize` returns `purchaseCost` without dividing by zero.

---

### `db-schema.test.ts`

**`ingredientsTable` schema**

- Has a serial primary key column `id`.
- Has required text columns: `name`, `purchaseUnit`, `recipeUnit`.
- Has optional text columns: `supplier`, `category`.
- Has `doublePrecision` numeric columns: `purchaseUnitSize`, `purchaseCost`.
- Has timestamp columns: `createdAt`, `updatedAt`.

**`insertIngredientSchema` (Zod)**

- Accepts a valid ingredient object.
- Rejects when `name` is missing.
- Rejects when `purchaseCost` is not a number.
- Accepts any numeric `purchaseUnitSize` (drizzle-zod does not add `min(0)` by default).
- Allows `supplier` and `category` to be undefined (optional).
- Does not include `id`, `createdAt`, or `updatedAt` (omitted via `.omit()`).

**`recipesTable` schema**

- Has serial primary key `id`.
- Has required text column `title`.
- Has integer column `servings`.
- Has `doublePrecision` columns `wastagePercent`, `foodCostPercent`.
- Has `jsonb` columns `method`, `ingredients`.
- Has text-array columns `tags`, `allergens`.

**`insertRecipeSchema` (Zod)**

- Accepts a valid recipe object.
- Rejects when `title` is missing.
- Accepts recipe with missing optional fields (`description`, `authorName`).
- Does not include `id`, `createdAt`, or `updatedAt`.

**`sessionsTable` schema**

- Has varchar primary key `sid`.
- Has `jsonb` `sess` column and timestamp `expire` column.

**`usersTable` schema**

- Has varchar primary key `id`.
- Has required `email` column.
- Has optional auth columns: `passwordHash`, `googleSub`.
- Has `permissions` text-array column.
- Has `jsonb` columns for embedded subdocuments: `address`, `nextOfKin`.
- Exports `User` and `UpsertUser` inferred types.

---

### `logger.test.ts`

**`logger` configuration**

- Is defined and has pino logger interface (`info`, `warn`, `error`, `debug`, `trace`, `fatal`).
- Has a valid log level string from the set `trace|debug|info|warn|error|fatal|silent`.
- Defaults to `'info'` level when `LOG_LEVEL` env var is not set.
- Does not crash when logging a structured object.
- Does not crash when logging an `Error` object.
- Runs in production mode (no pino-pretty transport) since `NODE_ENV=production` in `vitest.config.ts`.
- Child logger creation does not throw and returns a logger with `info` method.

**`logger` redaction**

- Does not crash when logging a payload with `req.headers.authorization` and `req.headers.cookie` (redaction smoke test).
