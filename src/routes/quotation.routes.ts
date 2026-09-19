import { Router } from "express";
import { requireAuth, requireStudio } from "../auth/auth.middleware.js";
import { requirePermission } from "../auth/permission.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  createQuotationSchema,
  updateQuotationSchema,
} from "../schemas/quotation.schema.js";
import {
  createQuotationController,
  deleteQuotationController,
  getQuotationController,
  listQuotationsController,
  updateQuotationController,
} from "../controllers/quotation.controller.js";

const router = Router();

router.use(requireAuth, requireStudio);

router.get("/", requirePermission("quotations.view"), listQuotationsController);
router.get(
  "/:id",
  requirePermission("quotations.view"),
  getQuotationController,
);
router.post(
  "/",
  requirePermission("quotations.create"),
  validateBody(createQuotationSchema),
  createQuotationController,
);
router.patch(
  "/:id",
  requirePermission("quotations.update"),
  validateBody(updateQuotationSchema),
  updateQuotationController,
);
router.delete(
  "/:id",
  requirePermission("quotations.delete"),
  deleteQuotationController,
);

export default router;
