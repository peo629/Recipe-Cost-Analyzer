import * as oidc from "openid-client";

const GOOGLE_ISSUER = new URL("https://accounts.google.com");

let configPromise: Promise<oidc.Configuration> | null = null;

/**
 * Returns true when both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are
 * configured. The Google sign-in button is hidden in the UI when this
 * returns false; the API endpoints respond with 503 in that case.
 */
export function isGoogleOauthConfigured(): boolean {
  return (
    Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET)
  );
}

export async function getGoogleConfig(): Promise<oidc.Configuration> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured to use Google sign-in.",
    );
  }
  if (!configPromise) {
    configPromise = oidc.discovery(GOOGLE_ISSUER, clientId, clientSecret);
  }
  return configPromise;
}

/**
 * Sign-in only requests baseline OIDC scopes. Calendar / Gmail / Tasks
 * scopes are requested incrementally per-feature in a later task.
 */
export const GOOGLE_BASE_SCOPES = ["openid", "email", "profile"];
