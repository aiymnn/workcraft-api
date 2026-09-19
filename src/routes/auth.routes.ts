import { Router } from "express";
import { authenticateUser, getCurrentUserProfile } from "../auth/auth.service.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../auth/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { loginSchema } from "../auth/auth.schema.js";

const router = Router();

router.post("/login", validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await authenticateUser(email, password);

    return res.status(200).json({
      status: "success",
      data: result,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Invalid email or password." ||
        error.message === "User account is inactive." ||
        error.message === "No studio membership for this account.")
    ) {
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
