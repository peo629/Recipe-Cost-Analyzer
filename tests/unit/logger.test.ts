import { describe, it, expect } from "vitest";
import { logger } from "../../artifacts/api-server/src/lib/logger";

describe("logger configuration", () => {
  it("is defined and has pino logger interface", () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.trace).toBe("function");
    expect(typeof logger.fatal).toBe("function");
  });

  it("has a valid log level string", () => {
    const validLevels = [
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "fatal",
      "silent",
    ];
    expect(typeof logger.level).toBe("string");
    expect(validLevels).toContain(logger.level);
  });

  it("defaults to 'info' level when LOG_LEVEL env var is not set", () => {
    const expectedLevel = process.env.LOG_LEVEL ?? "info";
    expect(logger.level).toBe(expectedLevel);
  });

  it("does not crash when logging a structured object (smoke)", () => {
    expect(() =>
      logger.info(
        { test: true, module: "logger.test" },
        "Logger unit test — structured log",
      ),
    ).not.toThrow();
  });

  it("does not crash when logging an error object", () => {
    expect(() =>
      logger.error(new Error("test error"), "Logger unit test — error log"),
    ).not.toThrow();
  });

  it("runs in production mode (no pino-pretty) since NODE_ENV=production in vitest.config.ts", () => {
    expect(process.env.NODE_ENV).toBe("production");
  });

  it("serializer handles child logger creation without throwing", () => {
    expect(() =>
      logger.child({ requestId: "test-request-id-123" }),
    ).not.toThrow();
    const child = logger.child({ requestId: "test-request-id-123" });
    expect(typeof child.info).toBe("function");
  });
});

describe("logger redaction", () => {
  it("logger instance does not expose raw redact config but does not crash on sensitive paths", () => {
    const sensitivePayload = {
      req: {
        headers: {
          authorization: "Bearer super-secret-token",
          cookie: "session=abc123",
        },
      },
    };
    expect(() => logger.info(sensitivePayload, "redaction test")).not.toThrow();
  });
});
