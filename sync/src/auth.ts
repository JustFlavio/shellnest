import {
  createHash,
  createHmac,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

/** A secret the server can check but not recover: scrypt with its own salt. */
export type Verifier = { salt: string; hash: string };

const derive = (secret: Buffer, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(
      secret,
      salt,
      32,
      { N: 1 << 15, r: 8, p: 1, maxmem: 64 << 20 },
      (e, key) => (e ? reject(e) : resolve(key)),
    ),
  );

/**
 * The client sends a 32-byte key derived from the password with Argon2id
 * (`account::crypto::login_keys`), never the password itself. The server
 * still hashes it, so a copy of the data directory is not a login.
 */
export async function makeVerifier(secret: Buffer): Promise<Verifier> {
  const salt = randomBytes(16);
  return {
    salt: salt.toString("base64"),
    hash: (await derive(secret, salt)).toString("base64"),
  };
}

export async function verify(secret: Buffer, verifier: Verifier) {
  const expected = Buffer.from(verifier.hash, "base64");
  const actual = await derive(secret, Buffer.from(verifier.salt, "base64"));
  return timingSafeEqual(expected, actual);
}

/** Device tokens are random; the server stores only their SHA-256. */
export const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const newToken = () => randomBytes(32).toString("base64url");

export const newId = () => randomBytes(16).toString("hex");

/**
 * The client's Argon2 settings version, which it stores in front of each salt
 * (`account::crypto::KDF_VERSION`). Only the decoy salt needs it here.
 */
const KDF_VERSION = "1";

/**
 * The Argon2 salt reported for an unknown username: stable and derived from a
 * server secret, so the reply looks like a real account's.
 */
export const decoySalt = (secret: Buffer, username: string) =>
  `${KDF_VERSION}:${createHmac("sha256", secret)
    .update(`salt:${username}`)
    .digest()
    .subarray(0, 16)
    .toString("base64")}`;

// Many keys come from attempts with made-up usernames; past this many, stale ones go.
const SWEEP_ABOVE = 10_000;

/** Counts failed attempts per key in a sliding window. Keys with no recent failure are dropped. */
export function createLimiter({
  attempts,
  windowMs,
  now = Date.now,
}: {
  attempts: number;
  windowMs: number;
  now?: () => number;
}) {
  const failures = new Map<string, number[]>();
  const recent = (key: string) =>
    (failures.get(key) ?? []).filter((t) => now() - t < windowMs);
  return {
    blocked: (key: string) => recent(key).length >= attempts,
    fail: (key: string) => {
      const list = recent(key);
      list.push(now());
      failures.set(key, list);
      if (failures.size > SWEEP_ABOVE)
        for (const old of failures.keys())
          if (!recent(old).length) failures.delete(old);
    },
    clear: (key: string) => failures.delete(key),
  };
}
