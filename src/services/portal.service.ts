import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull, or, gt } from "drizzle-orm";
import { db } from "../db/database.js";
import { studios } from "../db/schema/studios.js";
import { clients } from "../db/schema/clients.js";
import {
  jobDeliverables,
  jobSessions,
  jobs,
} from "../db/schema/jobs.js";
import {
  invoiceMilestones,
  invoices,
  payments,
} from "../db/schema/money.js";
import { portalTokens } from "../db/schema/portal_tokens.js";
import { MoneyServiceError } from "./money.service.js";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function parseDate(value: string | null | undefined): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new MoneyServiceError("Invalid expiresAt datetime.", 400);
  }
  return date;
}

export async function issuePortalToken(
  studioId: number,
  jobId: number,
  expiresAt?: string | null,
) {
  const jobRows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.studioId, studioId)))
    .limit(1);
  if (!jobRows[0]) {
    throw new MoneyServiceError("Job not found in this studio.", 404);
  }

  const token = randomBytes(24).toString("base64url");
  const tokenHash = hashToken(token);

  await db.insert(portalTokens).values({
    studioId,
    jobId,
    tokenHash,
    expiresAt: parseDate(expiresAt ?? null),
  });

  return {
    token,
    jobId,
    expiresAt: parseDate(expiresAt ?? null),
    portalPath: `/portal/${token}`,
  };
}

/** Resolves a plaintext portal token to its studio + job, or throws 404. */
export async function resolvePortalToken(token: string) {
  if (!token || token.length < 8) {
    throw new MoneyServiceError("Invalid portal token.", 404);
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  const tokenRows = await db
    .select()
    .from(portalTokens)
    .where(
      and(
        eq(portalTokens.tokenHash, tokenHash),
        or(isNull(portalTokens.expiresAt), gt(portalTokens.expiresAt, now)),
      ),
    )
    .limit(1);

  const portal = tokenRows[0];
  if (!portal) {
    throw new MoneyServiceError("Portal link not found or expired.", 404);
  }
  return portal;
}

export async function getPublicPortal(token: string) {
  const portal = await resolvePortalToken(token);

  const jobRows = await db
    .select({
      job: jobs,
      clientId: clients.id,
      clientName: clients.name,
      clientPhone: clients.phone,
      clientEmail: clients.email,
    })
    .from(jobs)
    .innerJoin(clients, eq(jobs.clientId, clients.id))
    .where(and(eq(jobs.id, portal.jobId), eq(jobs.studioId, portal.studioId)))
    .limit(1);

  const jobRow = jobRows[0];
  if (!jobRow) {
    throw new MoneyServiceError("Portal job not found.", 404);
  }

  const studioRows = await db
    .select({
      id: studios.id,
      name: studios.name,
      logoUrl: studios.logoUrl,
      portalMessage: studios.portalMessage,
      currency: studios.currency,
      phone: studios.phone,
      email: studios.email,
      address: studios.address,
      payToBank: studios.payToBank,
      payToAccountName: studios.payToAccountName,
      payToAccountNo: studios.payToAccountNo,
      chipEnabled: studios.chipEnabled,
    })
    .from(studios)
    .where(eq(studios.id, portal.studioId))
    .limit(1);

  const studio = studioRows[0];
  if (!studio) {
    throw new MoneyServiceError("Studio not found.", 404);
  }

  const [sessions, deliverables, invoiceRows] = await Promise.all([
    db
      .select()
      .from(jobSessions)
      .where(eq(jobSessions.jobId, jobRow.job.id))
      .orderBy(asc(jobSessions.startsAt)),
    db
      .select()
      .from(jobDeliverables)
      .where(
        and(
          eq(jobDeliverables.jobId, jobRow.job.id),
          eq(jobDeliverables.clientVisible, true),
        ),
      )
      .orderBy(asc(jobDeliverables.sortOrder)),
    db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.jobId, jobRow.job.id),
          eq(invoices.studioId, portal.studioId),
        ),
      )
      .orderBy(asc(invoices.id)),
  ]);

  const invoiceIds = invoiceRows.map((i) => i.id);
  const milestones =
    invoiceIds.length === 0
      ? []
      : await db
          .select()
          .from(invoiceMilestones)
          .where(inArray(invoiceMilestones.invoiceId, invoiceIds))
          .orderBy(asc(invoiceMilestones.sortOrder));

  const milestoneIds = milestones.map((m) => m.id);
  const paymentRows =
    milestoneIds.length === 0
      ? []
      : await db
          .select()
          .from(payments)
          .where(inArray(payments.milestoneId, milestoneIds));

  const milestonesByInvoice = new Map<number, typeof milestones>();
  for (const m of milestones) {
    const list = milestonesByInvoice.get(m.invoiceId) ?? [];
    list.push(m);
    milestonesByInvoice.set(m.invoiceId, list);
  }

  const paymentsByMilestone = new Map<number, typeof paymentRows>();
  for (const p of paymentRows) {
    if (p.milestoneId == null) continue;
    const list = paymentsByMilestone.get(p.milestoneId) ?? [];
    list.push(p);
    paymentsByMilestone.set(p.milestoneId, list);
  }

  return {
    studio,
    job: {
      id: jobRow.job.id,
      number: jobRow.job.number,
      status: jobRow.job.status,
      notes: jobRow.job.notes,
    },
    client: {
      id: jobRow.clientId,
      name: jobRow.clientName,
      phone: jobRow.clientPhone,
      email: jobRow.clientEmail,
    },
    sessions,
    deliverables,
    invoices: invoiceRows.map((invoice) => ({
      ...invoice,
      milestones: (milestonesByInvoice.get(invoice.id) ?? []).map((m) => ({
        ...m,
        payments: paymentsByMilestone.get(m.id) ?? [],
      })),
    })),
  };
}
