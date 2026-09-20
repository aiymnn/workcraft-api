import type { Request, Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import { env } from "../config/env.js";
import {
  GoogleOauthError,
  isGoogleConfigured,
} from "../lib/google-oauth.js";
import { MailerError } from "../lib/mailer.js";
import {
  AccountServiceError,
  changeAccountPassword,
  completeGoogleOauth,
  confirm2fa,
  confirmEmailChange,
  disable2fa,
  disconnectGoogle,
  enroll2fa,
  getAccountProfile,
  requestEmailChange,
  revokeAllSessions,
  setFootagePortal,
  startGoogleOauth,
  syncGoogle,
  updateAccountProfile,
} from "../services/account.service.js";
import { googleOauthPurposeSchema } from "../schemas/account.schema.js";

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
  if (error instanceof GoogleOauthError || error instanceof MailerError) {
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
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = requireUserId(req, res);
    if (userId === null) return;
    const result = await requestEmailChange(
      userId,
      req.body.newEmail,
      req.body.password,
    );
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleAccountError(error, res, "Unable to request an email change.");
  }
}

/** Public — reached from the confirmation link, which carries no JWT. */
export async function confirmEmailChangeController(req: Request, res: Response) {
  try {
    const result = await confirmEmailChange(req.body.token);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleAccountError(error, res, "Unable to confirm this email change.");
  }
}

export async function enroll2faController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = requireUserId(req, res);
    if (userId === null) return;
    const result = await enroll2fa(userId);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleAccountError(error, res, "Unable to start 2FA enrollment.");
  }
}

export async function confirm2faController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = requireUserId(req, res);
    if (userId === null) return;
    const result = await confirm2fa(userId, req.body.code);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleAccountError(error, res, "Unable to confirm 2FA.");
  }
}

export async function disable2faController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = requireUserId(req, res);
    if (userId === null) return;
    const result = await disable2fa(userId, req.body ?? {});
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleAccountError(error, res, "Unable to disable 2FA.");
  }
}

export async function revokeAllSessionsController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = requireUserId(req, res);
    if (userId === null) return;
    const result = await revokeAllSessions(userId);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleAccountError(error, res, "Unable to sign out everywhere.");
  }
}

export async function googleStartController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = requireUserId(req, res);
    if (userId === null) return;

    const purpose = googleOauthPurposeSchema.safeParse(req.query.purpose);
    if (!purpose.success) {
      return res.status(400).json({
        status: "error",
        message: "purpose must be calendar or drive.",
      });
    }

    const result = startGoogleOauth(userId, purpose.data);

    // `?redirect=1` sends the browser straight to Google; default returns JSON.
    if (req.query.redirect === "1") {
      return res.redirect(result.url);
    }
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleAccountError(error, res, "Unable to start Google sign-in.");
  }
}

/** Public — Google redirects the browser here without an Authorization header. */
export async function googleCallbackController(req: Request, res: Response) {
  const webOrigin = env.PUBLIC_WEB_ORIGIN.replace(/\/$/, "");

  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;

  if (!isGoogleConfigured()) {
    return res.status(503).json({
      status: "error",
      message: "Google is not configured on this server.",
    });
  }

  if (!code || !state) {
    return res.redirect(`${webOrigin}/app/account?google=error`);
  }

  try {
    const result = await completeGoogleOauth(code, state);
    return res.redirect(
      `${webOrigin}/app/account?google=connected&purpose=${result.purpose}`,
    );
  } catch (error) {
    console.error("Google callback failed.", error);
    return res.redirect(`${webOrigin}/app/account?google=error`);
  }
}

export async function googleDisconnectController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = requireUserId(req, res);
    if (userId === null) return;
    const result = await disconnectGoogle(userId, req.body.purpose);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleAccountError(error, res, "Unable to disconnect Google.");
  }
}

export async function googleSyncController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = requireUserId(req, res);
    if (userId === null) return;
    const result = await syncGoogle(userId, req.body.purpose);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleAccountError(error, res, "Unable to sync with Google.");
  }
}

export async function footagePortalController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const userId = requireUserId(req, res);
    if (userId === null) return;
    const result = await setFootagePortal(userId, req.body.enabled);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleAccountError(error, res, "Unable to update the footage portal.");
  }
}
