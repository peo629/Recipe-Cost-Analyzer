import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { authMiddleware } from "./middlewares/authMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const isProd = process.env.NODE_ENV === "production";

// Required so that rate limiting and getOrigin() see the real client IP
// and protocol when running behind the Replit / Railway / VPS reverse
// proxy. We trust the first hop only.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

/**
 * Helmet with a strict API CSP: this server only emits JSON, so
 * `default-src 'none'` plus `frame-ancestors 'none'` in prod. In dev
 * we allow Replit preview origins so the workspace iframe works.
 * The web client's CSP is set separately on the recipe-coster artifact.
 */
const frameAncestorsDirective = isProd
  ? ["'none'"]
  : [
      "'self'",
      "https://*.replit.dev",
      "https://*.repl.co",
      "https://replit.com",
    ];

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: frameAncestorsDirective,
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "no-referrer" },
    strictTransportSecurity: isProd
      ? { maxAge: 15552000, includeSubDomains: true }
      : false,
  }),
);

/**
 * CORS — explicit allowlist via CORS_ORIGINS (comma-separated). Dev also
 * allows *.replit.dev / *.repl.co / localhost. We deliberately avoid
 * `origin: true` (which reflects the caller) because the API ships
 * credentialed cookies and reflection would defeat SameSite.
 */
const configuredOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const devOriginPattern =
  /^https?:\/\/([a-z0-9-]+\.)*(replit\.dev|repl\.co|riker\.replit\.dev|janeway\.replit\.dev|kirk\.replit\.dev|picard\.replit\.dev|localhost(:\d+)?|127\.0\.0\.1(:\d+)?)$/i;

/** Pure decision function so it can be unit-tested without booting the app. */
export function isOriginAllowed(origin: string | undefined): boolean {
  // Same-origin / curl / server-to-server requests have no Origin header.
  if (!origin) return true;
  if (configuredOrigins.includes(origin)) return true;
  if (!isProd && devOriginPattern.test(origin)) return true;
  return false;
}

app.use(
  cors({
    credentials: true,
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) return cb(null, true);
      // Resolve with `false` so cors omits ACAO (browser blocks) and we
      // can surface a clean 403 below instead of a synthetic 500.
      logger.warn({ origin }, "CORS: rejecting cross-origin request");
      return cb(null, false);
    },
  }),
);

/** Surface a real 403 for rejected origins so logs/metrics are clear. */
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (
    typeof origin === "string" &&
    origin.length > 0 &&
    !isOriginAllowed(origin)
  ) {
    res.status(403).json({ error: "CORS_ORIGIN_NOT_ALLOWED" });
    return;
  }
  next();
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/api", router);

export default app;
