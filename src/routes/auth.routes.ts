import { Router, type Request, type Response } from "express";
import {
  authenticateUser,
  completeTwoFactorLogin,
  getCurrentUserProfile,
} from "../auth/auth.service.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../auth/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { loginSchema, loginTwoFactorSchema } from "../auth/auth.schema.js";

const router = Router();

function loginContext(req: Request) {
  return {
    userAgent: req.headers["user-agent"] ?? null,
    ipAddress: req.ip ?? null,
  };
}

const AUTH_CLIENT_MESSAGES = new Set([
  "Invalid email or password.",
  "User account is inactive.",
  "No studio membership for this account.",
  "Two-factor session expired. Sign in again.",
  "Two-factor authentication is not enabled.",
  "That code is not valid. Try the next one.",
]);

function respondLoginError(error: unknown, res: Response) {
  if (error instanceof Error && AUTH_CLIENT_MESSAGES.has(error.message)) {
    const status =
      error.message === "No studio membership for this account." ? 403 : 401;
    return res.status(status).json({
      status: "error",
      message: error.message,
    });
  }

  console.error("Login error:", error);

  return res.status(500).json({
    status: "error",
    message: "Unable to process login.",
  });
}

router.post("/login", validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await authenticateUser(email, password, loginContext(req));

    return res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    return respondLoginError(error, res);
  }
});

router.post("/login/2fa", validateBody(loginTwoFactorSchema), async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    const result = await completeTwoFactorLogin(
      tempToken,
      code,
      loginContext(req),
    );

    return res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    return respondLoginError(error, res);
  }
});

router.get("/me", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required.",
      });
    }

    const profile = await getCurrentUserProfile(req.userId);

    if (!profile) {
      return res.status(404).json({
        status: "error",
        message: "User not found.",
      });
    }

    return res.status(200).json({
      status: "success",
      data: {
        user: profile.user,
        studio: profile.studio,
        access: profile.access ?? req.studioAccess ?? null,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return res.status(500).json({
      status: "error",
      message: "Unable to get current user.",
    });
  }
});

export default router;
