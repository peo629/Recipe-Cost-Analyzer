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
- **Ingredient Library** (`/ingredients`): Full CRUD for ingredients with unit cost calculation; supplier filter buttons (All / Woolworths / Coles); 141 pre-seeded products from Woolworths and Coles with live-verified Australian pricing
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

## Database Schema

Tables:
- `ingredients`: id, name, supplier, purchase_unit, purchase_unit_size, purchase_cost, recipe_unit, category, created_at, updated_at
- `recipes`: id, title, description, servings, wastage_percent, food_cost_percent, tags (text[]), allergens (text[]), method (jsonb), ingredients (jsonb), author_name, created_at, updated_at

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes:
- `GET/POST /api/ingredients` — list (with ?search, ?supplier) and create
- `GET/PATCH/DELETE /api/ingredients/:id` — get, update, delete
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
