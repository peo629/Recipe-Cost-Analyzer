import { describe, it, expect } from "vitest";
import {
  buildCsp,
  getSecurityHeaders,
} from "../../artifacts/recipe-coster/src/lib/csp";

describe("buildCsp", () => {
  it("contains 'self' as a default-src in both modes", () => {
    expect(buildCsp(true)).toContain("default-src 'self'");
    expect(buildCsp(false)).toContain("default-src 'self'");
  });

  it("disallows unsafe-inline in script-src in production", () => {
    const prod = buildCsp(true);
    const scriptSrcSection = prod.match(/script-src ([^;]+)/)?.[1] ?? "";
    expect(scriptSrcSection).not.toContain("unsafe-inline");
    expect(scriptSrcSection).not.toContain("unsafe-eval");
  });

  it("allows unsafe-inline and unsafe-eval in script-src in development", () => {
    const dev = buildCsp(false);
    expect(dev).toContain("unsafe-inline");
    expect(dev).toContain("unsafe-eval");
  });

  it("sets frame-ancestors to 'none' in production", () => {
    const prod = buildCsp(true);
    expect(prod).toContain("frame-ancestors 'none'");
  });

  it("allows Replit origins in frame-ancestors in development", () => {
    const dev = buildCsp(false);
    expect(dev).toContain("replit.dev");
  });

  it("always includes object-src 'none'", () => {
    expect(buildCsp(true)).toContain("object-src 'none'");
    expect(buildCsp(false)).toContain("object-src 'none'");
  });

  it("returns a non-empty string", () => {
    expect(buildCsp(true).length).toBeGreaterThan(0);
    expect(buildCsp(false).length).toBeGreaterThan(0);
  });
});

describe("getSecurityHeaders", () => {
  it("returns Content-Security-Policy header", () => {
    const headers = getSecurityHeaders(true);
    expect(headers["Content-Security-Policy"]).toBeDefined();
    expect(headers["Content-Security-Policy"]).toContain("default-src");
  });

  it("includes X-Content-Type-Options: nosniff", () => {
    expect(getSecurityHeaders(true)["X-Content-Type-Options"]).toBe("nosniff");
    expect(getSecurityHeaders(false)["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("sets X-Frame-Options to DENY in production", () => {
    expect(getSecurityHeaders(true)["X-Frame-Options"]).toBe("DENY");
  });

  it("sets X-Frame-Options to SAMEORIGIN in development", () => {
    expect(getSecurityHeaders(false)["X-Frame-Options"]).toBe("SAMEORIGIN");
  });

  it("includes HSTS in production only", () => {
    const prod = getSecurityHeaders(true);
    const dev = getSecurityHeaders(false);
    expect(prod["Strict-Transport-Security"]).toBeDefined();
    expect(dev["Strict-Transport-Security"]).toBeUndefined();
  });

  it("includes Referrer-Policy in both modes", () => {
    expect(getSecurityHeaders(true)["Referrer-Policy"]).toBeDefined();
    expect(getSecurityHeaders(false)["Referrer-Policy"]).toBeDefined();
  });
});
