import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import { dashboardQuerySchema } from "../schemas/dashboard.schema.js";
import {
  DashboardServiceError,
  getDashboardSummary,
  type DashboardPeriod,
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

    const query = dashboardQuerySchema.safeParse(req.query);
    if (!query.success) {
      return res.status(400).json({
        status: "error",
        message: "Query must be `period=7|30|90` or ISO `from`/`to` dates.",
      });
    }

    const summary = await getDashboardSummary(req.studioId, {
      ...(query.data.period
        ? { period: Number(query.data.period) as DashboardPeriod }
        : {}),
      ...(query.data.from ? { from: query.data.from } : {}),
      ...(query.data.to ? { to: query.data.to } : {}),
    });
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
