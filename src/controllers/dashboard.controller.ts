import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  DashboardServiceError,
  getDashboardSummary,
} from "../services/dashboard.service.js";

export async function getDashboardController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    if (!req.studioId) {
      return res.status(403).json({
        status: "error",
        message: "No studio membership for this account.",
      });
    }
    const summary = await getDashboardSummary(req.studioId);
    return res.status(200).json({ status: "success", data: summary });
  } catch (error) {
    if (error instanceof DashboardServiceError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }
    console.error("Unable to load dashboard.", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to load dashboard.",
    });
  }
}
