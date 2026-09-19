import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type StudioAccess = "OWNER" | "ADMIN" | "MEMBER";

export interface AuthTokenPayload {
  userId: number;
  studioId: number;
  access: StudioAccess;
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

  return {
    userId: payload.userId,
    studioId: payload.studioId,
    access: payload.access,
  };
}
