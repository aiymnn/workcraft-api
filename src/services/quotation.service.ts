import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  like,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../db/database.js";
import { studios } from "../db/schema/studios.js";
import { clients } from "../db/schema/clients.js";
import {
  quotationContracts,
  quotationLineItems,
  quotationPaymentRows,
  quotationSessions,
  quotations,
} from "../db/schema/quotations.js";

export class QuotationServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "QuotationServiceError";
  }
}

type LineInput = {
  packageId?: number | null;
  name: string;
  description?: string | null;
  quantity?: string;
  unitPrice?: string;
  amount?: string;
  sortOrder?: number;
};

type SessionInput = {
  ceremonyTypeItemId?: number | null;
  label?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  venue?: string | null;
  sortOrder?: number;
};

type PaymentInput = {
  label: string;
  type: "FIXED" | "PCT_TOTAL" | "PCT_REMAINING";
  value: string;
  dueN: number;
  dueUnit: "DAYS" | "WEEKS" | "MONTHS";
  dueAnchor: "TODAY" | "BEFORE_SHOOT" | "AFTER_SHOOT";
  sortOrder?: number;
};

type ContractInput = {
  name: string;
  body: string;
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

function moneyToNumber(value: string | undefined, fallback = 0): number {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computeLineAmount(line: LineInput): string {
  if (line.amount !== undefined) {
    return moneyToNumber(line.amount).toFixed(2);
  }
  const qty = moneyToNumber(line.quantity, 1);
  const unit = moneyToNumber(line.unitPrice, 0);
  return (qty * unit).toFixed(2);
}

function computeTotal(lines: LineInput[]): string {
  const total = lines.reduce(
    (sum, line) => sum + moneyToNumber(computeLineAmount(line)),
    0,
  );
  return total.toFixed(2);
}

function formatQuoteNumber(seq: number, at = new Date()): string {
  const year = at.getFullYear();
  return `QUO-${year}-${String(seq).padStart(4, "0")}`;
}

async function assertClientInStudio(studioId: number, clientId: number) {
  const rows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.studioId, studioId)))
    .limit(1);
  if (!rows[0]) {
    throw new QuotationServiceError("Client not found in this studio.", 400);
  }
}

async function allocateQuoteNumber(
  studioId: number,
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  await tx.execute(
    sql`SELECT id FROM studios WHERE id = ${studioId} FOR UPDATE`,
  );

  const rows = await tx
    .select({
      quoteNextNumber: studios.quoteNextNumber,
      currency: studios.currency,
      quoteIntro: studios.quoteIntro,
      quoteNotes: studios.quoteNotes,
    })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  const studio = rows[0];
  if (!studio) {
    throw new QuotationServiceError("Studio not found.", 404);
  }

  const seq = studio.quoteNextNumber;
  await tx
    .update(studios)
    .set({ quoteNextNumber: seq + 1 })
    .where(eq(studios.id, studioId));

  return {
    number: formatQuoteNumber(seq),
    currency: studio.currency,
    quoteIntro: studio.quoteIntro,
    quoteNotes: studio.quoteNotes,
  };
}

async function insertNested(
  quotationId: number,
  nested: {
    lineItems?: LineInput[];
    sessions?: SessionInput[];
    paymentRows?: PaymentInput[];
    contracts?: ContractInput[];
  },
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  const lines = nested.lineItems ?? [];
  if (lines.length > 0) {
    await tx.insert(quotationLineItems).values(
      lines.map((line, index) => ({
        quotationId,
        packageId: line.packageId ?? null,
        name: line.name.trim(),
        description: emptyToNull(line.description),
        quantity: line.quantity ?? "1.00",
        unitPrice: line.unitPrice ?? "0.00",
        amount: computeLineAmount(line),
        sortOrder: line.sortOrder ?? index,
      })),
    );
  }

  const sessions = nested.sessions ?? [];
  if (sessions.length > 0) {
    await tx.insert(quotationSessions).values(
      sessions.map((session, index) => ({
        quotationId,
        ceremonyTypeItemId: session.ceremonyTypeItemId ?? null,
        label: emptyToNull(session.label),
        startsAt: parseDate(session.startsAt),
        endsAt: parseDate(session.endsAt),
        venue: emptyToNull(session.venue),
        sortOrder: session.sortOrder ?? index,
      })),
    );
  }

  const payments = nested.paymentRows ?? [];
  if (payments.length > 0) {
    await tx.insert(quotationPaymentRows).values(
      payments.map((row, index) => ({
        quotationId,
        label: row.label.trim(),
        type: row.type,
        value: row.value,
        dueN: row.dueN,
        dueUnit: row.dueUnit,
        dueAnchor: row.dueAnchor,
        sortOrder: row.sortOrder ?? index,
      })),
    );
  }

  const contracts = nested.contracts ?? [];
  if (contracts.length > 0) {
    await tx.insert(quotationContracts).values(
      contracts.map((contract) => ({
        quotationId,
        name: contract.name.trim(),
        body: contract.body,
      })),
    );
  }
}

