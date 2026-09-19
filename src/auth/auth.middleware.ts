import type { NextFunction, Request, Response } from "express";
import {
  verifyAccessToken,
  type StudioAccess,
} from "./jwt.js";

export interface AuthenticatedRequest extends Request {
  userId?: number;
  studioId?: number;
  studioAccess?: StudioAccess;
}

export function requireAuth(
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

  try {
    const payload = verifyAccessToken(token);

    req.userId = payload.userId;
    req.studioId = payload.studioId;
    req.studioAccess = payload.access;

    next();
  } catch {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired authentication token.",
    });
  }
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
