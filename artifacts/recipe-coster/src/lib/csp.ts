import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * Env-aware CSP for the web artifact. Prod forbids inline scripts, eval,
 * blob:, and framing. Dev relaxes only what Vite HMR / replit-error-overlay
 * and the Replit preview iframe need. Inline styles stay allowed in both
 * (shadcn/Radix/framer-motion); inline `<script>` (the XSS vector) is
 * always blocked in prod.
 */
export function buildCsp(isProd: boolean): string {
  const fontHosts = [
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com",
  ];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": isProd
      ? ["'self'"]
      : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "img-src": isProd ? ["'self'", "data:"] : ["'self'", "data:", "blob:"],
    "font-src": isProd
      ? ["'self'", ...fontHosts]
      : ["'self'", "data:", ...fontHosts],
    "connect-src": isProd
      ? ["'self'"]
      : ["'self'", "ws:", "wss:", "https://*.replit.dev", "https://*.repl.co"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": isProd
      ? ["'none'"]
      : [
          "'self'",
          "https://*.replit.dev",
          "https://*.repl.co",
          "https://replit.com",
        ],
  };

  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}

/**
 * Full hardening header bundle (CSP + supporting headers). Returned as a
 * plain object so any production runtime serving the built static files
 * (Express in front of `dist/`, nginx, Caddy) can mirror the same set
 * once Vite is out of the request path.
 */
export function getSecurityHeaders(isProd: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildCsp(isProd),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": isProd ? "DENY" : "SAMEORIGIN",
  };
  if (isProd) {
    headers["Strict-Transport-Security"] =
      "max-age=15552000; includeSubDomains";
  }
  return headers;
}

/**
 * Vite plugin that applies `getSecurityHeaders` to every response from
 * the dev server and `vite preview`. `isProd` is REQUIRED and must be
 * derived deterministically from Vite's own `command`/`mode` — we do not
 * inspect `process.env.NODE_ENV` because a missed flag would silently
 * downgrade prod to the dev-relaxed policy. Production hosting must
 * mirror the headers at the reverse-proxy / static-file layer.
 */
export function cspPlugin(isProd: boolean): Plugin {
  const headers = getSecurityHeaders(isProd);

  const apply = (_req: IncomingMessage, res: ServerResponse) => {
    for (const [name, value] of Object.entries(headers)) {
      res.setHeader(name, value);
    }
  };

  return {
    name: "recipe-coster:csp",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        apply(req, res);
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        apply(req, res);
        next();
      });
    },
  };
}
