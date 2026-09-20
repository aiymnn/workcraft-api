import type { Response, Request } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import { ChipApiError } from "../lib/chip.js";
import { createPortalCheckout } from "../services/chip.service.js";
import { MoneyServiceError } from "../services/money.service.js";
import {
  getPublicPortal,
  issuePortalToken,
} from "../services/portal.service.js";
import { getPortalInvoicePdf } from "../services/invoice-share.service.js";

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

export async function issuePortalTokenController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const result = await issuePortalToken(
      studioId,
      req.body.jobId,
      req.body.expiresAt,
    );
    return res.status(201).json({ status: "success", data: result });
  } catch (error) {
    if (error instanceof MoneyServiceError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }
    console.error("Unable to issue portal token.", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to issue portal token.",
    });
  }
}

export async function getPublicPortalController(req: Request, res: Response) {
  try {
    const token = String(req.params.token ?? "");
    const data = await getPublicPortal(token);
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    if (error instanceof MoneyServiceError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }
    console.error("Unable to load portal.", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to load portal.",
    });
  }
}

export async function createPortalCheckoutController(
  req: Request,
  res: Response,
) {
  try {
    const token = String(req.params.token ?? "");
    const result = await createPortalCheckout(token, {
      invoiceId: req.body.invoiceId,
      milestoneId: req.body.milestoneId ?? null,
    });
    return res.status(201).json({ status: "success", data: result });
  } catch (error) {
    if (error instanceof MoneyServiceError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }
    if (error instanceof ChipApiError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }
    console.error("Unable to start online payment.", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to start online payment.",
    });
  }
}

export async function getPortalInvoicePdfController(
  req: Request,
  res: Response,
) {
  try {
    const token = String(req.params.token ?? "");
    const invoiceId = Number(req.params.invoiceId);
    if (!Number.isInteger(invoiceId) || invoiceId < 1) {
      return res.status(400).json({
        status: "error",
        message: "Invalid invoice id.",
      });
    }

    const pdf = await getPortalInvoicePdf(token, invoiceId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${pdf.filename}"`,
    );
    return res.status(200).send(pdf.buffer);
  } catch (error) {
    if (error instanceof MoneyServiceError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }
    console.error("Unable to build the invoice PDF.", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to build the invoice PDF.",
    });
  }
}
