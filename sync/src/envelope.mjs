import { createHash } from "node:crypto";

/** Strong ETag of the stored bytes. The client echoes it back in If-Match. */
export const revision = (bytes) =>
  `"${createHash("sha256").update(bytes).digest("hex")}"`;

const base64 = (text, length) => {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(text)) return false;
  const bytes = Buffer.from(text, "base64");
  if (bytes.toString("base64") !== text) return false;
  return length ? bytes.length === length : bytes.length >= 16;
};

/**
 * True for the encrypted container written by the desktop client
 * (`Envelope` in src-tauri/src/vault.rs): exactly these four fields, nothing
 * else. The server cannot read the ciphertext, only reject anything that is
 * not shaped like one, such as an accidental plaintext upload.
 */
export function isEnvelope(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    value.version === 1 &&
    Object.keys(value).sort().join(",") === "ciphertext,nonce,salt,version" &&
    ["salt", "nonce", "ciphertext"].every((k) => typeof value[k] === "string") &&
    base64(value.salt, 16) &&
    base64(value.nonce, 24) &&
    base64(value.ciphertext)
  );
}
