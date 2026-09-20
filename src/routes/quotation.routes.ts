import { Router } from "express";
import { requireAuth, requireStudio } from "../auth/auth.middleware.js";
import { requirePermission } from "../auth/permission.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  bookingLinkSchema,
  convertQuotationSchema,
  createQuotationSchema,
  quotationSendEmailSchema,
  quotationShareMessageSchema,
  updateQuotationSchema,
} from "../schemas/quotation.schema.js";
import {
  convertQuotationController,
  createQuotationController,
  deleteQuotationController,
  getQuotationController,
  getQuotationPdfController,
  issueQuotationBookingLinkController,
  listQuotationsController,
  sendQuotationEmailController,
  shareQuotationMessageController,
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

/** Public booking link for the client-facing quote page. */
router.post(
  "/:id/booking-link",
  requirePermission("quotations.update"),
  validateBody(bookingLinkSchema),
  issueQuotationBookingLinkController,
);

/** Share / send / download the quote a client sees. */
router.post(
  "/:id/share-message",
  requirePermission("quotations.update"),
  validateBody(quotationShareMessageSchema),
  shareQuotationMessageController,
);
router.post(
  "/:id/send-email",
  requirePermission("quotations.update"),
  validateBody(quotationSendEmailSchema),
  sendQuotationEmailController,
);
router.get(
  "/:id/pdf",
  requirePermission("quotations.view"),
  getQuotationPdfController,
);

/** Convert needs both: it writes a job and accepts the quote. */
router.post(
  "/:id/convert",
  requirePermission("jobs.create"),
  requirePermission("quotations.update"),
  validateBody(convertQuotationSchema),
  convertQuotationController,
);

export default router;
