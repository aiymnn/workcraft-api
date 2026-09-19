import { Router } from "express";
import { requireAuth, requireStudio } from "../auth/auth.middleware.js";
import { requirePermission } from "../auth/permission.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  createSavedCalcSchema,
  updateSavedCalcSchema,
  upsertOpexSchema,
  upsertTargetsSchema,
} from "../schemas/pricing.schema.js";
import {
  createSavedCalcController,
  deleteSavedCalcController,
  getPricingHubController,
  getSavedCalcController,
  listSavedCalcsController,
  putOpexController,
  putTargetsController,
  updateSavedCalcController,
} from "../controllers/pricing.controller.js";

const router = Router();

router.use(requireAuth, requireStudio);

router.get("/", requirePermission("pricing.view"), getPricingHubController);
router.put(
  "/opex",
  requirePermission("pricing.manage"),
  validateBody(upsertOpexSchema),
  putOpexController,
);
router.put(
  "/targets",
  requirePermission("pricing.manage"),
  validateBody(upsertTargetsSchema),
  putTargetsController,
);

router.get("/calcs", requirePermission("pricing.view"), listSavedCalcsController);
router.get(
  "/calcs/:id",
  requirePermission("pricing.view"),
  getSavedCalcController,
);
router.post(
  "/calcs",
  requirePermission("pricing.manage"),
  validateBody(createSavedCalcSchema),
  createSavedCalcController,
);
router.patch(
  "/calcs/:id",
  requirePermission("pricing.manage"),
  validateBody(updateSavedCalcSchema),
  updateSavedCalcController,
);
router.delete(
  "/calcs/:id",
  requirePermission("pricing.manage"),
  deleteSavedCalcController,
);

export default router;