async function replaceNested(
  quotationId: number,
  nested: {
    lineItems?: LineInput[];
    sessions?: SessionInput[];
    paymentRows?: PaymentInput[];
    contracts?: ContractInput[];
  },
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
) {
  if (nested.lineItems !== undefined) {
    await tx
      .delete(quotationLineItems)
      .where(eq(quotationLineItems.quotationId, quotationId));
  }
  if (nested.sessions !== undefined) {
    await tx
      .delete(quotationSessions)
      .where(eq(quotationSessions.quotationId, quotationId));
  }
  if (nested.paymentRows !== undefined) {
    await tx
      .delete(quotationPaymentRows)
      .where(eq(quotationPaymentRows.quotationId, quotationId));
  }
  if (nested.contracts !== undefined) {
    await tx
      .delete(quotationContracts)
      .where(eq(quotationContracts.quotationId, quotationId));
  }

  await insertNested(
    quotationId,
    {
      ...(nested.lineItems !== undefined
        ? { lineItems: nested.lineItems }
        : {}),
      ...(nested.sessions !== undefined ? { sessions: nested.sessions } : {}),
      ...(nested.paymentRows !== undefined
        ? { paymentRows: nested.paymentRows }
        : {}),
      ...(nested.contracts !== undefined
        ? { contracts: nested.contracts }
        : {}),
    },
    tx,
  );
}

async function loadNested(quotationIds: number[]) {
  const empty = {
    lineItems: new Map<number, (typeof quotationLineItems.$inferSelect)[]>(),
    sessions: new Map<number, (typeof quotationSessions.$inferSelect)[]>(),
    paymentRows: new Map<
      number,
      (typeof quotationPaymentRows.$inferSelect)[]
    >(),
    contracts: new Map<number, (typeof quotationContracts.$inferSelect)[]>(),
  };

  if (quotationIds.length === 0) return empty;

  const [lines, sessions, payments, contracts] = await Promise.all([
    db
      .select()
      .from(quotationLineItems)
      .where(inArray(quotationLineItems.quotationId, quotationIds))
      .orderBy(asc(quotationLineItems.sortOrder), asc(quotationLineItems.id)),
    db
      .select()
      .from(quotationSessions)
      .where(inArray(quotationSessions.quotationId, quotationIds))
      .orderBy(asc(quotationSessions.sortOrder), asc(quotationSessions.id)),
    db
      .select()
      .from(quotationPaymentRows)
      .where(inArray(quotationPaymentRows.quotationId, quotationIds))
      .orderBy(asc(quotationPaymentRows.sortOrder), asc(quotationPaymentRows.id)),
    db
      .select()
      .from(quotationContracts)
      .where(inArray(quotationContracts.quotationId, quotationIds))
      .orderBy(asc(quotationContracts.id)),
  ]);

  for (const row of lines) {
    const list = empty.lineItems.get(row.quotationId) ?? [];
    list.push(row);
    empty.lineItems.set(row.quotationId, list);
  }
  for (const row of sessions) {
    const list = empty.sessions.get(row.quotationId) ?? [];
    list.push(row);
    empty.sessions.set(row.quotationId, list);
  }
  for (const row of payments) {
    const list = empty.paymentRows.get(row.quotationId) ?? [];
    list.push(row);
    empty.paymentRows.set(row.quotationId, list);
  }
  for (const row of contracts) {
    const list = empty.contracts.get(row.quotationId) ?? [];
    list.push(row);
    empty.contracts.set(row.quotationId, list);
  }

  return empty;
}

function attachDetail(
  quote: typeof quotations.$inferSelect,
  client: {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
  } | null,
  nested: Awaited<ReturnType<typeof loadNested>>,
) {
  return {
    ...quote,
    client,
    lineItems: nested.lineItems.get(quote.id) ?? [],
    sessions: nested.sessions.get(quote.id) ?? [],
    paymentRows: nested.paymentRows.get(quote.id) ?? [],
    contracts: nested.contracts.get(quote.id) ?? [],
    sessionsCount: (nested.sessions.get(quote.id) ?? []).length,
  };
}

