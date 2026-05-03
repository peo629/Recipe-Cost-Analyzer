import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;
const MIN_LENGTH = 12;

export type PasswordPolicyError = {
  code: "PASSWORD_POLICY";
  reasons: string[];
};

/**
 * Validate that a password meets the policy:
 *  - at least 12 characters
 *  - at least one upper-case letter
 *  - at least one lower-case letter
 *  - at least one digit
 *  - at least one special character (anything that is not a letter or digit)
 *
 * Returns the list of failing rules. An empty list means the password is
 * acceptable.
 */
export function validatePasswordPolicy(password: string): string[] {
  const reasons: string[] = [];

  if (typeof password !== "string" || password.length < MIN_LENGTH) {
    reasons.push(`Must be at least ${MIN_LENGTH} characters long.`);
  }
  if (!/[a-z]/.test(password)) {
    reasons.push("Must contain at least one lower-case letter.");
  }
  if (!/[A-Z]/.test(password)) {
    reasons.push("Must contain at least one upper-case letter.");
  }
  if (!/[0-9]/.test(password)) {
    reasons.push("Must contain at least one digit.");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    reasons.push("Must contain at least one special character.");
  }

  return reasons;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
