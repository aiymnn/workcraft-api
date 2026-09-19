import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthTokenPayload {
  userId: number;
}

export function signAccessToken(userId: number): string {
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<
      jwt.SignOptions["expiresIn"]
    >,
  };

  return jwt.sign(
    {
      userId,
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
    typeof payload.userId !== "number"
  ) {
    throw new Error("Invalid authentication token.");
  }

  return {
    userId: payload.userId,
  };
}
