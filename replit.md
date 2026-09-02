# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Locale**: Australia/Melbourne — currency `$A` (AUD), dates DD/MM/YYYY. All UI formatting goes through `artifacts/recipe-coster/src/lib/i18n.ts` (`formatCurrency`, `formatUnitCost`, `formatDate`, `formatDateTime`, `formatDateForFilename`, `formatPercent`).
- **Security**:
  - **api-server**: `helmet` with a strict API CSP (`default-src 'none'`); `frame-ancestors` is env-aware (`'none'` in prod, Replit preview origins in dev). CORS is an explicit allowlist driven by the `CORS_ORIGINS` env var (no origin reflection, safe with credentialed cookies). HSTS in prod only.
    - **`CORS_ORIGINS`** (required in prod): comma-separated list of allowed web origins for cross-origin requests, e.g. `CORS_ORIGINS=https://app.lerepertoire.com,https://lerepertoire.com`. In dev (`NODE_ENV !== "production"`) `*.replit.dev`, `*.repl.co`, and `localhost` are always allowed automatically. Disallowed origins receive a `403 {"error":"CORS_ORIGIN_NOT_ALLOWED"}`. Server-to-server requests (no `Origin` header) are always allowed.
  - **recipe-coster** web: enforce-mode CSP set by `src/lib/csp.ts` (registered as a Vite plugin) with explicit `script/style/img/font/connect` directives. Inline scripts forbidden; `data:` only for `img-src` / `font-src`. Dev relaxes `script-src` (`'unsafe-eval'`) and `connect-src`/`frame-ancestors` for HMR + the workspace preview iframe; production locks them down. Production hosting (Railway/VPS) should mirror these headers at the static-file / proxy layer.
- **AI provider** (`@workspace/ai-provider`): all chat completions go through `chatComplete()` / `getChatProvider()`; embeddings through `embed()` / `getEmbeddingProvider()`. Provider-specific SDKs are dynamically imported.
  - **`AI_PROVIDER`** (default `replit`): `replit` | `openai` | `openrouter`. `replit` reuses `AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY` (auto-provisioned). `openai` requires `OPENAI_API_KEY`. `openrouter` requires `OPENROUTER_API_KEY` (optional `OPENROUTER_DEFAULT_MODEL`, default `openai/gpt-4o-mini`).
  - **`EMBEDDING_PROVIDER`** (default: `voyage` if `VOYAGE_API_KEY` is set, else `openai`): `openai` | `voyage`. `openai` requires `OPENAI_API_KEY` (Replit AI proxy does NOT expose embeddings). `voyage` requires `VOYAGE_API_KEY`.
    - **Cost / latency of defaults** (per 1M input tokens, single-call typical p50 from au-southeast):
      - `voyage-3` (default when key present): 1024 dims, ~US$0.06 / M tokens, ~120–250ms per request for ≤32 inputs.
      - `text-embedding-3-small` (fallback): 1536 dims, ~US$0.02 / M tokens, ~250–500ms per request for ≤32 inputs.
    - The inventory matcher (`artifacts/api-server/src/lib/ingredientMatcher.ts`) caches per-row vectors in `ingredients.embedding` (jsonb) tagged by `ingredients.embedding_model = "<provider>:<model>"`. After a `EMBEDDING_PROVIDER` swap, the next match call detects the stale tag and re-embeds the affected rows in one batched `embed()` call. With ~350 SKUs the one-time backfill is a single round-trip (~250ms voyage / ~450ms openai) costing well under a cent. Steady-state per query = one `embed()` call on the query string only (single-vector latency above; cost is negligible).
