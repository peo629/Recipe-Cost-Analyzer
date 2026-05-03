#!/usr/bin/env tsx
/**
 * Unified test runner and Markdown reporter.
 *
 * Usage:
 *   tsx scripts/src/run-tests.ts <category>
 *   category: unit | integration | e2e | smoke | quality | all
 *
 * Each run writes a timestamped Markdown report to:
 *   tests/tests-results/<UTC-ISO>__<category>.md
 */
import { execSync, spawnSync } from "child_process";
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { platform, version as nodeVersion } from "os";
import process from "process";

const RESULTS_DIR = join(process.cwd(), "tests", "tests-results");

type Category = "unit" | "integration" | "e2e" | "smoke" | "quality" | "all";

interface RunResult {
  category: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  passed: number;
  failed: number;
  skipped: number;
}

function utcTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/:/g, "-")
    .replace("T", "T");
}

function filenameTs(): string {
  return utcTimestamp().replace(/[:.]/g, "-").replace("Z", "");
}

function parseVitestJson(jsonPath: string): {
  passed: number;
  failed: number;
  skipped: number;
} {
  try {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    for (const suite of data.testResults ?? []) {
      for (const t of suite.assertionResults ?? []) {
        if (t.status === "passed") passed++;
        else if (t.status === "failed") failed++;
        else skipped++;
      }
    }
    return { passed, failed, skipped };
  } catch {
    return { passed: 0, failed: 0, skipped: 0 };
  }
}

function parsePlaywrightJson(jsonPath: string): {
  passed: number;
  failed: number;
  skipped: number;
} {
  try {
    const raw = readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);
    const stats = data.stats ?? {};
    return {
      passed: stats.expected ?? 0,
      failed: stats.unexpected ?? 0,
      skipped: stats.skipped ?? 0,
    };
  } catch {
    return { passed: 0, failed: 0, skipped: 0 };
  }
}

function parseSmokeOutput(stdout: string): {
  passed: number;
  failed: number;
  skipped: number;
} {
  const lines = stdout.split("\n");
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const line of lines) {
    if (line.includes("✓")) passed++;
    else if (line.includes("✗")) failed++;
    else if (line.includes("○") || line.includes("SKIPPED")) skipped++;
  }
  return { passed, failed, skipped };
}

function parseQualityOutput(stdout: string): {
  passed: number;
  failed: number;
  skipped: number;
} {
  const lines = stdout.split("\n");
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const line of lines) {
    if (line.includes("✓")) passed++;
    else if (line.includes("✗")) failed++;
    else if (line.includes("SKIPPED")) skipped++;
  }
  return { passed, failed, skipped };
}

function runCategory(cat: Category): RunResult {
  const vitestJsonOut = "tests/tests-results/.last-vitest-output.json";
  const playwrightJsonOut = "tests/tests-results/.last-playwright-output.json";

  const TSX = "node_modules/.bin/tsx";
  const commands: Record<Category, string> = {
    unit: `pnpm exec vitest run --config vitest.config.ts --reporter=verbose --reporter=json --outputFile=${vitestJsonOut} tests/unit`,
    integration: `pnpm exec vitest run --config vitest.config.ts --reporter=verbose --reporter=json --outputFile=${vitestJsonOut} tests/integration`,
    e2e: `pnpm exec playwright test --config playwright.config.ts`,
    smoke: `${TSX} tests/smoke/ai-provider.ts && ${TSX} tests/smoke/storage-provider.ts`,
    quality: `${TSX} tests/quality/runner.ts`,
    all: "all",
  };

  if (cat === "all") {
    throw new Error('Use runAll() for category "all"');
  }

  const cmd = commands[cat];
  const start = Date.now();
  const result = spawnSync(cmd, {
    shell: true,
    encoding: "utf8",
    cwd: process.cwd(),
    env: { ...process.env },
  });
  const durationMs = Date.now() - start;

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";

  let counts = { passed: 0, failed: 0, skipped: 0 };
  if (cat === "unit" || cat === "integration") {
    counts = parseVitestJson(vitestJsonOut);
  } else if (cat === "e2e") {
    counts = parsePlaywrightJson(playwrightJsonOut);
  } else if (cat === "smoke") {
    counts = parseSmokeOutput(stdout);
  } else if (cat === "quality") {
    counts = parseQualityOutput(stdout);
  }

  return {
    category: cat,
    command: cmd,
    exitCode: result.status ?? 1,
    stdout,
    stderr,
    durationMs,
    ...counts,
  };
}

