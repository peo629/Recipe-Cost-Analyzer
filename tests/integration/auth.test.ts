import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq, sql, inArray } from "drizzle-orm";
import app from "../../artifacts/api-server/src/app";
import { db, usersTable, sessionsTable } from "../../lib/db/src/index";

const TEST_EMAIL = `integration-auth-${Date.now()}@test.invalid`;
const TEST_PW = "IntegrationTest1!";
const TEST_IP = `10.99.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

// Per-test linking ids so set-password tests are isolated from each
// other (and from any seed data) and can run in parallel safely.
const SETPW_RUN_ID = Date.now().toString(36);
const SETPW_LINKING_ID_NEW = `EMP-TEST-NEW-${SETPW_RUN_ID}`;
const SETPW_LINKING_ID_EXISTING = `EMP-TEST-EXISTING-${SETPW_RUN_ID}`;
const SETPW_EMAIL_NEW = `setpw-new-${SETPW_RUN_ID}@test.invalid`;
const SETPW_EMAIL_EXISTING = `setpw-existing-${SETPW_RUN_ID}@test.invalid`;
const SETPW_NEW_PW = "FirstLogin1!@#";
const SETPW_IP = `10.98.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

async function cleanup() {
  // Scope session deletion strictly to the test user so this is safe
  // against shared / non-isolated databases.
  const testUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = ${TEST_EMAIL}`)
    .catch(() => [] as Array<{ id: string }>);

  for (const u of testUsers) {
    // Passport serialises the authenticated user id at sess.passport.user
    await db
      .delete(sessionsTable)
      .where(sql`${sessionsTable.sess}->'passport'->>'user' = ${u.id}`)
      .catch(() => {});
  }

  await db
    .delete(usersTable)
    .where(sql`lower(${usersTable.email}) = ${TEST_EMAIL}`)
    .catch(() => {});

  // Set-password fixtures: clean up by linking_id (which we own) to
  // avoid touching unrelated rows even on a shared database.
  const setPwUsers = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(
      inArray(usersTable.linkingId, [
        SETPW_LINKING_ID_NEW,
        SETPW_LINKING_ID_EXISTING,
      ]),
    )
    .catch(() => [] as Array<{ id: string }>);
  for (const u of setPwUsers) {
    await db
      .delete(sessionsTable)
      .where(sql`${sessionsTable.sess}->'user'->>'id' = ${u.id}`)
      .catch(() => {});
  }
  await db
    .delete(usersTable)
    .where(
      inArray(usersTable.linkingId, [
        SETPW_LINKING_ID_NEW,
        SETPW_LINKING_ID_EXISTING,
      ]),
    )
    .catch(() => {});
}

afterAll(async () => {
  await cleanup();
});

describe("GET /api/auth/user — unauthenticated", () => {
  it("returns user: null when no session cookie is set", async () => {
    const res = await request(app).get("/api/auth/user");
    expect(res.status).toBe(200);
    expect(res.body.user).toBeNull();
  });
});

describe("GET /api/auth/google/available", () => {
  it("returns 200 with available boolean", async () => {
    const res = await request(app).get("/api/auth/google/available");
    expect(res.status).toBe(200);
    expect(typeof res.body.available).toBe("boolean");
  });
});

describe("GET /api/auth/google — OAuth route shape", () => {
  it("redirects to Google accounts when configured, or returns 503 when not", async () => {
    const res = await request(app).get("/api/auth/google").redirects(0);
    if (res.status === 302) {
      // Google credentials are configured: must redirect to accounts.google.com
      expect(res.headers.location).toMatch(/accounts\.google\.com/);
    } else {
      // Google credentials are absent: must return 503 with an error body
      expect(res.status).toBe(503);
      expect(typeof res.body.error).toBe("string");
    }
  });

  it("GET /api/auth/google/callback without OIDC cookies redirects safely or returns 503", async () => {
    // No OIDC cookies set (missing codeVerifier / state) — the route must
    // never grant a session.  When configured it redirects to "/" as a safe
    // fallback (302).  When not configured it returns 503.
    const res = await request(app)
      .get("/api/auth/google/callback?code=fake&state=fake")
      .redirects(0);
    if (res.status === 302) {
      // Safe fallback: redirect to "/" — no session cookie granted
      expect(res.headers.location).toBe("/");
      expect(res.headers["set-cookie"] ?? []).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/^connect\.sid/)]),
      );
    } else {
      expect(res.status).toBe(503);
      expect(typeof res.body.error).toBe("string");
    }
  });
});

describe("POST /api/auth/signup", () => {
  it("rejects missing body", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .set("x-forwarded-for", TEST_IP)
      .send({});
    expect(res.status).toBe(400);
  });

  it("rejects a weak password", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .set("x-forwarded-for", TEST_IP)
      .send({ email: "test@example.com", password: "weak" });
    expect(res.status).toBe(400);
  });

  it("creates a new user and returns 201 with user object", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .set("x-forwarded-for", TEST_IP)
      .send({ email: TEST_EMAIL, password: TEST_PW });
    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects duplicate email with 409", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .set("x-forwarded-for", TEST_IP)
      .send({ email: TEST_EMAIL, password: TEST_PW });
    expect(res.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  it("returns 401 for wrong credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("x-forwarded-for", TEST_IP)
      .send({ email: TEST_EMAIL, password: "WrongPass1!@#" });
    expect(res.status).toBe(401);
  });

  it("returns 200 and a session cookie for valid credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("x-forwarded-for", TEST_IP)
      .send({ email: TEST_EMAIL, password: TEST_PW });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("returns 400 for missing email", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("x-forwarded-for", TEST_IP)
      .send({ password: TEST_PW });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 200 with success: true", async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .set("x-forwarded-for", TEST_IP)
      .send({ email: TEST_EMAIL, password: TEST_PW });
    const cookie = loginRes.headers["set-cookie"];

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("GET /api/auth/user — authenticated", () => {
  let cookie: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post("/api/auth/login")
      .set("x-forwarded-for", TEST_IP)
      .send({ email: TEST_EMAIL, password: TEST_PW });
    cookie = loginRes.headers["set-cookie"];
  });

  it("returns the logged-in user when session is valid", async () => {
    const res = await request(app).get("/api/auth/user").set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(TEST_EMAIL);
  });
});

describe("Auth guard on protected routes", () => {
  it("returns 401 on /api/ingredients without session", async () => {
    const res = await request(app).get("/api/ingredients");
    expect(res.status).toBe(401);
  });

  it("returns 401 on /api/recipes without session", async () => {
    const res = await request(app).get("/api/recipes");
    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/set-password", () => {
  beforeAll(async () => {
    // Seed two placeholder employees mirroring the business fixture
    // shape: one with no password (eligible for first-login), one
    // with a password already set (must be refused).
    const existingHash =
      "$2b$10$2DXCMtvIaFQFW620KxESIuInl2BDT2vZ6nK0w0d38BYXzuNii8sp2";
    await db.insert(usersTable).values([
      {
        email: SETPW_EMAIL_NEW,
        linkingId: SETPW_LINKING_ID_NEW,
        firstName: "First",
        lastName: "Login",
        passwordHash: null,
        permissions: ["staff"],
      },
      {
        email: SETPW_EMAIL_EXISTING,
        linkingId: SETPW_LINKING_ID_EXISTING,
        firstName: "Already",
        lastName: "Set",
        passwordHash: existingHash,
        permissions: ["staff"],
      },
    ]);
  });

  it("rejects missing body", async () => {
    const res = await request(app)
      .post("/api/auth/set-password")
      .set("x-forwarded-for", SETPW_IP)
      .send({});
    expect(res.status).toBe(400);
  });

  it("rejects a weak password", async () => {
    const res = await request(app)
      .post("/api/auth/set-password")
      .set("x-forwarded-for", SETPW_IP)
      .send({ linkingId: SETPW_LINKING_ID_NEW, password: "weak" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown linkingId", async () => {
    const res = await request(app)
      .post("/api/auth/set-password")
      .set("x-forwarded-for", SETPW_IP)
      .send({
        linkingId: `EMP-DOES-NOT-EXIST-${SETPW_RUN_ID}`,
        password: SETPW_NEW_PW,
      });
    expect(res.status).toBe(404);
  });

  it("happy path: sets the password, issues a session, and login works", async () => {
    const res = await request(app)
      .post("/api/auth/set-password")
      .set("x-forwarded-for", SETPW_IP)
      .send({ linkingId: SETPW_LINKING_ID_NEW, password: SETPW_NEW_PW });
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(SETPW_EMAIL_NEW);
    expect(res.body.user.linkingId).toBe(SETPW_LINKING_ID_NEW);
    expect(res.headers["set-cookie"]).toBeDefined();

    // The password_hash column must now be populated for that user.
    const [row] = await db
      .select({ passwordHash: usersTable.passwordHash })
      .from(usersTable)
      .where(eq(usersTable.linkingId, SETPW_LINKING_ID_NEW));
    expect(row.passwordHash).toBeTruthy();

    // The existing login flow must accept the freshly-set credentials.
    const loginRes = await request(app)
      .post("/api/auth/login")
      .set("x-forwarded-for", SETPW_IP)
      .send({ email: SETPW_EMAIL_NEW, password: SETPW_NEW_PW });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.email).toBe(SETPW_EMAIL_NEW);
  });

  it("returns 409 when the user already has a password", async () => {
    const res = await request(app)
      .post("/api/auth/set-password")
      .set("x-forwarded-for", SETPW_IP)
      .send({
        linkingId: SETPW_LINKING_ID_EXISTING,
        password: SETPW_NEW_PW,
      });
    expect(res.status).toBe(409);
  });

  it("returns 409 if called again after the password was set", async () => {
    // The happy-path test above already set a password on
    // SETPW_LINKING_ID_NEW, so a second call must be refused.
    const res = await request(app)
      .post("/api/auth/set-password")
      .set("x-forwarded-for", SETPW_IP)
      .send({ linkingId: SETPW_LINKING_ID_NEW, password: SETPW_NEW_PW });
    expect(res.status).toBe(409);
  });
});
