import { Router } from "express";
import { eq } from "drizzle-orm";
import { authenticateUser } from "../auth/auth.service.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../auth/auth.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import { loginSchema } from "../auth/auth.schema.js";
import { db } from "../db/database.js";
import { users } from "../db/schema/users.js";

const router = Router();

router.post(
  "/login",
  validateBody(loginSchema),
  async (req, res) => {
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
          error.message === "User account is inactive.")
      ) {
        return res.status(401).json({
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
  },
);

router.get(
  "/me",
  requireAuth,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.userId) {
        return res.status(401).json({
          status: "error",
          message: "Authentication required.",
        });
      }

      const result = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          status: users.status,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, req.userId))
        .limit(1);

      const user = result[0];

      if (!user) {
        return res.status(404).json({
          status: "error",
          message: "User not found.",
        });
      }

      return res.status(200).json({
        status: "success",
        data: {
          user,
        },
      });
    } catch (error) {
      console.error("Get current user error:", error);

      return res.status(500).json({
        status: "error",
        message: "Unable to get current user.",
      });
    }
  },
);

export default router;
