import { createHash, timingSafeEqual } from "node:crypto";

const MIN_TOKEN_LENGTH = 32;

const digest = (value) => createHash("sha256").update(value).digest();

/**
 * Returns a function that checks an `Authorization` header against the
 * deployment token. Both sides are hashed first, so the comparison runs in
 * constant time whatever the length of the supplied header.
 */
export function createAuthenticator(token) {
  if (typeof token !== "string" || token.length < MIN_TOKEN_LENGTH)
    throw new Error(
      `SYNC_TOKEN must contain at least ${MIN_TOKEN_LENGTH} random characters.`,
    );
  const expected = digest(`Bearer ${token}`);
  return (header) => timingSafeEqual(expected, digest(header ?? ""));
}
