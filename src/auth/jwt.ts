import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type StudioAccess = "OWNER" | "ADMIN" | "MEMBER";

export interface AuthTokenPayload {
  userId: number;
  studioId: number;
  access: StudioAccess;
  /** Session id claim; present on tokens issued with a `user_sessions` row. */
  sid?: string;
}

export function signAccessToken(payload: AuthTokenPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<
      jwt.SignOptions["expiresIn"]
    >,
  };

  return jwt.sign(
    {
      userId: payload.userId,
      studioId: payload.studioId,
      access: payload.access,
      ...(payload.sid !== undefined ? { sid: payload.sid } : {}),
    },
    env.JWT_SECRET,
    options,
  );
}

export function verifyAccessToken(token: string): AuthTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET);

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("userId" in payload) ||
    typeof payload.userId !== "number" ||
    !("studioId" in payload) ||
    typeof payload.studioId !== "number" ||
    !("access" in payload) ||
    (payload.access !== "OWNER" &&
      payload.access !== "ADMIN" &&
      payload.access !== "MEMBER")
  ) {
    throw new Error("Invalid authentication token.");
  }

  const sid =
    "sid" in payload && typeof payload.sid === "string" ? payload.sid : undefined;

  return {
    userId: payload.userId,
    studioId: payload.studioId,
    access: payload.access,
    ...(sid !== undefined ? { sid } : {}),
  };
}

/** Expiry of the access token in seconds, used to size session rows. */
export function accessTokenLifetimeSeconds(): number {
  const probe = jwt.sign({ probe: true }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<jwt.SignOptions["expiresIn"]>,
  });
  const decoded = jwt.decode(probe);
  if (
    typeof decoded === "object" &&
    decoded !== null &&
    typeof decoded.exp === "number" &&
    typeof decoded.iat === "number"
  ) {
    return decoded.exp - decoded.iat;
  }
  return 3600;
}

/** Short-lived token handed out between password and 2FA code. */
export function signTwoFactorToken(userId: number): string {
  return jwt.sign({ userId, purpose: "2fa" }, env.JWT_SECRET, {
    expiresIn: "5m",
  });
}

export function verifyTwoFactorToken(token: string): { userId: number } {
  const payload = jwt.verify(token, env.JWT_SECRET);

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("userId" in payload) ||
    typeof payload.userId !== "number" ||
    !("purpose" in payload) ||
    payload.purpose !== "2fa"
  ) {
    throw new Error("Invalid two-factor token.");
  }

  return { userId: payload.userId };
}

/** Signed `state` for the Google redirect, which carries no Bearer header. */
export function signOauthStateToken(payload: {
  userId: number;
  purpose: "calendar" | "drive";
}): string {
  return jwt.sign(
    { userId: payload.userId, oauthPurpose: payload.purpose, purpose: "oauth" },
    env.JWT_SECRET,
    { expiresIn: "15m" },
  );
}

export function verifyOauthStateToken(token: string): {
  userId: number;
  purpose: "calendar" | "drive";
} {
  const payload = jwt.verify(token, env.JWT_SECRET);

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("userId" in payload) ||
    typeof payload.userId !== "number" ||
    !("purpose" in payload) ||
    payload.purpose !== "oauth" ||
    !("oauthPurpose" in payload) ||
    (payload.oauthPurpose !== "calendar" && payload.oauthPurpose !== "drive")
  ) {
    throw new Error("Invalid OAuth state.");
  }

  return { userId: payload.userId, purpose: payload.oauthPurpose };
}
