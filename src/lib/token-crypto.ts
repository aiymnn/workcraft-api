import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { env } from "../config/env.js";

/**
 * AES-256-GCM at rest for provider tokens. Key material comes from
 * `TOKEN_ENC_KEY`, falling back to `JWT_SECRET` so a fresh install still works;
 * rotating either one makes previously stored tokens undecryptable.
 */
function encryptionKey(): Buffer {
  const material = env.TOKEN_ENC_KEY?.trim() || env.JWT_SECRET;
  return createHash("sha256").update(material).digest();
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    "v1",
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

export function decryptToken(payload: string): string | null {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(parts[1]!, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(parts[3]!, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[2]!, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
