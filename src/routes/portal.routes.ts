import { Router } from "express";
import { requireAuth, requireStudio } from "../auth/auth.middleware.js";
import { requirePermission } from "../auth/permission.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  issuePortalTokenSchema,
  portalCheckoutSchema,
} from "../schemas/money.schema.js";
import {
  createPortalCheckoutController,
  getPortalInvoicePdfController,
  getPublicPortalController,
  issuePortalTokenController,
} from "../controllers/portal.controller.js";

const router = Router();

/** Staff: issue a portal link for a job. */
router.post(
  "/tokens",
  requireAuth,
  requireStudio,
  requirePermission("jobs.update"),
  validateBody(issuePortalTokenSchema),
  issuePortalTokenController,
);

/** Public: no staff JWT. */
router.get("/:token", getPublicPortalController);
router.get(
  "/:token/invoices/:invoiceId/pdf",
  getPortalInvoicePdfController,
);
router.post(
  "/:token/checkout",
  validateBody(portalCheckoutSchema),
  createPortalCheckoutController,
);

export default router;
