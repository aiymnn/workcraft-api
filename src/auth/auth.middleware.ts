import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "./jwt.js";

export interface AuthenticatedRequest extends Request {
  userId?: number;
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

    next();
  } catch {
    return res.status(401).json({
      status: "error",
      message: "Invalid or expired authentication token.",
    });
  }
}
