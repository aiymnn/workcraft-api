import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  PricingServiceError,
  createSavedCalc,
  deleteSavedCalc,
  getPricingHub,
  getSavedCalc,
  listSavedCalcs,
  updateSavedCalc,
  upsertOpex,
  upsertTargets,
} from "../services/pricing.service.js";

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

function parseId(value: unknown): number | null {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

function handleError(error: unknown, res: Response, fallback: string) {
  if (error instanceof PricingServiceError) {
    return res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
  }
  console.error(fallback, error);
  return res.status(500).json({ status: "error", message: fallback });
}

export async function getPricingHubController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const hub = await getPricingHub(studioId);
    return res.status(200).json({ status: "success", data: hub });
  } catch (error) {
    return handleError(error, res, "Unable to load pricing hub.");
  }
}

export async function putOpexController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const opex = await upsertOpex(studioId, req.body.payload);
    return res.status(200).json({ status: "success", data: { opex } });
  } catch (error) {
    return handleError(error, res, "Unable to save OPEX.");
  }
}

export async function putTargetsController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const targets = await upsertTargets(studioId, req.body);
    return res.status(200).json({ status: "success", data: { targets } });
  } catch (error) {
    return handleError(error, res, "Unable to save targets.");
  }
}

export async function listSavedCalcsController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const savedCalcs = await listSavedCalcs(studioId);
    return res.status(200).json({ status: "success", data: { savedCalcs } });
  } catch (error) {
    return handleError(error, res, "Unable to list saved calculations.");
  }
}

export async function getSavedCalcController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid id." });
    }
    const calc = await getSavedCalc(studioId, id);
    if (!calc) {
      return res.status(404).json({
        status: "error",
        message: "Saved calculation not found.",
      });
    }
    return res.status(200).json({ status: "success", data: { calc } });
  } catch (error) {
    return handleError(error, res, "Unable to get saved calculation.");
  }
}

export async function createSavedCalcController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const calc = await createSavedCalc(studioId, req.body);
    return res.status(201).json({ status: "success", data: { calc } });
  } catch (error) {
    return handleError(error, res, "Unable to save calculation.");
  }
}

export async function updateSavedCalcController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid id." });
    }
    const calc = await updateSavedCalc(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { calc } });
  } catch (error) {
    return handleError(error, res, "Unable to update saved calculation.");
  }
}

export async function deleteSavedCalcController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid id." });
    }
    const result = await deleteSavedCalc(studioId, id);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to delete saved calculation.");
  }
}
