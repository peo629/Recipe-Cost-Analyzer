---
title: Quality Checks
category: quality
runner: tsx + tsc + prettier
command: pnpm test:quality
last_updated: "2026-05-02"
---

# Quality Checks

Automated quality gate that wraps the monorepo's existing toolchain. None of the checks auto-fix — findings are recorded in the run report so they can be addressed deliberately.

## Tools

| Tool       | Command                                                    | What it checks                                                                             |
| ---------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| TypeScript | `pnpm run typecheck`                                       | Full project type check — runs `tsc --build` for libs and `tsc --noEmit` for each artifact |
| Prettier   | `prettier --check "**/*.{ts,tsx,js,jsx,json,yaml,yml,md}"` | Format consistency across all source files                                                 |
| ESLint     | `eslint .` (if configured)                                 | Lint rules — skipped with a note when ESLint is not configured                             |

## Test files

| File        | What it does                                                                                                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runner.ts` | Orchestrates all three tools in sequence, captures stdout/stderr for each, prints a per-tool pass/fail summary, exits with code 1 if any tool fails |

---

### `runner.ts`

**typecheck**

- Runs `pnpm run typecheck` (delegates to `pnpm run typecheck:libs && pnpm -r typecheck`).
- PASSED if exit code is 0.
- FAILED if any TypeScript error is emitted; the full compiler output is included in the report.

**prettier**

- Runs `prettier --check` over all TypeScript, JavaScript, JSON, YAML, and Markdown files (excluding `node_modules`, `dist`, `pnpm-lock.yaml`).
- PASSED if all checked files match the Prettier format.
- FAILED if any file is not formatted; the list of unformatted files is included in the report.

**eslint** (conditional)

- SKIPPED with an explanatory note if `eslint` is not installed/configured.
- PASSED/FAILED based on exit code if present.

**Exit behaviour**

- Exit 0 if all enabled tools pass.
- Exit 1 if any tool fails; the runner continues to completion even after a failure so all findings are collected.
