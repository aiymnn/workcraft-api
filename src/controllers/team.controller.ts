import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  TeamServiceError,
  createCrewContact,
  createTeamMember,
  getCrewContact,
  getTeamMember,
  listCrewContacts,
  listTeamMembers,
  removeTeamMember,
  softDeleteCrewContact,
  updateCrewContact,
  updateTeamMember,
} from "../services/team.service.js";

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

function handleTeamError(error: unknown, res: Response, fallback: string) {
  if (error instanceof TeamServiceError) {
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

export async function listMembersController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const members = await listTeamMembers(studioId);
    return res.status(200).json({ status: "success", data: { members } });
  } catch (error) {
    return handleTeamError(error, res, "Unable to list team members.");
  }
}

export async function getMemberController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid member id." });
    }
    const member = await getTeamMember(studioId, id);
    if (!member) {
      return res.status(404).json({ status: "error", message: "Team member not found." });
    }
    return res.status(200).json({ status: "success", data: { member } });
  } catch (error) {
    return handleTeamError(error, res, "Unable to get team member.");
  }
}

export async function createMemberController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const member = await createTeamMember(studioId, req.body);
    return res.status(201).json({ status: "success", data: { member } });
  } catch (error) {
    return handleTeamError(error, res, "Unable to create team member.");
  }
}

export async function updateMemberController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid member id." });
    }
    const member = await updateTeamMember(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { member } });
  } catch (error) {
    return handleTeamError(error, res, "Unable to update team member.");
  }
}

export async function deleteMemberController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid member id." });
    }
    const result = await removeTeamMember(studioId, id);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleTeamError(error, res, "Unable to remove team member.");
  }
}

export async function listCrewController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const includeRetired = req.query.includeRetired === "true";
    const crew = await listCrewContacts(studioId, includeRetired);
    return res.status(200).json({ status: "success", data: { crew } });
  } catch (error) {
    return handleTeamError(error, res, "Unable to list crew contacts.");
  }
}

export async function getCrewController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid crew id." });
    }
    const contact = await getCrewContact(studioId, id);
    if (!contact) {
      return res.status(404).json({ status: "error", message: "Crew contact not found." });
    }
    return res.status(200).json({ status: "success", data: { crew: contact } });
  } catch (error) {
    return handleTeamError(error, res, "Unable to get crew contact.");
  }
}

export async function createCrewController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const contact = await createCrewContact(studioId, req.body);
    return res.status(201).json({ status: "success", data: { crew: contact } });
  } catch (error) {
    return handleTeamError(error, res, "Unable to create crew contact.");
  }
}

export async function updateCrewController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid crew id." });
    }
    const contact = await updateCrewContact(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { crew: contact } });
  } catch (error) {
    return handleTeamError(error, res, "Unable to update crew contact.");
  }
}

export async function deleteCrewController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid crew id." });
    }
    const contact = await softDeleteCrewContact(studioId, id);
    return res.status(200).json({ status: "success", data: { crew: contact } });
  } catch (error) {
    return handleTeamError(error, res, "Unable to retire crew contact.");
  }
}
