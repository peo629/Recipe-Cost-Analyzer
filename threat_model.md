# Threat Model

## Project Overview

This repository is a pnpm monorepo with a production Express 5 API server (`artifacts/api-server`), a React + Vite web frontend (`artifacts/recipe-coster`), a PostgreSQL database accessed through Drizzle ORM (`lib/db`), and an OpenAI integration (`lib/integrations-openai-ai-server`). The application is a recipe and ingredient costing tool for chefs and food businesses, so the production system stores business-sensitive recipe libraries, ingredient pricing, and derived cost calculations.

Production scope for this scan excludes the mockup sandbox artifact and other design-only assets unless they are shown to be reachable from the deployed app. Under the current assumptions, TLS is provided by the platform and `NODE_ENV` is `production` in production deployments.

## Assets

- **Recipe library and costing data** -- recipe titles, methods, ingredient selections, allergens, tags, servings, and calculated sale-price guidance. Exposure or tampering can leak proprietary menu data and corrupt pricing decisions.
- **Ingredient catalog and supplier pricing** -- supplier names, purchase costs, units, and normalized recipe-unit costs. This is commercially sensitive and directly affects business decisions.
- **Application availability and API budget** -- the API must remain responsive, and the OpenAI-backed generation endpoint can consume billable upstream credits.
- **Infrastructure secrets** -- `DATABASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, and related deployment configuration.

## Trust Boundaries

- **Browser to API** -- all frontend input is untrusted. The backend must authenticate, authorize, validate, and rate-limit requests without relying on frontend behavior.
- **API to PostgreSQL** -- the API has direct read/write access to all recipe and ingredient data. Any broken access control or injection issue at the API layer reaches the full application dataset.
- **API to OpenAI integration** -- the backend can trigger billable upstream model calls using server-side credentials. Public abuse of this boundary can create cost and availability impact.
- **Public to authenticated business-user boundary** -- recipe and pricing management are business functions and must not be publicly readable or writable in production.
- **Production to dev-only boundary** -- `artifacts/mockup-sandbox/**` and design-system assets are treated as development-only and should usually be ignored unless production reachability is demonstrated.

## Scan Anchors

- Production backend entry point: `artifacts/api-server/src/index.ts` and `artifacts/api-server/src/app.ts`
- High-risk routes: `artifacts/api-server/src/routes/ingredients.ts`, `artifacts/api-server/src/routes/recipes.ts`, `artifacts/api-server/src/routes/openai.ts`
- Database boundary: `lib/db/src/index.ts`, `lib/db/src/schema/**`
- Public frontend entry point: `artifacts/recipe-coster/src/main.tsx` and pages under `artifacts/recipe-coster/src/pages/**`
- Dev-only area to usually skip: `artifacts/mockup-sandbox/**`, `design-system/**`

## Threat Categories

### Spoofing

This project currently exposes business operations over HTTP APIs. In production, every endpoint that reads or mutates recipe, ingredient, or AI-generation data must identify the caller with a valid server-verified session or token. The system must not rely on user-supplied fields such as `authorName` as proof of identity.

### Tampering

Recipes, ingredient costs, and supplier data directly affect menu pricing. The backend must ensure only authorized users can create, update, or delete these records. Cost calculations must be derived server-side from trusted stored ingredient data rather than trusting client assertions.

### Information Disclosure

Recipe libraries, supplier pricing, and costing summaries are commercially sensitive. The API must not expose them to unauthenticated users or to authenticated users outside the correct tenant or ownership scope. Error responses and logs must avoid leaking secrets, credentials, or unnecessary internals.

### Denial of Service

The OpenAI-backed generation route and list/search endpoints can be abused remotely. Public endpoints that can consume expensive compute, database work, or third-party credits must enforce authentication, request-shape limits, and rate limiting so one attacker cannot burn budget or degrade service.

### Elevation of Privilege

The highest-risk failure mode in this codebase is missing server-side access control on business CRUD routes. The production guarantee is: all recipe, ingredient, and AI-generation endpoints must enforce server-side authentication and authorization before touching the database or billable integrations.
