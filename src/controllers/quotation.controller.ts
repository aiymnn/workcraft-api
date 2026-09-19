import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  QuotationServiceError,
  createQuotation,
  deleteQuotation,
  getQuotation,
  listQuotations,
  updateQuotation,
} from "../services/quotation.service.js";
import { quotationStatuses } from "../schemas/quotation.schema.js";

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
  if (error instanceof QuotationServiceError) {
    return res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
  }
  console.error(fallback, error);
  return res.status(500).json({ status: "error", message: fallback });
}

export async function listQuotationsController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;

    const statusRaw =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const status =
      statusRaw &&
      (quotationStatuses as readonly string[]).includes(statusRaw)
        ? (statusRaw as (typeof quotationStatuses)[number])
        : undefined;

    if (statusRaw && !status) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quotation status filter.",
      });
    }

    const search =
      typeof req.query.search === "string" && req.query.search.trim()
        ? req.query.search.trim()
        : undefined;

    const result = await listQuotations({
      studioId,
      page: parsePositiveInt(req.query.page, 1),
      pageSize: parsePositiveInt(req.query.pageSize, 20),
      ...(status !== undefined ? { status } : {}),
      ...(search !== undefined ? { search } : {}),
    });

    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to list quotations.");
  }
}

export async function getQuotationController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quotation id.",
      });
    }

    const quotation = await getQuotation(studioId, id);
    if (!quotation) {
      return res.status(404).json({
        status: "error",
        message: "Quotation not found.",
      });
    }

    return res.status(200).json({ status: "success", data: { quotation } });
  } catch (error) {
    return handleError(error, res, "Unable to get quotation.");
  }
}

export async function createQuotationController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const quotation = await createQuotation(studioId, req.body);
    return res.status(201).json({ status: "success", data: { quotation } });
  } catch (error) {
    return handleError(error, res, "Unable to create quotation.");
  }
}

export async function updateQuotationController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quotation id.",
      });
    }
    const quotation = await updateQuotation(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { quotation } });
  } catch (error) {
    return handleError(error, res, "Unable to update quotation.");
  }
}

export async function deleteQuotationController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quotation id.",
      });
    }
    const result = await deleteQuotation(studioId, id);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to delete quotation.");
  }
}
