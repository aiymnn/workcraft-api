import { randomBytes } from "node:crypto";
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
import { jobContracts, jobSessions, jobs } from "../db/schema/jobs.js";
import {
  quotationContracts,
  quotationLineItems,
  quotationPaymentRows,
  quotationSessions,
  quotations,
} from "../db/schema/quotations.js";
import { formatJobNumber, getJob } from "./job.service.js";

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

async function assertJobInStudio(studioId: number, jobId: number) {
  const rows = await db
    .select({ id: jobs.id, quotationId: jobs.quotationId })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.studioId, studioId)))
    .limit(1);
  if (!rows[0]) {
    throw new QuotationServiceError("Job not found in this studio.", 400);
  }
  return rows[0];
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

export async function loadQuotationNested(quotationIds: number[]) {
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

function attachQuotationDetail(
  quote: typeof quotations.$inferSelect,
  client: {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
  } | null,
  nested: Awaited<ReturnType<typeof loadQuotationNested>>,
  /** Job linked via jobs.quotation_id (source quote from convert). */
  sourceJobId: number | null = null,
) {
  // Prefer explicit add-on link; fall back to the convert source link.
  const jobId = quote.jobId ?? sourceJobId;
  return {
    ...quote,
    client,
    jobId,
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
  jobId?: number;
  clientId?: number;
}) {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const conditions: SQL[] = [eq(quotations.studioId, params.studioId)];

  if (params.status) {
    conditions.push(eq(quotations.status, params.status));
  }

  if (params.clientId !== undefined) {
    conditions.push(eq(quotations.clientId, params.clientId));
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

  // Filter ?jobId=: include add-ons (quotations.job_id) OR the job's source
  // quotation (jobs.quotation_id = quotations.id).
  if (params.jobId !== undefined) {
    const jobRows = await db
      .select({ quotationId: jobs.quotationId })
      .from(jobs)
      .where(
        and(eq(jobs.id, params.jobId), eq(jobs.studioId, params.studioId)),
      )
      .limit(1);
    const job = jobRows[0];
    if (!job) {
      return {
        items: [],
        pagination: { page, pageSize, total: 0, totalPages: 0 },
      };
    }
    const jobFilter =
      job.quotationId != null
        ? or(
            eq(quotations.jobId, params.jobId),
            eq(quotations.id, job.quotationId),
          )
        : eq(quotations.jobId, params.jobId);
    if (jobFilter) conditions.push(jobFilter);
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
      sourceJobId: jobs.id,
    })
    .from(quotations)
    .innerJoin(clients, eq(quotations.clientId, clients.id))
    .leftJoin(jobs, eq(jobs.quotationId, quotations.id))
    .where(where)
    .orderBy(desc(quotations.id))
    .limit(pageSize)
    .offset(offset);

  const nested = await loadQuotationNested(rows.map((r) => r.quotation.id));

  const items = rows.map((row) =>
    attachQuotationDetail(
      row.quotation,
      {
        id: row.clientId,
        name: row.clientName,
        phone: row.clientPhone,
        email: row.clientEmail,
      },
      nested,
      row.sourceJobId ?? null,
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
      sourceJobId: jobs.id,
    })
    .from(quotations)
    .innerJoin(clients, eq(quotations.clientId, clients.id))
    .leftJoin(jobs, eq(jobs.quotationId, quotations.id))
    .where(and(eq(quotations.id, id), eq(quotations.studioId, studioId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const nested = await loadQuotationNested([row.quotation.id]);
  return attachQuotationDetail(
    row.quotation,
    {
      id: row.clientId,
      name: row.clientName,
      phone: row.clientPhone,
      email: row.clientEmail,
    },
    nested,
    row.sourceJobId ?? null,
  );
}

export async function createQuotation(
  studioId: number,
  input: {
    clientId: number;
    jobId?: number | null;
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
  if (input.jobId != null) {
    await assertJobInStudio(studioId, input.jobId);
  }

  const lineItems = input.lineItems ?? [];
  const totalAmount = computeTotal(lineItems);

  const quotationId = await db.transaction(async (tx) => {
    const allocated = await allocateQuoteNumber(studioId, tx);

    const result = await tx.insert(quotations).values({
      studioId,
      clientId: input.clientId,
      jobId: input.jobId ?? null,
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
    jobId?: number | null;
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
  if (input.jobId != null) {
    await assertJobInStudio(studioId, input.jobId);
  }

  const hasNested =
    input.lineItems !== undefined ||
    input.sessions !== undefined ||
    input.paymentRows !== undefined ||
    input.contracts !== undefined;

  const headerUpdates: Partial<typeof quotations.$inferInsert> = {};
  if (input.clientId !== undefined) headerUpdates.clientId = input.clientId;
  if (input.jobId !== undefined) headerUpdates.jobId = input.jobId;
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

/**
 * Public booking link for a quotation. The token is stored in plaintext because
 * the client-facing quote page is looked up by it (`GET /api/public/quotations/:token`).
 */
export async function issueQuotationBookingLink(
  studioId: number,
  id: number,
  options: { rotate?: boolean } = {},
) {
  const rows = await db
    .select({
      id: quotations.id,
      number: quotations.number,
      publicToken: quotations.publicToken,
    })
    .from(quotations)
    .where(and(eq(quotations.id, id), eq(quotations.studioId, studioId)))
    .limit(1);

  const quote = rows[0];
  if (!quote) {
    throw new QuotationServiceError("Quotation not found.", 404);
  }

  let token = quote.publicToken;
  if (!token || options.rotate === true) {
    token = randomBytes(24).toString("base64url");
    await db
      .update(quotations)
      .set({ publicToken: token })
      .where(and(eq(quotations.id, id), eq(quotations.studioId, studioId)));
  }

  return {
    token,
    urlPath: `/quote/${token}`,
    quotationId: quote.id,
    number: quote.number,
  };
}

type SessionOverrideInput = {
  quotationSessionId?: number | null;
  label?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  venue?: string | null;
};

/** Quotes often carry undated sessions; a job session needs a real start. */
function defaultSessionStart(at = new Date()) {
  const start = new Date(at);
  start.setDate(start.getDate() + 7);
  start.setHours(9, 0, 0, 0);
  return start;
}

function defaultSessionEnd(start: Date) {
  const end = new Date(start);
  end.setHours(17, 0, 0, 0);
  return end;
}

function planJobSessions(
  quoteSessions: (typeof quotationSessions.$inferSelect)[],
  overrides: SessionOverrideInput[],
) {
  const byQuotationSessionId = new Map<number, SessionOverrideInput>();
  const positional: SessionOverrideInput[] = [];
  for (const override of overrides) {
    if (override.quotationSessionId != null) {
      byQuotationSessionId.set(override.quotationSessionId, override);
    } else {
      positional.push(override);
    }
  }

  const sources: ((typeof quotationSessions.$inferSelect) | null)[] =
    quoteSessions.length > 0 ? quoteSessions : [null];

  return sources.map((session, index) => {
    const override =
      (session ? byQuotationSessionId.get(session.id) : undefined) ??
      positional[index];

    const overrideStart = parseDate(override?.startsAt);
    const usedDefaultStart = overrideStart === null && session?.startsAt == null;
    const startsAt = overrideStart ?? session?.startsAt ?? defaultSessionStart();
    const endsAt =
      parseDate(override?.endsAt) ??
      session?.endsAt ??
      (usedDefaultStart ? defaultSessionEnd(startsAt) : null);

    return {
      ceremonyTypeItemId: session?.ceremonyTypeItemId ?? null,
      label:
        override?.label !== undefined
          ? emptyToNull(override.label)
          : (session?.label ?? null),
      startsAt,
      endsAt,
      venue:
        override?.venue !== undefined
          ? emptyToNull(override.venue)
          : (session?.venue ?? null),
    };
  });
}

async function findJobIdForQuotation(studioId: number, quotationId: number) {
  const rows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(eq(jobs.quotationId, quotationId), eq(jobs.studioId, studioId)),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

function isDuplicateQuotationJob(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "ER_DUP_ENTRY"
  );
}

async function loadConvertResult(
  studioId: number,
  jobId: number,
  quotationId: number,
  created: boolean,
) {
  const [job, quotation] = await Promise.all([
    getJob(studioId, jobId),
    getQuotation(studioId, quotationId),
  ]);
  if (!job || !quotation) {
    throw new QuotationServiceError("Failed to load converted job.", 500);
  }
  return { created, job, quotation };
}

/**
 * Turn an accepted quote into a CONFIRMED job. Idempotent: the unique index on
 * `jobs.quotation_id` keeps one job per quotation, and a second call returns the
 * job that already exists.
 */
export async function convertQuotationToJob(
  studioId: number,
  id: number,
  input: { sessionOverrides?: SessionOverrideInput[] } = {},
) {
  const quote = await getQuotation(studioId, id);
  if (!quote) {
    throw new QuotationServiceError("Quotation not found.", 404);
  }
  if (quote.status === "LOST") {
    throw new QuotationServiceError(
      "A lost quotation cannot be converted to a job.",
      409,
    );
  }

  const existingJobId = await findJobIdForQuotation(studioId, id);
  if (existingJobId !== null) {
    return loadConvertResult(studioId, existingJobId, id, false);
  }

  const plannedSessions = planJobSessions(
    quote.sessions,
    input.sessionOverrides ?? [],
  );

  let jobId: number;
  try {
    jobId = await db.transaction(async (tx) => {
      const result = await tx.insert(jobs).values({
        studioId,
        clientId: quote.clientId,
        quotationId: quote.id,
        status: "CONFIRMED",
      });
      const newJobId = result[0].insertId;

      await tx
        .update(jobs)
        .set({ number: formatJobNumber(newJobId) })
        .where(eq(jobs.id, newJobId));

      if (plannedSessions.length > 0) {
        await tx.insert(jobSessions).values(
          plannedSessions.map((session) => ({
            jobId: newJobId,
            ...session,
          })),
        );
      }

      if (quote.contracts.length > 0) {
        await tx.insert(jobContracts).values(
          quote.contracts.map((contract) => ({
            jobId: newJobId,
            name: contract.name,
            body: contract.body,
            status: "DRAFT" as const,
          })),
        );
      }

      if (quote.status !== "ACCEPTED") {
        await tx
          .update(quotations)
          .set({
            status: "ACCEPTED",
            acceptedVia: "STAFF",
            acceptedAt: new Date(),
          })
          .where(
            and(eq(quotations.id, id), eq(quotations.studioId, studioId)),
          );
      }

      return newJobId;
    });
  } catch (error) {
    if (isDuplicateQuotationJob(error)) {
      const racedJobId = await findJobIdForQuotation(studioId, id);
      if (racedJobId !== null) {
        return loadConvertResult(studioId, racedJobId, id, false);
      }
    }
    throw error;
  }

  return loadConvertResult(studioId, jobId, id, true);
}
