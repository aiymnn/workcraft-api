import { Router } from "express";
import { requireAuth, requireStudio } from "../auth/auth.middleware.js";
import { requirePermission } from "../auth/permission.middleware.js";
import { validateBody } from "../middleware/validation.middleware.js";
import {
  createDrawingSchema,
  createExpenseSchema,
  createInvoiceSchema,
  createOtherIncomeSchema,
  createPaymentSchema,
  invoiceSendEmailSchema,
  invoiceShareMessageSchema,
  updateExpenseSchema,
  updateInvoiceSchema,
  updatePaymentSchema,
} from "../schemas/money.schema.js";
import {
  createDrawingController,
  createExpenseController,
  createInvoiceController,
  createOtherIncomeController,
  createPaymentController,
  deleteDrawingController,
  deleteExpenseController,
  deleteInvoiceController,
  deleteOtherIncomeController,
  deletePaymentController,
  getExpenseController,
  getInvoiceController,
  getInvoicePdfController,
  getPaymentController,
  listDrawingsController,
  listExpensesController,
  listInvoicesController,
  listOtherIncomeController,
  listPaymentsController,
  sendInvoiceEmailController,
  shareInvoiceMessageController,
  updateExpenseController,
  updateInvoiceController,
  updatePaymentController,
} from "../controllers/money.controller.js";

const router = Router();

router.use(requireAuth, requireStudio);

router.get("/invoices", requirePermission("money.view"), listInvoicesController);
router.get("/invoices/:id", requirePermission("money.view"), getInvoiceController);
router.post(
  "/invoices",
  requirePermission("money.create"),
  validateBody(createInvoiceSchema),
  createInvoiceController,
);
router.patch(
  "/invoices/:id",
  requirePermission("money.update"),
  validateBody(updateInvoiceSchema),
  updateInvoiceController,
);
router.delete(
  "/invoices/:id",
  requirePermission("money.delete"),
  deleteInvoiceController,
);

/** Share / send / download the invoice a client sees. */
router.post(
  "/invoices/:id/share-message",
  requirePermission("money.update"),
  validateBody(invoiceShareMessageSchema),
  shareInvoiceMessageController,
);
router.post(
  "/invoices/:id/send-email",
  requirePermission("money.update"),
  validateBody(invoiceSendEmailSchema),
  sendInvoiceEmailController,
);
router.get(
  "/invoices/:id/pdf",
  requirePermission("money.view"),
  getInvoicePdfController,
);

router.get("/payments", requirePermission("money.view"), listPaymentsController);
router.get("/payments/:id", requirePermission("money.view"), getPaymentController);
router.post(
  "/payments",
  requirePermission("money.create"),
  validateBody(createPaymentSchema),
  createPaymentController,
);
router.patch(
  "/payments/:id",
  requirePermission("money.update"),
  validateBody(updatePaymentSchema),
  updatePaymentController,
);
router.delete(
  "/payments/:id",
  requirePermission("money.delete"),
  deletePaymentController,
);

router.get("/expenses", requirePermission("money.view"), listExpensesController);
router.get("/expenses/:id", requirePermission("money.view"), getExpenseController);
router.post(
  "/expenses",
  requirePermission("money.create"),
  validateBody(createExpenseSchema),
  createExpenseController,
);
router.patch(
  "/expenses/:id",
  requirePermission("money.update"),
  validateBody(updateExpenseSchema),
  updateExpenseController,
);
router.delete(
  "/expenses/:id",
  requirePermission("money.delete"),
  deleteExpenseController,
);

router.get("/drawings", requirePermission("money.view"), listDrawingsController);
router.post(
  "/drawings",
  requirePermission("money.create"),
  validateBody(createDrawingSchema),
  createDrawingController,
);
router.delete(
  "/drawings/:id",
  requirePermission("money.delete"),
  deleteDrawingController,
);

router.get(
  "/other-income",
  requirePermission("money.view"),
  listOtherIncomeController,
);
router.post(
  "/other-income",
  requirePermission("money.create"),
  validateBody(createOtherIncomeSchema),
  createOtherIncomeController,
);
router.delete(
  "/other-income/:id",
  requirePermission("money.delete"),
  deleteOtherIncomeController,
);

export default router;
