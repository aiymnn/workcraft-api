import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  JobServiceError,
  createJob,
  deleteJob,
  getJob,
  listJobs,
  patchChecklistItem,
  patchDeliverable,
  updateJob,
} from "../services/job.service.js";
import { jobStatuses } from "../schemas/job.schema.js";

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

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parseId(value: unknown): number | null {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

function handleError(error: unknown, res: Response, fallback: string) {
  if (error instanceof JobServiceError) {
    return res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
  }
  console.error(fallback, error);
  return res.status(500).json({ status: "error", message: fallback });
}

export async function listJobsController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;

    const statusRaw =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const status =
      statusRaw && (jobStatuses as readonly string[]).includes(statusRaw)
        ? (statusRaw as (typeof jobStatuses)[number])
        : undefined;

    if (statusRaw && !status) {
      return res.status(400).json({
        status: "error",
        message: "Invalid job status filter.",
      });
    }

    const search =
      typeof req.query.search === "string" && req.query.search.trim()
        ? req.query.search.trim()
        : undefined;

    const result = await listJobs({
      studioId,
      page: parsePositiveInt(req.query.page, 1),
      pageSize: parsePositiveInt(req.query.pageSize, 20),
      ...(status !== undefined ? { status } : {}),
      ...(search !== undefined ? { search } : {}),
    });

    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to list jobs.");
  }
}

export async function getJobController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid job id." });
    }
    const job = await getJob(studioId, id);
    if (!job) {
      return res.status(404).json({ status: "error", message: "Job not found." });
    }
    return res.status(200).json({ status: "success", data: { job } });
  } catch (error) {
    return handleError(error, res, "Unable to get job.");
  }
}

export async function createJobController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const job = await createJob(studioId, req.body);
    return res.status(201).json({ status: "success", data: { job } });
  } catch (error) {
    return handleError(error, res, "Unable to create job.");
  }
}

export async function updateJobController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid job id." });
    }
    const job = await updateJob(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { job } });
  } catch (error) {
    return handleError(error, res, "Unable to update job.");
  }
}

export async function deleteJobController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid job id." });
    }
    const result = await deleteJob(studioId, id);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to delete job.");
  }
}

export async function patchChecklistItemController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const jobId = parseId(req.params.id);
    const itemId = parseId(req.params.itemId);
    if (jobId === null || itemId === null) {
      return res.status(400).json({ status: "error", message: "Invalid id." });
    }
    const job = await patchChecklistItem(studioId, jobId, itemId, req.body);
    return res.status(200).json({ status: "success", data: { job } });
  } catch (error) {
    return handleError(error, res, "Unable to update checklist item.");
  }
}

export async function patchDeliverableController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const jobId = parseId(req.params.id);
    const deliverableId = parseId(req.params.deliverableId);
    if (jobId === null || deliverableId === null) {
      return res.status(400).json({ status: "error", message: "Invalid id." });
    }
    const job = await patchDeliverable(studioId, jobId, deliverableId, req.body);
    return res.status(200).json({ status: "success", data: { job } });
  } catch (error) {
    return handleError(error, res, "Unable to update deliverable.");
  }
}
