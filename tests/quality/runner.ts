#!/usr/bin/env tsx
/**
 * Quality runner — wraps typecheck, prettier --check, and optional eslint.
 * Each tool is run in sequence; exit codes and stdout/stderr are captured.
 * Any non-zero tool exit causes the runner to exit 1 and records diagnostics.
 */
import { execSync } from "child_process";

interface ToolResult {
  name: string;
  command: string;
  status: "passed" | "failed" | "skipped";
  output: string;
  durationMs: number;
}

const results: ToolResult[] = [];

function run(name: string, command: string): ToolResult {
  const start = Date.now();
  let output = "";
  let status: "passed" | "failed" = "passed";
  try {
    const raw = execSync(command, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      cwd: process.cwd(),
    });
    output = raw.trim();
  } catch (err: unknown) {
    status = "failed";
    if (
      err !== null &&
      typeof err === "object" &&
      "stdout" in err &&
      "stderr" in err
    ) {
      const e = err as { stdout?: string; stderr?: string };
      output = [e.stdout, e.stderr].filter(Boolean).join("\n").trim();
    } else {
      output = String(err);
    }
  }
  return { name, command, status, output, durationMs: Date.now() - start };
}

async function main(): Promise<void> {
  console.log("[quality] Running quality checks…\n");

  results.push(run("typecheck", "pnpm run typecheck"));

  results.push(
    run(
      "prettier",
      "pnpm exec prettier --check " +
        '"**/*.{ts,tsx,js,jsx,mjs,cjs,json,yaml,yml,md}" ' +
        "--ignore-path .gitignore " +
        "--ignore-unknown " +
        "--log-level warn " +
        '"!**/node_modules/**" ' +
        '"!**/dist/**" ' +
        '"!**/.tsbuildinfo" ' +
        '"!pnpm-lock.yaml"',
    ),
  );

  let eslintAvailable = false;
  try {
    execSync("pnpm exec eslint --version 2>/dev/null", { stdio: "pipe" });
    eslintAvailable = true;
  } catch {
    /* not installed */
  }

  if (eslintAvailable) {
    results.push(run("eslint", "pnpm exec eslint . --max-warnings=0"));
  } else {
    results.push({
      name: "eslint",
      command: "eslint (not configured)",
      status: "skipped",
      output: "SKIPPED: eslint is not configured in this project",
      durationMs: 0,
    });
  }

  for (const r of results) {
    const icon =
      r.status === "passed" ? "✓" : r.status === "skipped" ? "○" : "✗";
    console.log(
      `  ${icon} ${r.name} (${r.durationMs}ms) — ${r.status.toUpperCase()}`,
    );
    if (r.output) {
      const lines = r.output.split("\n").slice(0, 30);
      for (const line of lines) {
        console.log(`      ${line}`);
      }
      if (r.output.split("\n").length > 30) {
        console.log(`      … (${r.output.split("\n").length - 30} more lines)`);
      }
    }
    console.log();
  }

  const failed = results.filter((r) => r.status === "failed");
  if (failed.length > 0) {
    console.error(
      `[quality] ${failed.length} check(s) failed: ${failed.map((r) => r.name).join(", ")}`,
    );
    process.exitCode = 1;
  } else {
    console.log("[quality] All quality checks passed.");
  }
}

export { results, run };

main().catch((err) => {
  console.error("[quality] FATAL:", err);
  process.exitCode = 1;
});
