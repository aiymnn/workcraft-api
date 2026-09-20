import { and, eq, inArray } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/database.js";
import { chipWebhookEvents } from "../db/schema/chip_webhook_events.js";
import { clients } from "../db/schema/clients.js";
import { jobs } from "../db/schema/jobs.js";
import { invoiceMilestones, invoices, payments } from "../db/schema/money.js";
import { studios } from "../db/schema/studios.js";
import {
  buildChipReference,
  createChipPurchase,
  isChipConfigured,
  parseChipReference,
  verifyChipSignature,
} from "../lib/chip.js";
import { MoneyServiceError } from "./money.service.js";
import { resolvePortalToken } from "./portal.service.js";

function toAmount(value: string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

/** Creates a hosted CHIP checkout for an invoice (or a single milestone). */
export async function createPortalCheckout(
  token: string,
  input: { invoiceId: number; milestoneId?: number | null },
) {
  const portal = await resolvePortalToken(token);

  const studioRows = await db
    .select({
      name: studios.name,
      currency: studios.currency,
      chipEnabled: studios.chipEnabled,
    })
    .from(studios)
    .where(eq(studios.id, portal.studioId))
    .limit(1);
  const studio = studioRows[0];
  if (!studio) throw new MoneyServiceError("Studio not found.", 404);

  if (!studio.chipEnabled) {
    throw new MoneyServiceError("Online payment is not available yet.", 503);
  }
  if (!isChipConfigured()) {
    throw new MoneyServiceError("Online payment is not available yet.", 503);
  }

  const invoiceRows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      jobId: invoices.jobId,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.id, input.invoiceId),
        eq(invoices.studioId, portal.studioId),
        eq(invoices.jobId, portal.jobId),
      ),
    )
    .limit(1);
  const invoice = invoiceRows[0];
  if (!invoice) throw new MoneyServiceError("Invoice not found.", 404);

  const milestones = await db
    .select()
    .from(invoiceMilestones)
    .where(eq(invoiceMilestones.invoiceId, invoice.id));

  const selected = input.milestoneId
    ? milestones.filter((m) => m.id === input.milestoneId)
    : milestones;
  if (input.milestoneId && selected.length === 0) {
    throw new MoneyServiceError("Milestone not found on this invoice.", 404);
  }

  const milestoneIds = selected.map((m) => m.id);
  const paymentRows =
    milestoneIds.length === 0
      ? []
      : await db
          .select()
          .from(payments)
          .where(inArray(payments.milestoneId, milestoneIds));

  const paidMilestoneIds = new Set(
    paymentRows.filter((p) => p.status === "PAID").map((p) => p.milestoneId),
  );
  const outstanding = selected.filter((m) => !paidMilestoneIds.has(m.id));
  const amount = outstanding.reduce((sum, m) => sum + toAmount(m.amount), 0);

  if (amount <= 0) {
    throw new MoneyServiceError("This invoice has nothing left to pay.", 409);
  }

  const clientRows = await db
    .select({ name: clients.name, email: clients.email })
    .from(clients)
    .innerJoin(jobs, eq(jobs.clientId, clients.id))
    .where(eq(jobs.id, portal.jobId))
    .limit(1);

  const portalUrl = `${env.PUBLIC_WEB_ORIGIN.replace(/\/$/, "")}/portal/${token}?tab=invoice`;

  const purchase = await createChipPurchase({
    reference: buildChipReference(
      portal.studioId,
      invoice.id,
      input.milestoneId ?? null,
    ),
    amount,
    currency: studio.currency,
    productName: `${studio.name} · ${invoice.number ?? `Invoice ${invoice.id}`}`,
    clientEmail: clientRows[0]?.email ?? null,
    clientName: clientRows[0]?.name ?? null,
    successRedirect: portalUrl,
    failureRedirect: portalUrl,
  });

  return { checkoutUrl: purchase.checkoutUrl, amount: amount.toFixed(2) };
}

interface ChipCallbackPayload {
  id?: string;
  event_type?: string;
  status?: string;
  reference?: string;
  purchase?: {
    total?: number;
    currency?: string;
    products?: { price?: number }[];
  };
}

function eventKey(payload: ChipCallbackPayload) {
  const id = payload.id?.trim();
  if (!id) return null;
  return payload.event_type ? `${payload.event_type}:${id}` : id;
}

function isPaidEvent(payload: ChipCallbackPayload) {
  return (
    payload.status === "paid" ||
    payload.event_type === "purchase.paid" ||
    payload.event_type === "payment.paid"
  );
}

/** Verifies, de-duplicates, then settles the matching payment row. */
export async function handleChipWebhook(
  rawBody: Buffer,
  signature: string | undefined,
) {
  if (!isChipConfigured()) {
    throw new MoneyServiceError("Online payments are not configured.", 503);
  }
  if (!verifyChipSignature(rawBody, signature)) {
    throw new MoneyServiceError("Invalid webhook signature.", 401);
  }

  let payload: ChipCallbackPayload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new MoneyServiceError("Invalid webhook payload.", 400);
  }

  const key = eventKey(payload);
  if (!key) {
    throw new MoneyServiceError("Webhook payload has no event id.", 400);
  }

  try {
    await db.insert(chipWebhookEvents).values({
      eventId: key,
      payload: rawBody.toString("utf8").slice(0, 60000),
    });
  } catch {
    // Unique event id — CHIP retried a callback we already handled.
    return { received: true, duplicate: true, settled: false };
  }

  if (!isPaidEvent(payload)) {
    return { received: true, duplicate: false, settled: false };
  }

  const reference = parseChipReference(payload.reference);
  if (!reference) {
    return { received: true, duplicate: false, settled: false };
  }

  const invoiceRows = await db
    .select({ id: invoices.id, jobId: invoices.jobId, number: invoices.number })
    .from(invoices)
    .where(
      and(
        eq(invoices.id, reference.invoiceId),
        eq(invoices.studioId, reference.studioId),
      ),
    )
    .limit(1);
  const invoice = invoiceRows[0];
  if (!invoice) {
    return { received: true, duplicate: false, settled: false };
  }

  const milestones = await db
    .select()
    .from(invoiceMilestones)
    .where(eq(invoiceMilestones.invoiceId, invoice.id));

  const targets = reference.milestoneId
    ? milestones.filter((m) => m.id === reference.milestoneId)
    : milestones;

  const paidAt = new Date();
  let settled = 0;

  for (const milestone of targets) {
    const existing = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.studioId, reference.studioId),
          eq(payments.milestoneId, milestone.id),
        ),
      );

    if (existing.some((p) => p.status === "PAID")) continue;

    const unpaid = existing.find((p) => p.status === "UNPAID");
    if (unpaid) {
      await db
        .update(payments)
        .set({ status: "PAID", paidAt })
        .where(eq(payments.id, unpaid.id));
    } else {
      await db.insert(payments).values({
        studioId: reference.studioId,
        jobId: invoice.jobId,
        milestoneId: milestone.id,
        amount: milestone.amount,
        status: "PAID",
        paidAt,
        notes: "Paid online via CHIP",
      });
    }
    settled += 1;
  }

  if (settled > 0 && !reference.milestoneId) {
    await db
      .update(invoices)
      .set({ status: "PAID" })
      .where(eq(invoices.id, invoice.id));
  }

  return { received: true, duplicate: false, settled: settled > 0 };
}
