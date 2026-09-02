import * as oidc from "openid-client";
import { Router, type IRouter, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { eq, sql } from "drizzle-orm";
import {
  GetCurrentAuthUserResponse,
  SignupBody,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  GetGoogleAuthAvailabilityResponse,
  SetPasswordBody,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import {
  clearSession,
  cookieSameSite,
  createSession,
  getSessionId,
  setSessionCookie,
  toAuthUser,
} from "../lib/auth";
import {
  hashPassword,
  validatePasswordPolicy,
  verifyPassword,
} from "../lib/passwords";
import {
  getGoogleConfig,
  GOOGLE_BASE_SCOPES,
  isGoogleOauthConfigured,
} from "../lib/google-oauth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

// Rate-limit credential endpoints to slow down credential stuffing.
// 10 attempts / 15 min / IP for login, 5 / hour / IP for signup.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});
const signupRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many signup attempts. Please try again later." },
});
// Set-password is the invite/first-login flow. The rate limit is
// intentionally tighter than login (which has to tolerate honest
// users mistyping passwords): 10 attempts per hour per IP is enough
// for an admin onboarding a small handful of employees while still
// frustrating linking_id enumeration.
const setPasswordRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many set-password attempts. Please try again later.",
  },
});

const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: cookieSameSite(),
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function clearOidcCookies(res: Response) {
  for (const name of [
    "google_code_verifier",
    "google_nonce",
    "google_state",
    "google_return_to",
  ]) {
    res.clearCookie(name, { path: "/" });
  }
}

function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }
  return value;
}

// ---------------------------------------------------------------------------
// GET /api/auth/user
// Returns the currently authenticated user (or null).
// ---------------------------------------------------------------------------
router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

// ---------------------------------------------------------------------------
// GET /api/auth/google/available
// Lets the frontend know whether the Google sign-in button should be
// rendered (i.e. whether Google OAuth credentials are configured).
// ---------------------------------------------------------------------------
router.get("/auth/google/available", (_req: Request, res: Response) => {
  res.json(
    GetGoogleAuthAvailabilityResponse.parse({
      available: isGoogleOauthConfigured(),
    }),
  );
});

// ---------------------------------------------------------------------------
// POST /api/auth/signup  { email, password, firstName?, lastName? }
// Creates a new credential-backed user.
// ---------------------------------------------------------------------------
router.post(
  "/auth/signup",
  signupRateLimit,
  async (req: Request, res: Response) => {
    const parsed = SignupBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body.",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { email, password, firstName, lastName } = parsed.data;
    const policyErrors = validatePasswordPolicy(password);
    if (policyErrors.length > 0) {
      res.status(400).json({
        error: "Password does not meet the policy requirements.",
        code: "PASSWORD_POLICY",
        reasons: policyErrors,
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(sql`lower(${usersTable.email}) = ${normalizedEmail}`);
    if (existing) {
      res
        .status(409)
        .json({ error: "An account with that email already exists." });
      return;
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(usersTable)
      .values({
        email: normalizedEmail,
        passwordHash,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
      })
      .returning();

    const authUser = toAuthUser(user);
    const sid = await createSession({ user: authUser });
    setSessionCookie(res, sid);
    res.status(201).json(LoginResponse.parse({ user: authUser }));
  },
);

// ---------------------------------------------------------------------------
// POST /api/auth/login  { email, password }
// Verifies credentials and creates a session.
// ---------------------------------------------------------------------------
router.post(
  "/auth/login",
  loginRateLimit,
  async (req: Request, res: Response) => {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body." });
      return;
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const [user] = await db
      .select()
      .from(usersTable)
      .where(sql`lower(${usersTable.email}) = ${normalizedEmail}`);

    // Always run a bcrypt comparison even when the user does not exist
    // to avoid leaking which emails are registered via timing.
    const fakeHash =
      "$2b$12$0123456789012345678901u4xZkTplaCEHoldERhashforTimingxxx12";
    const ok = user?.passwordHash
      ? await verifyPassword(password, user.passwordHash)
      : (await verifyPassword(password, fakeHash), false);

    if (!user || !user.passwordHash || !ok) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const authUser = toAuthUser(user);
    const sid = await createSession({ user: authUser });
    setSessionCookie(res, sid);
    res.json(LoginResponse.parse({ user: authUser }));
  },
);

// ---------------------------------------------------------------------------
// POST /api/auth/set-password  { linkingId, password }
// First-login / invite flow: attaches a password to an employee row
// that was provisioned by the business fixture / payroll import and
// has no password yet. Refuses to overwrite an existing password —
// password resets are intentionally a separate flow.
// ---------------------------------------------------------------------------
router.post(
  "/auth/set-password",
  setPasswordRateLimit,
  async (req: Request, res: Response) => {
    const parsed = SetPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request body.",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { linkingId, password } = parsed.data;
    const policyErrors = validatePasswordPolicy(password);
    if (policyErrors.length > 0) {
      res.status(400).json({
        error: "Password does not meet the policy requirements.",
        code: "PASSWORD_POLICY",
        reasons: policyErrors,
      });
      return;
    }

    // Look up the user first to disambiguate "no such linkingId" (404)
    // from "linkingId exists but is already initialised" (409). The
    // actual write below is gated on `password_hash IS NULL` in the
    // same statement so two concurrent set-password calls cannot both
    // succeed (the second one's RETURNING comes back empty).
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.linkingId, linkingId));

    if (!user) {
      res.status(404).json({ error: "No employee matches that linking id." });
      return;
    }

    if (user.passwordHash) {
      res.status(409).json({
        error:
          "This account already has a password. Use the password reset flow instead.",
      });
      return;
    }

    const passwordHash = await hashPassword(password);

    const [updated] = await db
      .update(usersTable)
      .set({ passwordHash })
      .where(
        sql`${usersTable.id} = ${user.id} and ${usersTable.passwordHash} is null`,
      )
      .returning();

    if (!updated) {
      // Lost a race with another concurrent set-password call.
      res.status(409).json({
        error:
          "This account already has a password. Use the password reset flow instead.",
      });
      return;
    }

    const authUser = toAuthUser(updated);
    const sid = await createSession({ user: authUser });
    setSessionCookie(res, sid);
    res.status(200).json(LoginResponse.parse({ user: authUser }));
  },
);

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// Clears the session cookie and deletes the server-side session.
// ---------------------------------------------------------------------------
router.post("/auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json(LogoutResponse.parse({ success: true }));
});

// ---------------------------------------------------------------------------
// GET /api/auth/google
// Begins the Google OIDC login flow with PKCE.
// ---------------------------------------------------------------------------
router.get("/auth/google", async (req: Request, res: Response) => {
  if (!isGoogleOauthConfigured()) {
    res.status(503).json({ error: "Google sign-in is not configured." });
    return;
  }

  const config = await getGoogleConfig();
  const callbackUrl = `${getOrigin(req)}/api/auth/google/callback`;
  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: GOOGLE_BASE_SCOPES.join(" "),
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });

  setOidcCookie(res, "google_code_verifier", codeVerifier);
  setOidcCookie(res, "google_nonce", nonce);
  setOidcCookie(res, "google_state", state);
  setOidcCookie(res, "google_return_to", returnTo);

  res.redirect(redirectTo.href);
});

