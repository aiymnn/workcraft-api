import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

/** CHIP Collect purchases. Everything here is env-gated — no bundled credentials. */
export function isChipConfigured(): boolean {
  return Boolean(
    env.CHIP_BRAND_ID?.trim() &&
      env.CHIP_API_KEY?.trim() &&
      env.CHIP_WEBHOOK_SECRET?.trim(),
  );
}

/** `wc:<studioId>:<invoiceId>:<milestoneId>` — milestone `0` means invoice-level. */
export function buildChipReference(
  studioId: number,
  invoiceId: number,
  milestoneId: number | null,
): string {
  return `wc:${studioId}:${invoiceId}:${milestoneId ?? 0}`;
}

export function parseChipReference(reference: string | null | undefined) {
  if (!reference) return null;
  const parts = reference.split(":");
  if (parts.length !== 4 || parts[0] !== "wc") return null;

  const studioId = Number(parts[1]);
  const invoiceId = Number(parts[2]);
  const milestoneId = Number(parts[3]);
  if (!Number.isInteger(studioId) || !Number.isInteger(invoiceId)) return null;

  return {
    studioId,
    invoiceId,
    milestoneId:
      Number.isInteger(milestoneId) && milestoneId > 0 ? milestoneId : null,
  };
}

export interface ChipPurchaseInput {
  reference: string;
  amount: number;
  currency: string;
  productName: string;
  clientEmail?: string | null;
  clientName?: string | null;
  successRedirect?: string;
  failureRedirect?: string;
}

export class ChipApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ChipApiError";
  }
}

/** Creates a CHIP purchase and returns its hosted checkout URL. */
export async function createChipPurchase(input: ChipPurchaseInput) {
  if (!isChipConfigured()) {
    throw new ChipApiError("Online payments are not configured.", 503);
  }

  const body = {
    brand_id: env.CHIP_BRAND_ID,
    reference: input.reference,
    success_redirect: input.successRedirect,
    failure_redirect: input.failureRedirect,
    client: {
      email: input.clientEmail?.trim() || "no-reply@example.com",
      full_name: input.clientName?.trim() || undefined,
    },
    purchase: {
      currency: input.currency,
      products: [
        {
          name: input.productName.slice(0, 256),
          // CHIP prices are in the smallest currency unit.
          price: Math.round(input.amount * 100),
          quantity: 1,
        },
      ],
    },
  };

  let response: Response;
  try {
    response = await fetch(`${env.CHIP_API_BASE.replace(/\/$/, "")}/purchases/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CHIP_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("CHIP purchase request failed.", error);
    throw new ChipApiError("Unable to reach the payment provider.", 503);
  }

  const text = await response.text();
  if (!response.ok) {
    console.error("CHIP purchase rejected.", response.status, text);
    throw new ChipApiError("The payment provider rejected this checkout.", 502);
  }

  let payload: { id?: string; checkout_url?: string };
  try {
    payload = JSON.parse(text);
  } catch {
    throw new ChipApiError("Unexpected payment provider response.", 502);
  }

  if (!payload.checkout_url) {
    throw new ChipApiError("Payment provider returned no checkout URL.", 502);
  }

  return { purchaseId: payload.id ?? null, checkoutUrl: payload.checkout_url };
}

function safeEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * CHIP signs callbacks with `X-Signature`. Without the provider public key we
 * accept an HMAC-SHA256 of the raw body, or the shared secret sent verbatim.
 */
export function verifyChipSignature(
  rawBody: Buffer,
  signature: string | undefined,
): boolean {
  const secret = env.CHIP_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  if (!signature) return false;

  const candidate = signature.trim();
  if (safeEquals(candidate, secret)) return true;

  const hmac = createHmac("sha256", secret).update(rawBody);
  const digest = hmac.digest();
  return (
    safeEquals(candidate, digest.toString("hex")) ||
    safeEquals(candidate, digest.toString("base64"))
  );
}
