import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { cspPlugin } from "./src/lib/csp";

// PORT is only required for `vite` (dev) and `vite preview` (prod runtime).
// `vite build` produces static assets and doesn't bind a port — Railway and
// most CI environments don't set PORT during the build phase, so requiring
// it would break those builds. We resolve it lazily inside the config
// factory based on the command Vite is running.
function resolveServerPort(): number {
  const raw = process.env.PORT;
  if (!raw) {
    throw new Error(
      "PORT environment variable is required for `vite` / `vite preview` but was not provided.",
    );
  }
  const n = Number(raw);
  if (Number.isNaN(n) || n <= 0) {
    throw new Error(`Invalid PORT value: "${raw}"`);
  }
  return n;
}

// BASE_PATH controls the public path Vite serves from. The Replit
// workspace preview proxies each artifact under `/<slug>/`, so it sets
// this explicitly. Off-Replit deployments (Railway, VPS) typically
// serve at the domain root, so we default to "/" instead of failing.
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig(async ({ command, mode }) => {
  // Treat any non-`serve` Vite invocation (i.e. `vite build`) as
  // production, AND honour an explicit `mode === "production"`. This is
  // the canonical Vite way to detect prod and is independent of the
  // ambient `NODE_ENV`, which is not reliable across all runtime
  // contexts (e.g. `vite preview` started without env, custom servers).
  const isProd = command === "build" || mode === "production";

  // Only resolve PORT for commands that actually bind a server.
  // `vite build` produces static assets and does not read server.port,
  // so we skip resolution to keep CI/Railway builds working without PORT.
  const serverPort = command === "build" ? 0 : resolveServerPort();

  const replitDevPlugins =
    !isProd && process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : [];

  return {
    base: basePath,
    plugins: [
      react(),
      tailwindcss(),
      runtimeErrorOverlay(),
      cspPlugin(isProd),
      ...replitDevPlugins,
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
        "@assets": path.resolve(
          import.meta.dirname,
          "..",
          "..",
          "attached_assets",
        ),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port: serverPort,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port: serverPort,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
