---
title: Test Suite — Recipe Coster Monorepo
last_updated: "2026-05-02"
---

# Test Suite

This directory contains the complete automated test suite for the Recipe Coster monorepo. Tests are organised into five categories, each with its own subdirectory, toolchain, and README.

## Layout

| Directory                              | Category    | Runner               | What it covers                                                                                                                                                          |
| -------------------------------------- | ----------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`tests/unit/`](./unit/)               | Unit        | Vitest               | Pure functions: password policy, AI-quota math, CORS origin checking, i18n formatters, CSP helpers, Zod schemas, provider selection logic, recipe unit-cost calculation |
| [`tests/integration/`](./integration/) | Integration | Vitest + Supertest   | HTTP routes of the Express API server against the real development Postgres database: auth, ingredients, recipes, AI generation                                         |
| [`tests/e2e/`](./e2e/)                 | E2E         | Playwright           | User-facing journeys in the React frontend: auth gate, signup/login, dashboard render, no JS errors on load                                                             |
| [`tests/smoke/`](./smoke/)             | Smoke       | tsx                  | Live round-trip checks for AI and storage provider integrations; skip cleanly when env vars are absent                                                                  |
| [`tests/quality/`](./quality/)         | Quality     | tsx + tsc + prettier | Typecheck, format-check, and (optionally) lint the entire monorepo                                                                                                      |

## How to run

### All categories

```bash
pnpm test:all
```

### Individual categories

```bash
pnpm test:unit          # Vitest unit suite
pnpm test:integration   # Vitest integration suite (requires DATABASE_URL)
pnpm test:e2e           # Playwright e2e suite (requires running app)
pnpm test:smoke         # AI + storage provider live smoke tests
pnpm test:quality       # typecheck + prettier --check
```

### Direct tool invocation (bypass the reporter)

```bash
# Vitest
pnpm exec vitest run tests/unit
pnpm exec vitest run tests/integration

# Playwright
pnpm exec playwright test

# Smoke scripts
tsx tests/smoke/ai-provider.ts
tsx tests/smoke/storage-provider.ts

# Quality
tsx tests/quality/runner.ts
```

## Reports

Every `pnpm test:*` run writes a timestamped Markdown report to `tests/tests-results/`. File names sort chronologically:

```
tests/tests-results/
  2026-05-02T14-30-00__unit.md
  2026-05-02T14-30-45__integration.md
  2026-05-02T14-32-10__e2e.md
  …
```

Each report includes: invocation command, environment summary, pass/fail/skip totals, full output, and failure excerpts.

## Toolchain

| Tool                                            | Version | Purpose                          |
| ----------------------------------------------- | ------- | -------------------------------- |
| [Vitest](https://vitest.dev)                    | ^4.x    | Unit and integration test runner |
| [Supertest](https://github.com/ladjs/supertest) | ^7.x    | In-process HTTP assertions       |
| [Playwright](https://playwright.dev)            | ^1.x    | End-to-end browser automation    |
| [prettier](https://prettier.io)                 | ^3.x    | Format checking                  |
| tsc                                             | ~5.9.x  | TypeScript type checking         |

## Configuration files

- `vitest.config.ts` — Vitest config (workspace conditions, aliases, env overrides)
- `playwright.config.ts` — Playwright config (baseURL from `REPLIT_DEV_DOMAIN`)
- `scripts/src/run-tests.ts` — Category runner + Markdown reporter
