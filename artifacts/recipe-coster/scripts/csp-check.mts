// Production-policy assertion: build the prod CSP via the same code
// path the Vite plugin uses, then assert the strict directives.
// Run: `pnpm --filter @workspace/recipe-coster exec tsx scripts/csp-check.mts`
import { buildCsp, getSecurityHeaders } from "../src/lib/csp.ts";

const prod = buildCsp(true);
const dev = buildCsp(false);

let ok = true;
const fail = (msg: string) => {
  console.error("FAIL:", msg);
  ok = false;
};

const segOf = (csp: string, name: string) =>
  csp.split(";").find((s) => s.trim().startsWith(name)) ?? "";

// --- prod assertions ---
const prodScript = segOf(prod, "script-src");
if (
  prodScript.includes("'unsafe-inline'") ||
  prodScript.includes("'unsafe-eval'")
)
  fail(`prod script-src has unsafe-*: ${prodScript}`);
if (!segOf(prod, "frame-ancestors").includes("'none'"))
  fail(`prod frame-ancestors not 'none': ${segOf(prod, "frame-ancestors")}`);
if (segOf(prod, "img-src").includes("blob:"))
  fail(`prod img-src has blob:: ${segOf(prod, "img-src")}`);
if (segOf(prod, "font-src").includes("data:"))
  fail(`prod font-src has data:: ${segOf(prod, "font-src")}`);
if (
  segOf(prod, "connect-src").includes("replit") ||
  segOf(prod, "connect-src").includes("ws:")
)
  fail(`prod connect-src too loose: ${segOf(prod, "connect-src")}`);
for (const need of [
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]) {
  if (!prod.includes(need)) fail(`prod missing: ${need}`);
}

// --- dev sanity (must be permissive enough for Vite/HMR) ---
if (!dev.includes("'unsafe-eval'")) fail("dev missing unsafe-eval");
if (!segOf(dev, "connect-src").includes("ws:"))
  fail("dev connect-src missing ws:");
if (!segOf(dev, "frame-ancestors").includes("replit"))
  fail("dev frame-ancestors missing replit");

// --- header bundle assertions ---
const prodHeaders = getSecurityHeaders(true);
if (prodHeaders["X-Frame-Options"] !== "DENY")
  fail(`prod X-Frame-Options: ${prodHeaders["X-Frame-Options"]}`);
if (!prodHeaders["Strict-Transport-Security"]) fail("prod missing HSTS");
const devHeaders = getSecurityHeaders(false);
if (devHeaders["Strict-Transport-Security"]) fail("dev should not ship HSTS");

// --- live header smoke check (only when called with --live) ---
//
// When the recipe-coster dev server is running on $PORT, hit it and
// assert the CSP / hardening headers actually shipped. This is the
// "automated CI smoke check for CSP header presence in prod-like
// serving" the architect asked for. Run as:
//
//   PORT=80 pnpm --filter @workspace/recipe-coster test:csp -- --live
//
if (process.argv.includes("--live")) {
  const port = process.env.PORT ?? "80";
  const url = `http://localhost:${port}/`;
  try {
    const res = await fetch(url);
    const requiredHeaders = [
      "content-security-policy",
      "x-content-type-options",
      "referrer-policy",
      "x-frame-options",
    ];
    for (const h of requiredHeaders) {
      if (!res.headers.get(h)) fail(`live: missing header ${h} on ${url}`);
    }
    const liveCsp = res.headers.get("content-security-policy") ?? "";
    if (!liveCsp.includes("frame-ancestors"))
      fail("live: CSP missing frame-ancestors");
    if (!liveCsp.includes("default-src")) fail("live: CSP missing default-src");
    console.log("Live headers verified on", url);
  } catch (err) {
    fail(`live: could not reach ${url}: ${(err as Error).message}`);
  }
}

if (ok) {
  console.log("PROD CSP:", prod);
  console.log("\nDEV  CSP:", dev);
  console.log("\nAll CSP/header assertions PASSED");
  process.exit(0);
} else {
  process.exit(1);
}