export async function listQuotations(params: {
  studioId: number;
  page: number;
  pageSize: number;
  status?: (typeof quotations.$inferSelect)["status"];
  search?: string;
}) {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const conditions: SQL[] = [eq(quotations.studioId, params.studioId)];

  if (params.status) {
    conditions.push(eq(quotations.status, params.status));
  }

  if (params.search) {
    const term = `%${params.search}%`;
    const searchCondition = or(
      like(quotations.number, term),
      like(clients.name, term),
      like(clients.email, term),
      like(clients.phone, term),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const where = and(...conditions);
  const offset = (page - 1) * pageSize;

  const totalResult = await db
    .select({ total: count() })
    .from(quotations)
    .innerJoin(clients, eq(quotations.clientId, clients.id))
    .where(where);

  const total = Number(totalResult[0]?.total ?? 0);

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
    .where(where)
    .orderBy(desc(quotations.id))
    .limit(pageSize)
    .offset(offset);

  const nested = await loadNested(rows.map((r) => r.quotation.id));

  const items = rows.map((row) =>
    attachDetail(
      row.quotation,
      {
        id: row.clientId,
        name: row.clientName,
        phone: row.clientPhone,
        email: row.clientEmail,
      },
      nested,
    ),
  );

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
}

export async function getQuotation(studioId: number, id: number) {
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
    .where(and(eq(quotations.id, id), eq(quotations.studioId, studioId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const nested = await loadNested([row.quotation.id]);
  return attachDetail(
    row.quotation,
    {
      id: row.clientId,
      name: row.clientName,
      phone: row.clientPhone,
      email: row.clientEmail,
    },
    nested,
  );
}

export async function createQuotation(
  studioId: number,
  input: {
    clientId: number;
    status?: "DRAFT" | "SENT" | "ACCEPTED" | "LOST";
    currency?: string;
    intro?: string | null;
    notes?: string | null;
    lineItems?: LineInput[];
    sessions?: SessionInput[];
    paymentRows?: PaymentInput[];
    contracts?: ContractInput[];
  },
) {
  await assertClientInStudio(studioId, input.clientId);

  const lineItems = input.lineItems ?? [];
  const totalAmount = computeTotal(lineItems);

  const quotationId = await db.transaction(async (tx) => {
    const allocated = await allocateQuoteNumber(studioId, tx);

    const result = await tx.insert(quotations).values({
      studioId,
      clientId: input.clientId,
      number: allocated.number,
      status: input.status ?? "DRAFT",
      currency: input.currency ?? allocated.currency,
      intro:
        input.intro !== undefined
          ? emptyToNull(input.intro)
          : allocated.quoteIntro,
      notes:
        input.notes !== undefined
          ? emptyToNull(input.notes)
          : allocated.quoteNotes,
      totalAmount,
    });

    const id = result[0].insertId;
    await insertNested(
      id,
      {
        lineItems,
        ...(input.sessions !== undefined ? { sessions: input.sessions } : {}),
        ...(input.paymentRows !== undefined
          ? { paymentRows: input.paymentRows }
          : {}),
        ...(input.contracts !== undefined
          ? { contracts: input.contracts }
          : {}),
      },
      tx,
    );
    return id;
  });

  const created = await getQuotation(studioId, quotationId);
  if (!created) {
    throw new QuotationServiceError("Failed to create quotation.", 500);
  }
  return created;
}

export async function updateQuotation(
  studioId: number,
  id: number,
  input: {
    clientId?: number;
    status?: "DRAFT" | "SENT" | "ACCEPTED" | "LOST";
    currency?: string;
    intro?: string | null;
    notes?: string | null;
    lineItems?: LineInput[];
    sessions?: SessionInput[];
    paymentRows?: PaymentInput[];
    contracts?: ContractInput[];
  },
) {
  const existing = await getQuotation(studioId, id);
  if (!existing) {
    throw new QuotationServiceError("Quotation not found.", 404);
  }

  if (input.clientId !== undefined) {
    await assertClientInStudio(studioId, input.clientId);
  }

  const hasNested =
    input.lineItems !== undefined ||
    input.sessions !== undefined ||
    input.paymentRows !== undefined ||
    input.contracts !== undefined;

  const headerUpdates: Partial<typeof quotations.$inferInsert> = {};
  if (input.clientId !== undefined) headerUpdates.clientId = input.clientId;
  if (input.status !== undefined) headerUpdates.status = input.status;
  if (input.currency !== undefined) headerUpdates.currency = input.currency;
  if (input.intro !== undefined) headerUpdates.intro = emptyToNull(input.intro);
  if (input.notes !== undefined) headerUpdates.notes = emptyToNull(input.notes);

  if (input.lineItems !== undefined) {
    headerUpdates.totalAmount = computeTotal(input.lineItems);
  }

  if (Object.keys(headerUpdates).length === 0 && !hasNested) {
    throw new QuotationServiceError(
      "At least one field is required to update.",
      400,
    );
  }

  await db.transaction(async (tx) => {
    if (Object.keys(headerUpdates).length > 0) {
      await tx
        .update(quotations)
        .set(headerUpdates)
        .where(and(eq(quotations.id, id), eq(quotations.studioId, studioId)));
    }

    if (hasNested) {
      await replaceNested(
        id,
        {
          ...(input.lineItems !== undefined
            ? { lineItems: input.lineItems }
            : {}),
          ...(input.sessions !== undefined
            ? { sessions: input.sessions }
            : {}),
          ...(input.paymentRows !== undefined
            ? { paymentRows: input.paymentRows }
            : {}),
          ...(input.contracts !== undefined
            ? { contracts: input.contracts }
            : {}),
        },
        tx,
      );
    }
  });

  const updated = await getQuotation(studioId, id);
  if (!updated) {
    throw new QuotationServiceError("Quotation not found.", 404);
  }
  return updated;
}

export async function deleteQuotation(studioId: number, id: number) {
  const existing = await getQuotation(studioId, id);
  if (!existing) {
    throw new QuotationServiceError("Quotation not found.", 404);
  }

  await db
    .delete(quotations)
    .where(and(eq(quotations.id, id), eq(quotations.studioId, studioId)));

  return { id, deleted: true as const };
}
