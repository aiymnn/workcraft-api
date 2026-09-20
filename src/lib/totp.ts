import { Secret, TOTP } from "otpauth";
import QRCode from "qrcode";

const ISSUER = "Workcraft";

/** Base32 secret, 20 random bytes — what authenticator apps expect. */
export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

function totpFor(secret: string, label: string) {
  return new TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secret),
  });
}

export function totpAuthUrl(secret: string, label: string): string {
  return totpFor(secret, label).toString();
}

export async function totpQrDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });
}

/** Accepts the current code plus one step either side for clock drift. */
export function verifyTotpCode(
  secret: string,
  label: string,
  code: string,
): boolean {
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== 6) return false;

  const delta = totpFor(secret, label).validate({
    token: normalized,
    window: 1,
  });

  return delta !== null;
}
