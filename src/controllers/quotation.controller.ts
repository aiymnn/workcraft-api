import type { Response } from "express";
import type { AuthenticatedRequest } from "../auth/auth.middleware.js";
import {
  QuotationServiceError,
  convertQuotationToJob,
  createQuotation,
  deleteQuotation,
  getQuotation,
  issueQuotationBookingLink,
  listQuotations,
  updateQuotation,
} from "../services/quotation.service.js";
import {
  buildQuotationShareMessage,
  getQuotationPdf,
  sendQuotationEmail,
} from "../services/quotation-share.service.js";
import { MailerError } from "../lib/mailer.js";
import { quotationStatuses } from "../schemas/quotation.schema.js";

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
  if (error instanceof QuotationServiceError || error instanceof MailerError) {
    return res.status(error.statusCode).json({
      status: "error",
      message: error.message,
    });
  }
  console.error(fallback, error);
  return res.status(500).json({ status: "error", message: fallback });
}

export async function listQuotationsController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;

    const statusRaw =
      typeof req.query.status === "string" ? req.query.status : undefined;
    const status =
      statusRaw &&
      (quotationStatuses as readonly string[]).includes(statusRaw)
        ? (statusRaw as (typeof quotationStatuses)[number])
        : undefined;

    if (statusRaw && !status) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quotation status filter.",
      });
    }

    const search =
      typeof req.query.search === "string" && req.query.search.trim()
        ? req.query.search.trim()
        : undefined;

    const jobIdRaw =
      typeof req.query.jobId === "string" ? req.query.jobId : undefined;
    let jobId: number | undefined;
    if (jobIdRaw !== undefined && jobIdRaw.trim() !== "") {
      const parsed = Number(jobIdRaw);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return res.status(400).json({
          status: "error",
          message: "Invalid jobId filter.",
        });
      }
      jobId = parsed;
    }

    const clientIdRaw =
      typeof req.query.clientId === "string" ? req.query.clientId : undefined;
    let clientId: number | undefined;
    if (clientIdRaw !== undefined && clientIdRaw.trim() !== "") {
      const parsed = Number(clientIdRaw);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return res.status(400).json({
          status: "error",
          message: "Invalid clientId filter.",
        });
      }
      clientId = parsed;
    }

    const result = await listQuotations({
      studioId,
      page: parsePositiveInt(req.query.page, 1),
      pageSize: parsePositiveInt(req.query.pageSize, 20),
      ...(status !== undefined ? { status } : {}),
      ...(search !== undefined ? { search } : {}),
      ...(jobId !== undefined ? { jobId } : {}),
      ...(clientId !== undefined ? { clientId } : {}),
    });

    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to list quotations.");
  }
}

export async function getQuotationController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quotation id.",
      });
    }

    const quotation = await getQuotation(studioId, id);
    if (!quotation) {
      return res.status(404).json({
        status: "error",
        message: "Quotation not found.",
      });
    }

    return res.status(200).json({ status: "success", data: { quotation } });
  } catch (error) {
    return handleError(error, res, "Unable to get quotation.");
  }
}

export async function createQuotationController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const quotation = await createQuotation(studioId, req.body);
    return res.status(201).json({ status: "success", data: { quotation } });
  } catch (error) {
    return handleError(error, res, "Unable to create quotation.");
  }
}

export async function updateQuotationController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quotation id.",
      });
    }
    const quotation = await updateQuotation(studioId, id, req.body);
    return res.status(200).json({ status: "success", data: { quotation } });
  } catch (error) {
    return handleError(error, res, "Unable to update quotation.");
  }
}

export async function deleteQuotationController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quotation id.",
      });
    }
    const result = await deleteQuotation(studioId, id);
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to delete quotation.");
  }
}

export async function issueQuotationBookingLinkController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quotation id.",
      });
    }

    const result = await issueQuotationBookingLink(studioId, id, {
      ...(req.body?.rotate !== undefined ? { rotate: req.body.rotate } : {}),
    });
    return res.status(201).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to issue booking link.");
  }
}

export async function shareQuotationMessageController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quotation id.",
      });
    }

    const result = await buildQuotationShareMessage(studioId, id, {
      ...(req.body?.markSent !== undefined
        ? { markSent: req.body.markSent }
        : {}),
      ...(req.body?.channel !== undefined ? { channel: req.body.channel } : {}),
    });
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to build the share message.");
  }
}

export async function sendQuotationEmailController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quotation id.",
      });
    }

    const result = await sendQuotationEmail(studioId, id, {
      ...(req.body?.to !== undefined ? { to: req.body.to } : {}),
      ...(req.body?.attachPdf !== undefined
        ? { attachPdf: req.body.attachPdf }
        : {}),
      ...(req.body?.markSent !== undefined
        ? { markSent: req.body.markSent }
        : {}),
    });
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    return handleError(error, res, "Unable to send the quotation email.");
  }
}

export async function getQuotationPdfController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quotation id.",
      });
    }

    const pdf = await getQuotationPdf(studioId, id);
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

export async function convertQuotationController(
  req: AuthenticatedRequest,
  res: Response,
) {
  try {
    const studioId = requireStudioId(req, res);
    if (studioId === null) return;
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({
        status: "error",
        message: "Invalid quotation id.",
      });
    }

    const { created, ...data } = await convertQuotationToJob(studioId, id, {
      ...(req.body?.sessionOverrides !== undefined
        ? { sessionOverrides: req.body.sessionOverrides }
        : {}),
    });
    return res.status(created ? 201 : 200).json({ status: "success", data });
  } catch (error) {
    return handleError(error, res, "Unable to convert quotation to job.");
  }
}
