import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import { db } from "../db/database.js";
import { studios } from "../db/schema/studios.js";
import { eq } from "drizzle-orm";
import { buildCrewSchedulePdf } from "../lib/pdf-documents.js";
import { crewSchedulePdfSchema } from "../schemas/calendar.schema.js";
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

export async function crewSchedulePdfController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;

    const parsed = crewSchedulePdfSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        status: "error",
        message: "Crew schedule details are incomplete.",
      });
    }

    const rows = await db
      .select({ name: studios.name })
      .from(studios)
      .where(eq(studios.id, studioId))
      .limit(1);
    const studioName = rows[0]?.name ?? "Workcraft Studio";
    const buffer = await buildCrewSchedulePdf({
      studioName,
      whoLabel: parsed.data.whoLabel,
      windowLabel: parsed.data.windowLabel,
      rows: parsed.data.rows.map((row) => ({
        date: row.date,
        start: row.start,
        end: row.end,
        type: row.type,
        clientName: row.clientName,
        venue: row.venue,
        role: row.role,
        personName: row.personName ?? null,
      })),
    });
    const slug = parsed.data.whoLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="crew-schedule-${slug || "schedule"}.pdf"`,
    );
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Unable to build crew schedule PDF.", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to build the crew schedule PDF.",
    });
  }
}
