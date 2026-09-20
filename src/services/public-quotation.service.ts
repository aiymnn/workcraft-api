import { and, eq } from "drizzle-orm";
import { db } from "../db/database.js";
import { clients } from "../db/schema/clients.js";
import { studios } from "../db/schema/studios.js";
import { quotationSessions, quotations } from "../db/schema/quotations.js";
import {
  QuotationServiceError,
  loadQuotationNested,
} from "./quotation.service.js";

type SessionPatch = {
  id?: number;
  label?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  venue?: string | null;
};

function emptyToNull(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseDate(value: string | null | undefined): Date | null {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new QuotationServiceError("Invalid date value.", 400);
  }
  return date;
}

/** A LOST quote is treated as a dead link for the client. */
async function loadQuotationByToken(token: string) {
  if (!token || token.length < 8) {
    throw new QuotationServiceError("Quotation link not found.", 404);
  }

  const rows = await db
    .select({
      quotation: quotations,
      clientId: clients.id,
      clientName: clients.name,
      clientPhone: clients.phone,
      clientEmail: clients.email,
    })
    .from(quotations)
    .innerJoin(clients, eq(quotations.clientId, clients.id))
    .where(eq(quotations.publicToken, token))
    .limit(1);

  const row = rows[0];
  if (!row) {
    throw new QuotationServiceError("Quotation link not found.", 404);
  }
  return row;
}

async function buildPublicPayload(
  row: Awaited<ReturnType<typeof loadQuotationByToken>>,
) {
  const quote = row.quotation;

  const studioRows = await db
    .select({
      id: studios.id,
      name: studios.name,
      logoUrl: studios.logoUrl,
      currency: studios.currency,
      phone: studios.phone,
      email: studios.email,
    })
    .from(studios)
    .where(eq(studios.id, quote.studioId))
    .limit(1);

  const studio = studioRows[0];
  if (!studio) {
    throw new QuotationServiceError("Studio not found.", 404);
  }

  const nested = await loadQuotationNested([quote.id]);
  const sessions = nested.sessions.get(quote.id) ?? [];

  return {
    studio,
    client: {
      id: row.clientId,
      name: row.clientName,
      phone: row.clientPhone,
      email: row.clientEmail,
    },
    quotation: {
      id: quote.id,
      number: quote.number,
      status: quote.status,
      currency: quote.currency,
      intro: quote.intro,
      notes: quote.notes,
      totalAmount: quote.totalAmount,
      acceptedAt: quote.acceptedAt,
      acceptedVia: quote.acceptedVia,
      lineItems: nested.lineItems.get(quote.id) ?? [],
      sessions,
      paymentRows: nested.paymentRows.get(quote.id) ?? [],
      contracts: nested.contracts.get(quote.id) ?? [],
      sessionsCount: sessions.length,
    },
  };
}

export async function getPublicQuotation(token: string) {
  const row = await loadQuotationByToken(token);
  if (row.quotation.status === "LOST") {
    throw new QuotationServiceError("Quotation link not found.", 404);
  }
  return buildPublicPayload(row);
}

export async function acceptPublicQuotation(
  token: string,
  input: { agreementAccepted: true; sessions?: SessionPatch[] },
) {
  const row = await loadQuotationByToken(token);
  const quote = row.quotation;

  if (quote.status === "LOST") {
    throw new QuotationServiceError(
      "This quotation is no longer available.",
      409,
    );
  }

  if (quote.status === "ACCEPTED") {
    const payload = await buildPublicPayload(row);
    return { alreadyAccepted: true as const, ...payload };
  }

  const patches = input.sessions ?? [];
  const existingSessions = await db
    .select()
    .from(quotationSessions)
    .where(eq(quotationSessions.quotationId, quote.id))
    .orderBy(quotationSessions.sortOrder, quotationSessions.id);

  const targets = patches.map((patch, index) => {
    const target =
      patch.id !== undefined
        ? existingSessions.find((session) => session.id === patch.id)
        : existingSessions[index];
    if (!target) {
      throw new QuotationServiceError(
        "Session not found on this quotation.",
        400,
      );
    }

    const updates: Partial<typeof quotationSessions.$inferInsert> = {};
    if (patch.label !== undefined) updates.label = emptyToNull(patch.label);
    if (patch.venue !== undefined) updates.venue = emptyToNull(patch.venue);
    if (patch.startsAt !== undefined) updates.startsAt = parseDate(patch.startsAt);
    if (patch.endsAt !== undefined) updates.endsAt = parseDate(patch.endsAt);

    return { id: target.id, updates };
  });

  const acceptedAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(quotations)
      .set({ status: "ACCEPTED", acceptedVia: "PUBLIC", acceptedAt })
      .where(eq(quotations.id, quote.id));

    for (const target of targets) {
      if (Object.keys(target.updates).length === 0) continue;
      await tx
        .update(quotationSessions)
        .set(target.updates)
        .where(
          and(
            eq(quotationSessions.id, target.id),
            eq(quotationSessions.quotationId, quote.id),
          ),
        );
    }
  });

  const refreshed = await loadQuotationByToken(token);
  const payload = await buildPublicPayload(refreshed);
  return { alreadyAccepted: false as const, ...payload };
}
