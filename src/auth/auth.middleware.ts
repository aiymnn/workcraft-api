import type { NextFunction, Request, Response } from "express";
import {
  verifyAccessToken,
  type StudioAccess,
} from "./jwt.js";
import { isSessionActive } from "./session.service.js";

export interface AuthenticatedRequest extends Request {
  userId?: number;
  studioId?: number;
  studioAccess?: StudioAccess;
  sessionId?: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).json({
      status: "error",
      message: "Authentication required.",
    });
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      status: "error",
      message: "Invalid authorization header.",
    });
  }

  let payload: ReturnType<typeof verifyAccessToken>;

  try {
    payload = verifyAccessToken(token);
  } catch {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired authentication token.",
    });
  }

  // Tokens carrying a session id die with "Sign out everywhere".
  if (payload.sid) {
    let active: boolean;
    try {
      active = await isSessionActive(payload.userId, payload.sid);
    } catch (error) {
      console.error("Session lookup failed.", error);
      return res.status(500).json({
        status: "error",
        message: "Unable to verify this session.",
      });
    }

    if (!active) {
      return res.status(401).json({
        status: "error",
        message: "This session was signed out. Sign in again.",
      });
    }

    req.sessionId = payload.sid;
  }

  req.userId = payload.userId;
  req.studioId = payload.studioId;
  req.studioAccess = payload.access;

  next();
}

/** Requires auth + a studio membership on the token. */
export function requireStudio(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.userId) {
    return res.status(401).json({
      status: "error",
      message: "Authentication required.",
    });
  }

  if (!req.studioId || !req.studioAccess) {
    return res.status(403).json({
      status: "error",
      message: "No studio membership for this account.",
    });
  }

  next();
}
