// The shapes the server accepts. It cannot read any ciphertext, so it only checks that each value
// has exactly the form the desktop client produces (src-tauri/src/account/crypto.rs) and nothing else.

/** XChaCha20-Poly1305 output: a 24-byte nonce and the ciphertext with its tag. */
export type Box = { nonce: string; ciphertext: string };
/** A key sealed to an X25519 public key: ephemeral public key, nonce, 32-byte key plus tag. */
export type Sealed = { ephemeral: string; nonce: string; ciphertext: string };
export type Role = "owner" | "editor" | "viewer";

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Canonical base64 of exactly `length` bytes, or of at least `min` bytes. */
export function isBase64(
  value: unknown,
  { length, min = 1 }: { length?: number; min?: number } = {},
): value is string {
  if (typeof value !== "string" || !BASE64.test(value)) return false;
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) return false;
  return length === undefined ? bytes.length >= min : bytes.length === length;
}

/** An Argon2 salt as the client stores it: `<KDF version>:<16 bytes, base64>`. */
export function isSalt(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const [version, salt, ...rest] = value.split(":");
  return (
    /^[1-9][0-9]{0,2}$/.test(version) &&
    !rest.length &&
    isBase64(salt, { length: 16 })
  );
}

const exactKeys = (value: unknown, keys: string[]) =>
  value !== null &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(",") === [...keys].sort().join(",");

export function isBox(value: unknown): value is Box {
  if (!exactKeys(value, ["nonce", "ciphertext"])) return false;
  const { nonce, ciphertext } = value as Box;
  return isBase64(nonce, { length: 24 }) && isBase64(ciphertext, { min: 16 });
}

export function isSealed(value: unknown): value is Sealed {
  if (!exactKeys(value, ["ephemeral", "nonce", "ciphertext"])) return false;
  const { ephemeral, nonce, ciphertext } = value as Sealed;
  return (
    isBase64(ephemeral, { length: 32 }) &&
    isBase64(nonce, { length: 24 }) &&
    isBase64(ciphertext, { length: 48 })
  );
}

/** Lowercase, 2 to 32 characters, starting with a letter or digit. */
export const isUsername = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z0-9][a-z0-9._-]{1,31}$/.test(value);

/** The 128-bit random ids the client makes for vaults (`model::new_id`). */
export const isId = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{32}$/.test(value);

export const isRole = (value: unknown): value is Role =>
  value === "owner" || value === "editor" || value === "viewer";

/** A device name chosen by the user: shown in the device list, never used as a path. */
export const isDeviceName = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= 80 &&
  !/\p{Cc}/u.test(value);

export const isRevision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
