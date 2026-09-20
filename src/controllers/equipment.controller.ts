import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import { equipmentStatuses } from "../schemas/equipment.schema.js";
import {
  createEquipment,
  deleteEquipment,
  EquipmentServiceError,
  getEquipment,
  listEquipment,
  updateEquipment,
} from "../services/equipment.service.js";

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function requireStudioId(
  req: AuthenticatedRequest,
  res: Response,
): number | null {
  if (!req.studioId) {
    res.status(403).json({
      status: "error",
      message: "No studio membership for this account.",
    });
    return null;
  }
  return req.studioId;
}

function parseAssetId(req: AuthenticatedRequest, res: Response): number | null {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({
      status: "error",
      message: "Invalid equipment asset id.",
    });
    return null;
  }
  return id;
}

function handleError(error: unknown, res: Response, fallback: string) {
  if (error instanceof EquipmentServiceError) {
    return res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
  }
  console.error(`${fallback}:`, error);
  return res.status(500).json({ status: "error", message: fallback });
}

export async function listEquipmentController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;

    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, 100);
    const search =
      typeof req.query.search === "string" && req.query.search.trim()
        ? req.query.search.trim()
        : undefined;
    const statusParam =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const status = (equipmentStatuses as readonly string[]).includes(
      statusParam ?? "",
    )
      ? (statusParam as (typeof equipmentStatuses)[number])
      : undefined;

    const result = await listEquipment({
      studioId,
      page,
      pageSize,
      ...(search !== undefined ? { search } : {}),
      ...(status !== undefined ? { status } : {}),
    });

    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to list equipment.");
  }
}

export async function getEquipmentController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;

    const id = parseAssetId(req, res);
    if (id === null) return;

    const asset = await getEquipment(studioId, id);
    if (!asset) {
      return res.status(404).json({
        status: "error",
        message: "Equipment asset not found.",
      });
    }

    return res.status(200).json({ status: "success", data: { asset } });
  } catch (error) {
    return handleError(error, res, "Unable to get equipment asset.");
  }
}

export async function createEquipmentController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;

    const asset = await createEquipment(studioId, req.body);
    return res.status(201).json({ status: "success", data: { asset } });
  } catch (error) {
    return handleError(error, res, "Unable to create equipment asset.");
  }
}

export async function updateEquipmentController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;

    const id = parseAssetId(req, res);
    if (id === null) return;

    const asset = await updateEquipment(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { asset } });
  } catch (error) {
    return handleError(error, res, "Unable to update equipment asset.");
  }
}

export async function deleteEquipmentController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;

    const id = parseAssetId(req, res);
    if (id === null) return;

    const result = await deleteEquipment(studioId, id);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to delete equipment asset.");
  }
}
