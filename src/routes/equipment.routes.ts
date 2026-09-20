import { Router } from "express";
import { requireAuth, requireStudio } from "../auth/auth.middleware.js";
import { requirePermission } from "../auth/permission.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  createEquipmentSchema,
  updateEquipmentSchema,
} from "../schemas/equipment.schema.js";
import {
  createEquipmentController,
  deleteEquipmentController,
  getEquipmentController,
  listEquipmentController,
  updateEquipmentController,
} from "../controllers/equipment.controller.js";

const router = Router();

router.use(requireAuth, requireStudio);

router.get("/", requirePermission("equipment.view"), listEquipmentController);
router.get("/:id", requirePermission("equipment.view"), getEquipmentController);
router.post(
  "/",
  requirePermission("equipment.create"),
  validateBody(createEquipmentSchema),
  createEquipmentController,
);
router.patch(
  "/:id",
  requirePermission("equipment.update"),
  validateBody(updateEquipmentSchema),
  updateEquipmentController,
);
router.delete(
  "/:id",
  requirePermission("equipment.delete"),
  deleteEquipmentController,
);

export default router;
