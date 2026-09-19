import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "./auth.middleware.js";
import { userHasPermission } from "./permission.service.js";

export function requirePermission(permissionName: string) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    if (!req.userId) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required.",
      });
    }

    try {
      const allowed = await userHasPermission(req.userId, permissionName);

      if (!allowed) {
        return res.status(403).json({
          status: "error",
          message: "You do not have permission to perform this action.",
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to verify permissions.",
      });
    }
  };
}
