import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  JobServiceError,
  listCalendarSessions,
} from "../services/job.service.js";

function requireStudioId(req: AuthenticatedRequest, res: Response): number | null {
  if (!req.studioId) {
    res.status(403).json({
      status: "error",
      message: "No studio membership for this account.",
    });
    return null;
  }
  return req.studioId;
}

function parseBound(value: unknown, label: string): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new JobServiceError(`Invalid ${label} datetime.`, 400);
  }
  return date;
}

export async function listCalendarSessionsController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;

    const from = parseBound(req.query.from, "from");
    const to = parseBound(req.query.to, "to");
    if (!from || !to) {
      return res.status(400).json({
        status: "error",
        message: "Query params `from` and `to` (ISO datetimes) are required.",
      });
    }

    const sessions = await listCalendarSessions({ studioId, from, to });
    return res.status(200).json({ status: "success", data: { sessions } });
  } catch (error) {
    if (error instanceof JobServiceError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }
    console.error("Unable to list calendar sessions.", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to list calendar sessions.",
    });
  }
}
