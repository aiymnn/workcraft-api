import { Router } from "express";
import { requireAuth, requireStudio } from "../auth/auth.middleware.js";
import { requirePermission } from "../auth/permission.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  createClientSchema,
  updateClientSchema,
} from "../schemas/client.schema.js";
import {
  createClientController,
  deleteClientController,
  getClientController,
  listClientsController,
  updateClientController,
} from "../controllers/client.controller.js";

const router = Router();

router.use(requireAuth, requireStudio);

router.get("/", requirePermission("clients.view"), listClientsController);
router.get("/:id", requirePermission("clients.view"), getClientController);
router.post(
  "/",
  requirePermission("clients.create"),
  validateBody(createClientSchema),
  createClientController,
);
router.patch(
  "/:id",
  requirePermission("clients.update"),
  validateBody(updateClientSchema),
  updateClientController,
);
router.delete(
  "/:id",
  requirePermission("clients.delete"),
  deleteClientController,
);

export default router;
