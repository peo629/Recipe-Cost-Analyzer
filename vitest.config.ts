import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: "production",
    },
    pool: "forks",
    singleFork: true,
    reporters: ["verbose", "json"],
    outputFile: {
      json: "tests/tests-results/.last-vitest-output.json",
    },
  },
  resolve: {
    conditions: ["workspace", "import", "node", "default"],
    alias: {
      "@workspace/db": path.resolve("./lib/db/src/index.ts"),
      "@workspace/api-zod": path.resolve("./lib/api-zod/src/index.ts"),
      "@workspace/ai-provider": path.resolve("./lib/ai-provider/src/index.ts"),
      "@workspace/storage-provider": path.resolve(
        "./lib/storage-provider/src/index.ts",
      ),
    },
  },
});
