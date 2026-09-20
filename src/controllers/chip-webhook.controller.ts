import type { Request, Response } from "express";
import { handleChipWebhook } from "../services/chip.service.js";
import { MoneyServiceError } from "../services/money.service.js";

function signatureHeader(req: Request) {
  const header =
    req.headers["x-signature"] ??
    req.headers["x-chip-signature"] ??
    req.headers["x-webhook-secret"];
  return Array.isArray(header) ? header[0] : header;
}

export async function chipWebhookController(req: Request, res: Response) {
  try {
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body ?? {}));

    const result = await handleChipWebhook(rawBody, signatureHeader(req));
    return res.status(200).json({ status: "success", data: result });
  } catch (error) {
    if (error instanceof MoneyServiceError) {
      return res.status(error.statusCode).json({
        status: "error",
        message: error.message,
      });
    }
    console.error("Unable to process CHIP webhook.", error);
    return res.status(500).json({
      status: "error",
      message: "Unable to process CHIP webhook.",
    });
  }
}
