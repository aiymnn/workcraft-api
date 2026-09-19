import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  SettingsServiceError,
  addOptionItem,
  getOptionCatalog,
  getStudioSettings,
  isOptionListKey,
  listOptionCatalogs,
  listReminderRules,
  replaceReminderRules,
  seedOptionCatalog,
  updateOptionItem,
  updateStudioSettings,
} from "../services/settings.service.js";

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

function handleSettingsError(error: unknown, res: Response, fallback: string) {
  if (error instanceof SettingsServiceError) {
    return res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
  }
  console.error(fallback, error);
  return res.status(500).json({
    status: "error",
    message: fallback,
  });
}

export async function getStudioController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const studio = await getStudioSettings(studioId);
    return res.status(200).json({ status: "success", data: { studio } });
  } catch (error) {
    return handleSettingsError(error, res, "Unable to get studio settings.");
  }
}

export async function patchStudioController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const studio = await updateStudioSettings(studioId, req.body);
    return res.status(200).json({ status: "success", data: { studio } });
  } catch (error) {
    return handleSettingsError(error, res, "Unable to update studio settings.");
  }
}

export async function listOptionsController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const catalogs = await listOptionCatalogs(studioId);
    return res.status(200).json({ status: "success", data: { catalogs } });
  } catch (error) {
    return handleSettingsError(error, res, "Unable to list option catalogs.");
  }
}

export async function getOptionCatalogController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const key = String(req.params.key);
    if (!isOptionListKey(key)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid option list key.",
      });
    }
    const catalog = await getOptionCatalog(studioId, key);
    return res.status(200).json({ status: "success", data: { catalog } });
  } catch (error) {
    return handleSettingsError(error, res, "Unable to get option catalog.");
  }
}

export async function seedOptionCatalogController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const key = String(req.params.key);
    if (!isOptionListKey(key)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid option list key.",
      });
    }
    const catalog = await seedOptionCatalog(studioId, key);
    return res.status(200).json({ status: "success", data: { catalog } });
  } catch (error) {
    return handleSettingsError(error, res, "Unable to seed option catalog.");
  }
}

export async function addOptionItemController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const key = String(req.params.key);
    if (!isOptionListKey(key)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid option list key.",
      });
    }
    const result = await addOptionItem(studioId, key, req.body.label);
    return res.status(201).json({ status: "success", data: result });
  } catch (error) {
    return handleSettingsError(error, res, "Unable to add option item.");
  }
}

export async function updateOptionItemController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({
        status: "error",
        message: "Invalid option item id.",
      });
    }
    const catalog = await updateOptionItem(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { catalog } });
  } catch (error) {
    return handleSettingsError(error, res, "Unable to update option item.");
  }
}

export async function listRemindersController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const rules = await listReminderRules(studioId);
    return res.status(200).json({ status: "success", data: { rules } });
  } catch (error) {
    return handleSettingsError(error, res, "Unable to list reminder rules.");
  }
}

export async function putRemindersController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const rules = await replaceReminderRules(studioId, req.body.rules);
    return res.status(200).json({ status: "success", data: { rules } });
  } catch (error) {
    return handleSettingsError(error, res, "Unable to update reminder rules.");
  }
}