- **Storage provider** (`@workspace/storage-provider`): all object storage goes through `getStorageProvider()` (`putObject` / `getObject` / `getSignedUrl` / `deleteObject` / `list`).
  - **`STORAGE_PROVIDER`** (default `replit`): `replit` | `s3`. `replit` uses `@replit/object-storage` and `DEFAULT_OBJECT_STORAGE_BUCKET_ID` (run `setupObjectStorage()` to provision). `s3` works against AWS S3 or any S3-compatible service (R2, MinIO, B2) and requires `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. Optional: `AWS_S3_ENDPOINT` (set for non-AWS endpoints), `AWS_S3_FORCE_PATH_STYLE=true` (MinIO/B2).
- Smoke tests: `pnpm --filter @workspace/ai-provider smoke` and `pnpm --filter @workspace/storage-provider smoke` exercise a chat/embed and put/get/sign/delete round-trip respectively against whichever provider is currently configured.

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── recipe-coster/      # React + Vite recipe costing web app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Application: Recipe Coster

A professional kitchen recipe costing tool for chefs and food business owners.

### Features

- **Dashboard**: Recipe stats, average cost per portion, avg recommended sale price, recent recipes
- **Recipe Builder** (`/recipes/new`, `/recipes/:id`):
  - Recipe title, description, servings, author
  - Ingredient autocomplete search with live cost calculations
  - Method editor with block types: Header, Step, Note, Sub-step with reorder controls
  - Adjustable wastage % and food cost % sliders
  - Recipe tags and allergen tags
  - Live tabbed preview (Recipe Card + Cost Breakdown)
  - Save to database
- **Ingredient Library** (`/ingredients`): Full CRUD for ingredients with unit cost calculation; supplier dropdown filter (grouped by category) covering 15 suppliers; 342+ pre-seeded products with live-verified Australian pricing
- **Preview Tabs**:
  - Tab 1: Recipe card (30/70 column layout, tags, allergens, author footnote)
  - Tab 2: Cost breakdown (summary table + ingredient detail table)

### Domain Models

**Ingredient**: name, supplier, purchaseUnit, purchaseUnitSize, purchaseCost, recipeUnit, recipeUnitCost (calculated), category

**Recipe**: title, description, servings, wastagePercent, foodCostPercent, tags[], allergens[], method (MethodBlock[]), ingredients (stored as JSON), authorName

**MethodBlock**: type (header|numbered|text|subinstruction), content, order

**RecipeCostSummary** (computed at runtime): totalIngredientCost, costPerPortion, wastageCost, totalCostWithWastage, costPerPortionWithWastage, recommendedSalePrice

### Cost Calculation Logic

- `recipeUnitCost = purchaseCost / (purchaseUnitSize * conversionFactor)`
- Conversion factors: kg→g = 1000, L→ml = 1000, dozen→each = 12, same units = 1
- `lineCost = quantity * recipeUnitCost`
- `totalIngredientCost = sum(lineCost)`
- `wastageCost = totalIngredientCost * wastagePercent / 100`
- `totalCostWithWastage = totalIngredientCost + wastageCost`
- `costPerPortionWithWastage = totalCostWithWastage / servings`
- `recommendedSalePrice = costPerPortionWithWastage / (foodCostPercent / 100)`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client and Zod schemas

## Test Suite

A comprehensive automated test suite lives in `tests/`. Run via:

| Script                  | What it runs                                                     |
| ----------------------- | ---------------------------------------------------------------- |
| `pnpm test:unit`        | 100 Vitest unit tests (pure functions, no network/DB)            |
| `pnpm test:integration` | 41 Vitest + Supertest tests against real Postgres DB             |
| `pnpm test:e2e`         | Playwright browser tests (requires system libs — see note below) |
| `pnpm test:smoke`       | AI + storage provider live round-trip smoke tests                |
| `pnpm test:quality`     | typecheck + prettier --check                                     |
| `pnpm test:all`         | All categories sequentially with per-category reports            |

**Reports:** Each run writes `tests/tests-results/<UTC-ISO>__<category>.md`.

**Toolchain:** Vitest (^4.x), Supertest (^7.x), Playwright (^1.x), tsc, prettier.

**Config files:** `vitest.config.ts`, `playwright.config.ts`, `scripts/src/run-tests.ts`.

**E2E note:** Playwright's bundled Chromium requires `libglib-2.0.so.0` which is absent in Replit's NixOS container. E2E tests will fail at `browserType.launch` in the dev environment. The test code is correct and passes in standard Ubuntu/Debian CI. Fix: add `playwright` to a NixOS overlay or run tests on a Linux CI runner.

## Database Schema

Tables:

- `ingredients`: id, name, supplier, purchase_unit, purchase_unit_size, purchase_cost, recipe_unit, category, image_key, embedding (jsonb cached vector), embedding_model (provider:model tag), created_at, updated_at
- `recipes`: id, title, description, servings, wastage_percent, food_cost_percent, tags (text[]), allergens (text[]), method (jsonb), ingredients (jsonb), author_name, created_at, updated_at

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes:

- `GET/POST /api/ingredients` — list (with ?search, ?supplier) and create
- `POST /api/ingredients/match` — vector-similarity match of a free-text query against the SKU library (uses `@workspace/ai-provider` `embed()` and the cached `ingredients.embedding` column)
- `GET/PATCH/DELETE /api/ingredients/:id` — get, update, delete (PATCH invalidates the cached embedding when name/supplier/category change)
- `GET /api/recipes/stats/summary` — dashboard stats
- `GET/POST /api/recipes` — list (with ?search, ?tag) and create
- `GET/PATCH/DELETE /api/recipes/:id` — get, update, delete

### `artifacts/recipe-coster` (`@workspace/recipe-coster`)

React + Vite frontend. Served at `/`.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

Production migrations are handled by Replit when publishing. In development: `pnpm --filter @workspace/db run push`.
