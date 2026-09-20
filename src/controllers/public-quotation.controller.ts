import type { Request, Response } from "express";
import { QuotationServiceError } from "../services/quotation.service.js";
import {
  acceptPublicQuotation,
  getPublicQuotation,
} from "../services/public-quotation.service.js";
import { getPublicQuotationPdf } from "../services/quotation-share.service.js";

function handleError(error: unknown, res: Response, fallback: string) {
  if (error instanceof QuotationServiceError) {
    return res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
  }
  console.error(fallback, error);
  return res.status(500).json({ status: "error", message: fallback });
}

export async function getPublicQuotationController(
  req: Request,
  res: Response,
) {
  try {
    const token = String(req.params.token ?? "");
    const data = await getPublicQuotation(token);
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return handleError(error, res, "Unable to load quotation.");
  }
}

export async function getPublicQuotationPdfController(
  req: Request,
  res: Response,
) {
  try {
    const token = String(req.params.token ?? "");
    const pdf = await getPublicQuotationPdf(token);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${pdf.filename}"`,
    );
    return res.status(200).send(pdf.buffer);
  } catch (error) {
    return handleError(error, res, "Unable to build the quotation PDF.");
  }
}

export async function acceptPublicQuotationController(
  req: Request,
  res: Response,
) {
  try {
    const token = String(req.params.token ?? "");
    const data = await acceptPublicQuotation(token, req.body);
    return res.status(200).json({ status: "success", data });
  } catch (error) {
    return handleError(error, res, "Unable to accept quotation.");
  }
}
