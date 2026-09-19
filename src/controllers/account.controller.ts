import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  AccountServiceError,
  changeAccountPassword,
  getAccountProfile,
  updateAccountProfile,
} from "../services/account.service.js";

function requireUserId(req: AuthenticatedRequest, res: Response): number | null {
  if (!req.userId) {
    res.status(401).json({
      status: "error",
      message: "Authentication required.",
    });
    return null;
  }
  return req.userId;
}

function handleAccountError(error: unknown, res: Response, fallback: string) {
  if (error instanceof AccountServiceError) {
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

export async function getProfileController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = requireUserId(req, res);
    if (userId === null) return;
    const profile = await getAccountProfile(userId);
    if (!profile) {
      return res.status(404).json({ status: "error", message: "User not found." });
    }
    return res.status(200).json({ status: "success", data: profile });
  } catch (error) {
    return handleAccountError(error, res, "Unable to get account profile.");
  }
}

export async function patchProfileController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = requireUserId(req, res);
    if (userId === null) return;
    const profile = await updateAccountProfile(userId, req.body);
    return res.status(200).json({ status: "success", data: profile });
  } catch (error) {
    return handleAccountError(error, res, "Unable to update account profile.");
  }
}

export async function changePasswordController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = requireUserId(req, res);
    if (userId === null) return;
    const result = await changeAccountPassword(
      userId,
      req.body.currentPassword,
      req.body.newPassword,
    );
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleAccountError(error, res, "Unable to change password.");
  }
}

export async function changeEmailController(
  _req: AuthenticatedRequest,
  res: Response,
) {
  return res.status(501).json({
    status: "error",
    message: "Email change with confirmation is not available yet.",
  });
}

export async function enroll2faController(
  _req: AuthenticatedRequest,
  res: Response,
) {
  return res.status(501).json({
    status: "error",
    message: "Two-factor enrollment is not available yet.",
  });
}

export async function disable2faController(
  _req: AuthenticatedRequest,
  res: Response,
) {
  return res.status(501).json({
    status: "error",
    message: "Two-factor disable is not available yet.",
  });
}
