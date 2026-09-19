import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  createClient,
  getClient,
  listClients,
  softDeleteClient,
  updateClient,
  ClientServiceError,
} from "../services/client.service.js";

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

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

export async function listClientsController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;

    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, 20);
    const search =
      typeof req.query.search === "string" && req.query.search.trim()
        ? req.query.search.trim()
        : undefined;
    const includeRetired = req.query.includeRetired === "true";

    const result = await listClients({
      studioId,
      page,
      pageSize,
      includeRetired,
      ...(search !== undefined ? { search } : {}),
    });

    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    console.error("List clients error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to list clients.",
    });
  }
}

export async function getClientController(
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
        message: "Invalid client id.",
      });
    }

    const client = await getClient(studioId, id);
    if (!client) {
      return res.status(404).json({
        status: "error",
        message: "Client not found.",
      });
    }

    return res.status(200).json({ status: "success", data: { client } });
  } catch (error) {
    console.error("Get client error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to get client.",
    });
  }
}

export async function createClientController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;

    const client = await createClient(studioId, req.body);
    return res.status(201).json({ status: "success", data: { client } });
  } catch (error) {
    if (error instanceof ClientServiceError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }
    console.error("Create client error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to create client.",
    });
  }
}

export async function updateClientController(
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
        message: "Invalid client id.",
      });
    }

    const client = await updateClient(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { client } });
  } catch (error) {
    if (error instanceof ClientServiceError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }
    console.error("Update client error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to update client.",
    });
  }
}

export async function deleteClientController(
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
        message: "Invalid client id.",
      });
    }

    const client = await softDeleteClient(studioId, id);
    return res.status(200).json({ status: "success", data: { client } });
  } catch (error) {
    if (error instanceof ClientServiceError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }
    console.error("Delete client error:", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to delete client.",
    });
  }
}