// ---------------------------------------------------------------------------
// GET /api/auth/google/callback
// Completes the Google OIDC login flow, upserting the user and
// creating a session.
// ---------------------------------------------------------------------------
router.get("/auth/google/callback", async (req: Request, res: Response) => {
  if (!isGoogleOauthConfigured()) {
    res.status(503).json({ error: "Google sign-in is not configured." });
    return;
  }

  const config = await getGoogleConfig();
  const callbackUrl = `${getOrigin(req)}/api/auth/google/callback`;

  const codeVerifier = req.cookies?.google_code_verifier;
  const nonce = req.cookies?.google_nonce;
  const expectedState = req.cookies?.google_state;
  const returnTo = getSafeReturnTo(req.cookies?.google_return_to);

  if (!codeVerifier || !expectedState) {
    clearOidcCookies(res);
    res.redirect("/");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch (err) {
    req.log.error({ err }, "Google OIDC code exchange failed");
    clearOidcCookies(res);
    res.redirect("/");
    return;
  }

  clearOidcCookies(res);

  const claims = tokens.claims();
  if (!claims || !claims.sub) {
    res.redirect("/");
    return;
  }

  const sub = claims.sub as string;
  const email = (claims.email as string | undefined)?.toLowerCase();
  const givenName = (claims.given_name as string | undefined) ?? null;
  const familyName = (claims.family_name as string | undefined) ?? null;
  const picture = (claims.picture as string | undefined) ?? null;

  // 1. Try to match an existing user by google_sub.
  // 2. Otherwise, link by verified email.
  // 3. Otherwise, create a new account.
  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.googleSub, sub));

  if (!user && email) {
    const [byEmail] = await db
      .select()
      .from(usersTable)
      .where(sql`lower(${usersTable.email}) = ${email}`);
    if (byEmail) {
      [user] = await db
        .update(usersTable)
        .set({
          googleSub: sub,
          firstName: byEmail.firstName ?? givenName,
          lastName: byEmail.lastName ?? familyName,
          profileImageUrl: byEmail.profileImageUrl ?? picture,
        })
        .where(eq(usersTable.id, byEmail.id))
        .returning();
    }
  }

  if (!user) {
    if (!email) {
      req.log.warn(
        { sub },
        "Google account has no email claim — refusing signup",
      );
      res.redirect("/");
      return;
    }
    [user] = await db
      .insert(usersTable)
      .values({
        email,
        googleSub: sub,
        firstName: givenName,
        lastName: familyName,
        profileImageUrl: picture,
      })
      .returning();
  }

  const authUser = toAuthUser(user);
  const now = Math.floor(Date.now() / 1000);
  const sid = await createSession({
    user: authUser,
    google: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiresIn() ? now + tokens.expiresIn()! : undefined,
      scopes: GOOGLE_BASE_SCOPES,
    },
  });
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

export default router;
