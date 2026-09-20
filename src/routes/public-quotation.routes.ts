import { Router } from "express";
import { validateBody } from "../middleware/validation.middleware.js";
import { acceptPublicQuotationSchema } from "../schemas/public-quotation.schema.js";
import {
  acceptPublicQuotationController,
  getPublicQuotationController,
  getPublicQuotationPdfController,
} from "../controllers/public-quotation.controller.js";

/** Client-facing quote page — no staff JWT; the booking-link token is the key. */
const router = Router();

router.get("/:token", getPublicQuotationController);
router.get("/:token/pdf", getPublicQuotationPdfController);
router.post(
  "/:token/accept",
  validateBody(acceptPublicQuotationSchema),
  acceptPublicQuotationController,
);

export default router;
