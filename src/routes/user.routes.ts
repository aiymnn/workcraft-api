import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware.js";
import { requirePermission } from "../auth/permission.middleware.js";
import {
  createUserController,
  deleteUserController,
  listUsersController,
  updateUserController,
} from "../controllers/user.controller.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  requirePermission("users.view"),
  listUsersController,
);

router.post(
  "/",
  requireAuth,
  requirePermission("users.create"),
  createUserController,
);

router.patch(
  "/:id",
  requireAuth,
  requirePermission("users.update"),
  updateUserController,
);

router.delete(
  "/:id",
  requireAuth,
  requirePermission("users.delete"),
  deleteUserController,
);

export default router;
