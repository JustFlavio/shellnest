import { createHash } from "node:crypto";

/** Strong ETag of the stored bytes. The client echoes it back in If-Match. */
export const revision = (bytes: Uint8Array) =>
  `"${createHash("sha256").update(bytes).digest("hex")}"`;

type Envelope = {
  version: 1;
  salt: string;
  nonce: string;
  ciphertext: string;
};

const base64 = (text: string, length?: number) => {
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
export function isEnvelope(value: unknown): value is Envelope {
  if (value === null || typeof value !== "object") return false;
  const { version, salt, nonce, ciphertext } = value as Record<string, unknown>;
  return (
    version === 1 &&
    Object.keys(value).sort().join(",") === "ciphertext,nonce,salt,version" &&
    typeof salt === "string" &&
    typeof nonce === "string" &&
    typeof ciphertext === "string" &&
    base64(salt, 16) &&
    base64(nonce, 24) &&
    base64(ciphertext)
  );
}