function envSummary(): string {
  let dbMasked = "not set";
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      dbMasked = `${url.protocol}//${url.hostname}${url.pathname}`;
    } catch {
      dbMasked = "[set but unparseable]";
    }
  }
  return [
    `- Node.js: ${process.version}`,
    `- Platform: ${platform()} (${process.arch})`,
    `- DATABASE_URL: ${dbMasked}`,
    `- AI_PROVIDER: ${process.env.AI_PROVIDER ?? "(default: replit)"}`,
    `- STORAGE_PROVIDER: ${process.env.STORAGE_PROVIDER ?? "(default: replit)"}`,
    `- REPLIT_DEV_DOMAIN: ${process.env.REPLIT_DEV_DOMAIN ?? "(not set)"}`,
    `- NODE_ENV: ${process.env.NODE_ENV ?? "(not set)"}`,
  ].join("\n");
}

function writeReport(result: RunResult): string {
  const ts = utcTimestamp();
  const statusEmoji = result.exitCode === 0 ? "✅" : "❌";
  const outputTruncated = (txt: string, max = 200) =>
    txt.trim().split("\n").slice(0, max).join("\n");

  const md = `---
category: ${result.category}
timestamp: ${ts}
exit_code: ${result.exitCode}
passed: ${result.passed}
failed: ${result.failed}
skipped: ${result.skipped}
duration_ms: ${result.durationMs}
---

# Test Report — ${result.category} ${statusEmoji}

**Invocation:** \`${result.command}\`  
**Timestamp (UTC):** ${ts}  
**Duration:** ${(result.durationMs / 1000).toFixed(2)}s  
**Status:** ${result.exitCode === 0 ? "PASSED" : "FAILED"}

## Environment

${envSummary()}

## Totals

| Metric   | Count |
|----------|-------|
| Passed   | ${result.passed} |
| Failed   | ${result.failed} |
| Skipped  | ${result.skipped} |
| Duration | ${(result.durationMs / 1000).toFixed(2)}s |

## Output

\`\`\`
${outputTruncated(result.stdout || "(no stdout)")}
\`\`\`

${
  result.stderr.trim()
    ? `## Errors / Warnings

\`\`\`
${outputTruncated(result.stderr)}
\`\`\`
`
    : ""
}
${
  result.failed > 0
    ? `## Failure Excerpts

\`\`\`
${outputTruncated(
  [result.stdout, result.stderr]
    .join("\n")
    .split("\n")
    .filter(
      (l) =>
        l.includes("FAIL") ||
        l.includes("Error") ||
        l.includes("✗") ||
        l.includes("AssertionError") ||
        l.includes("expected"),
    )
    .slice(0, 50)
    .join("\n"),
)}
\`\`\`
`
    : ""
}
`;

  const categoryDir = join(RESULTS_DIR, result.category);
  mkdirSync(categoryDir, { recursive: true });
  const fname = `${filenameTs()}__${result.category}.md`;
  const fpath = join(categoryDir, fname);
  writeFileSync(fpath, md, "utf8");
  console.log(
    `\n📄 Report written: tests/tests-results/${result.category}/${fname}`,
  );
  return fpath;
}

async function main(): Promise<void> {
  const category = (process.argv[2] ?? "unit") as Category;
  const validCategories: Category[] = [
    "unit",
    "integration",
    "e2e",
    "smoke",
    "quality",
    "all",
  ];

  if (!validCategories.includes(category)) {
    console.error(
      `Unknown category: ${category}. Valid: ${validCategories.join(", ")}`,
    );
    process.exit(1);
  }

  mkdirSync(RESULTS_DIR, { recursive: true });

  if (category === "all") {
    const categories: Array<Exclude<Category, "all">> = [
      "unit",
      "integration",
      "smoke",
      "quality",
      "e2e",
    ];
    let overallExit = 0;
    for (const cat of categories) {
      console.log(`\n${"=".repeat(60)}`);
      console.log(`Running: ${cat}`);
      console.log("=".repeat(60));
      const result = runCategory(cat);
      writeReport(result);
      if (result.exitCode !== 0) overallExit = 1;
      const icon = result.exitCode === 0 ? "✅" : "❌";
      console.log(
        `${icon} ${cat}: ${result.passed} passed, ${result.failed} failed, ${result.skipped} skipped`,
      );
    }
    process.exitCode = overallExit;
    return;
  }

  const result = runCategory(category);
  process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  writeReport(result);
  process.exitCode = result.exitCode;
}

main().catch((err) => {
  console.error("run-tests FATAL:", err);
  process.exitCode = 1;
});
