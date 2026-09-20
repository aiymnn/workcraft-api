import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  MoneyServiceError,
  createDrawing,
  createExpense,
  createInvoice,
  createOtherIncome,
  createPayment,
  deleteDrawing,
  deleteExpense,
  deleteInvoice,
  deleteOtherIncome,
  deletePayment,
  getExpense,
  getInvoice,
  getPayment,
  listDrawings,
  listExpenses,
  listInvoices,
  listOtherIncome,
  listPayments,
  updateExpense,
  updateInvoice,
  updatePayment,
} from "../services/money.service.js";
import {
  buildInvoiceShareMessage,
  getInvoicePdf,
  sendInvoiceEmail,
} from "../services/invoice-share.service.js";
import { MailerError } from "../lib/mailer.js";
import {
  invoiceStatuses,
  paymentStatuses,
  taxBuckets,
} from "../schemas/money.schema.js";

function requireStudioId(req: AuthenticatedRequest, res: Response): number | null {
  if (!req.studioId) {
    res.status(403).json({
      status: "error",
      message: "No studio membership for this account.",
    });
    return null;
  }
  return req.studioId;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function parseId(value: unknown): number | null {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) return null;
  return id;
}

function handleError(error: unknown, res: Response, fallback: string) {
  if (error instanceof MoneyServiceError || error instanceof MailerError) {
    return res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
  }
  console.error(fallback, error);
  return res.status(500).json({ status: "error", message: fallback });
}

/* Invoices */

export async function listInvoicesController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
    const status =
      statusRaw && (invoiceStatuses as readonly string[]).includes(statusRaw)
        ? (statusRaw as (typeof invoiceStatuses)[number])
        : undefined;
    if (statusRaw && !status) {
      return res.status(400).json({ status: "error", message: "Invalid invoice status." });
    }
    const jobIdRaw = typeof req.query.jobId === "string" ? Number(req.query.jobId) : undefined;
    const result = await listInvoices({
      studioId,
      page: parsePositiveInt(req.query.page, 1),
      pageSize: parsePositiveInt(req.query.pageSize, 20),
      ...(status !== undefined ? { status } : {}),
      ...(jobIdRaw && Number.isInteger(jobIdRaw) ? { jobId: jobIdRaw } : {}),
    });
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to list invoices.");
  }
}

export async function getInvoiceController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid invoice id." });
    }
    const invoice = await getInvoice(studioId, id);
    if (!invoice) {
      return res.status(404).json({ status: "error", message: "Invoice not found." });
    }
    return res.status(200).json({ status: "success", data: { invoice } });
  } catch (error) {
    return handleError(error, res, "Unable to get invoice.");
  }
}

export async function createInvoiceController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const invoice = await createInvoice(studioId, req.body);
    return res.status(201).json({ status: "success", data: { invoice } });
  } catch (error) {
    return handleError(error, res, "Unable to create invoice.");
  }
}

export async function updateInvoiceController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid invoice id." });
    }
    const invoice = await updateInvoice(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { invoice } });
  } catch (error) {
    return handleError(error, res, "Unable to update invoice.");
  }
}

export async function deleteInvoiceController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid invoice id." });
    }
    const result = await deleteInvoice(studioId, id);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to delete invoice.");
  }
}

export async function shareInvoiceMessageController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid invoice id." });
    }
    const result = await buildInvoiceShareMessage(studioId, id, {
      ...(req.body?.markSent !== undefined ? { markSent: req.body.markSent } : {}),
      ...(req.body?.channel !== undefined ? { channel: req.body.channel } : {}),
    });
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to build the share message.");
  }
}

export async function sendInvoiceEmailController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid invoice id." });
    }
    const result = await sendInvoiceEmail(studioId, id, {
      ...(req.body?.to !== undefined ? { to: req.body.to } : {}),
      ...(req.body?.attachPdf !== undefined
        ? { attachPdf: req.body.attachPdf }
        : {}),
      ...(req.body?.markSent !== undefined ? { markSent: req.body.markSent } : {}),
    });
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to send the invoice email.");
  }
}

export async function getInvoicePdfController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid invoice id." });
    }
    const pdf = await getInvoicePdf(studioId, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${pdf.filename}"`,
    );
    return res.status(200).send(pdf.buffer);
  } catch (error) {
    return handleError(error, res, "Unable to build the invoice PDF.");
  }
}

/* Payments */

export async function listPaymentsController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;
    const status =
      statusRaw && (paymentStatuses as readonly string[]).includes(statusRaw)
        ? (statusRaw as (typeof paymentStatuses)[number])
        : undefined;
    if (statusRaw && !status) {
      return res.status(400).json({ status: "error", message: "Invalid payment status." });
    }
    const jobIdRaw = typeof req.query.jobId === "string" ? Number(req.query.jobId) : undefined;
    const result = await listPayments({
      studioId,
      page: parsePositiveInt(req.query.page, 1),
      pageSize: parsePositiveInt(req.query.pageSize, 20),
      ...(status !== undefined ? { status } : {}),
      ...(jobIdRaw && Number.isInteger(jobIdRaw) ? { jobId: jobIdRaw } : {}),
    });
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to list payments.");
  }
}

export async function getPaymentController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid payment id." });
    }
    const payment = await getPayment(studioId, id);
    if (!payment) {
      return res.status(404).json({ status: "error", message: "Payment not found." });
    }
    return res.status(200).json({ status: "success", data: { payment } });
  } catch (error) {
    return handleError(error, res, "Unable to get payment.");
  }
}

export async function createPaymentController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const payment = await createPayment(studioId, req.body);
    return res.status(201).json({ status: "success", data: { payment } });
  } catch (error) {
    return handleError(error, res, "Unable to create payment.");
  }
}

export async function updatePaymentController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid payment id." });
    }
    const payment = await updatePayment(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { payment } });
  } catch (error) {
    return handleError(error, res, "Unable to update payment.");
  }
}

export async function deletePaymentController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid payment id." });
    }
    const result = await deletePayment(studioId, id);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to delete payment.");
  }
}

/* Expenses */

export async function listExpensesController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const bucketRaw =
      typeof req.query.taxBucket === "string" ? req.query.taxBucket : undefined;
    const taxBucket =
      bucketRaw && (taxBuckets as readonly string[]).includes(bucketRaw)
        ? (bucketRaw as (typeof taxBuckets)[number])
        : undefined;
    if (bucketRaw && !taxBucket) {
      return res.status(400).json({ status: "error", message: "Invalid tax bucket." });
    }
    const jobIdRaw = typeof req.query.jobId === "string" ? Number(req.query.jobId) : undefined;
    const result = await listExpenses({
      studioId,
      page: parsePositiveInt(req.query.page, 1),
      pageSize: parsePositiveInt(req.query.pageSize, 20),
      ...(taxBucket !== undefined ? { taxBucket } : {}),
      ...(jobIdRaw && Number.isInteger(jobIdRaw) ? { jobId: jobIdRaw } : {}),
    });
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to list expenses.");
  }
}

export async function getExpenseController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid expense id." });
    }
    const expense = await getExpense(studioId, id);
    if (!expense) {
      return res.status(404).json({ status: "error", message: "Expense not found." });
    }
    return res.status(200).json({ status: "success", data: { expense } });
  } catch (error) {
    return handleError(error, res, "Unable to get expense.");
  }
}

export async function createExpenseController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const expense = await createExpense(studioId, req.body);
    return res.status(201).json({ status: "success", data: { expense } });
  } catch (error) {
    return handleError(error, res, "Unable to create expense.");
  }
}

export async function updateExpenseController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid expense id." });
    }
    const expense = await updateExpense(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { expense } });
  } catch (error) {
    return handleError(error, res, "Unable to update expense.");
  }
}

export async function deleteExpenseController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid expense id." });
    }
    const result = await deleteExpense(studioId, id);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to delete expense.");
  }
}

/* Drawings / other income */

export async function listDrawingsController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const drawings = await listDrawings(studioId);
    return res.status(200).json({ status: "success", data: { drawings } });
  } catch (error) {
    return handleError(error, res, "Unable to list drawings.");
  }
}

export async function createDrawingController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const drawing = await createDrawing(studioId, req.body);
    return res.status(201).json({ status: "success", data: { drawing } });
  } catch (error) {
    return handleError(error, res, "Unable to create drawing.");
  }
}

export async function deleteDrawingController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid drawing id." });
    }
    const result = await deleteDrawing(studioId, id);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to delete drawing.");
  }
}

export async function listOtherIncomeController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const items = await listOtherIncome(studioId);
    return res.status(200).json({ status: "success", data: { otherIncome: items } });
  } catch (error) {
    return handleError(error, res, "Unable to list other income.");
  }
}

export async function createOtherIncomeController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const item = await createOtherIncome(studioId, req.body);
    return res.status(201).json({ status: "success", data: { otherIncome: item } });
  } catch (error) {
    return handleError(error, res, "Unable to create other income.");
  }
}

export async function deleteOtherIncomeController(req: AuthenticatedRequest, res: Response) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ status: "error", message: "Invalid other income id." });
    }
    const result = await deleteOtherIncome(studioId, id);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to delete other income.");
  }
}
