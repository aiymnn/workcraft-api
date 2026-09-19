import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../db/database.js";
import { studios } from "../db/schema/studios.js";
import { jobs } from "../db/schema/jobs.js";
import {
  expenses,
  invoiceMilestones,
  invoices,
  otherIncome,
  ownerDrawings,
  payments,
} from "../db/schema/money.js";

export class MoneyServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "MoneyServiceError";
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type MilestoneInput = {
  label: string;
  amount: string;
  dueDate?: string | null;
  sortOrder?: number;
};

function emptyToNull(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseDate(value: string | null | undefined, required = false): Date | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new MoneyServiceError("Date is required.", 400);
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new MoneyServiceError("Invalid date value.", 400);
  }
  return date;
}

function formatInvoiceNumber(seq: number, at = new Date()) {
  return `INV-${at.getFullYear()}-${String(seq).padStart(4, "0")}`;
}

async function assertJobInStudio(studioId: number, jobId: number) {
  const rows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.studioId, studioId)))
    .limit(1);
  if (!rows[0]) {
    throw new MoneyServiceError("Job not found in this studio.", 400);
  }
}

async function allocateInvoiceNumber(studioId: number, tx: Tx) {
  await tx.execute(
    sql`SELECT id FROM studios WHERE id = ${studioId} FOR UPDATE`,
  );
  const rows = await tx
    .select({
      invoiceNextNumber: studios.invoiceNextNumber,
      invoiceTemplateId: studios.invoiceTemplateId,
    })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);
  const studio = rows[0];
  if (!studio) throw new MoneyServiceError("Studio not found.", 404);

  const seq = studio.invoiceNextNumber;
  await tx
    .update(studios)
    .set({ invoiceNextNumber: seq + 1 })
    .where(eq(studios.id, studioId));

  return {
    number: formatInvoiceNumber(seq),
    templateId: studio.invoiceTemplateId,
  };
}

async function loadMilestones(invoiceIds: number[]) {
  const map = new Map<number, (typeof invoiceMilestones.$inferSelect)[]>();
  if (invoiceIds.length === 0) return map;
  const rows = await db
    .select()
    .from(invoiceMilestones)
    .where(inArray(invoiceMilestones.invoiceId, invoiceIds))
    .orderBy(asc(invoiceMilestones.sortOrder), asc(invoiceMilestones.id));
  for (const row of rows) {
    const list = map.get(row.invoiceId) ?? [];
    list.push(row);
    map.set(row.invoiceId, list);
  }
  return map;
}

async function replaceMilestones(
  invoiceId: number,
  milestones: MilestoneInput[],
  tx: Tx,
) {
  await tx
    .delete(invoiceMilestones)
    .where(eq(invoiceMilestones.invoiceId, invoiceId));
  if (milestones.length === 0) return;
  await tx.insert(invoiceMilestones).values(
    milestones.map((m, index) => ({
      invoiceId,
      label: m.label.trim(),
      amount: m.amount,
      dueDate: parseDate(m.dueDate),
      sortOrder: m.sortOrder ?? index,
    })),
  );
}

/* ── Invoices ─────────────────────────────────────────────── */

export async function listInvoices(params: {
  studioId: number;
  page: number;
  pageSize: number;
  jobId?: number;
  status?: (typeof invoices.$inferSelect)["status"];
}) {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const conditions: SQL[] = [eq(invoices.studioId, params.studioId)];
  if (params.jobId) conditions.push(eq(invoices.jobId, params.jobId));
  if (params.status) conditions.push(eq(invoices.status, params.status));
  const where = and(...conditions);

  const totalResult = await db
    .select({ total: count() })
    .from(invoices)
    .where(where);
  const total = Number(totalResult[0]?.total ?? 0);

  const rows = await db
    .select()
    .from(invoices)
    .where(where)
    .orderBy(desc(invoices.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const milestones = await loadMilestones(rows.map((r) => r.id));
  return {
    items: rows.map((row) => ({
      ...row,
      milestones: milestones.get(row.id) ?? [],
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
}

export async function getInvoice(studioId: number, id: number) {
  const rows = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.studioId, studioId)))
    .limit(1);
  const invoice = rows[0];
  if (!invoice) return null;
  const milestones = await loadMilestones([invoice.id]);
  return { ...invoice, milestones: milestones.get(invoice.id) ?? [] };
}

export async function createInvoice(
  studioId: number,
  input: {
    jobId: number;
    status?: "DRAFT" | "SENT" | "PAID" | "VOID";
    notes?: string | null;
    templateId?: string;
    milestones?: MilestoneInput[];
  },
) {
  await assertJobInStudio(studioId, input.jobId);

  const invoiceId = await db.transaction(async (tx) => {
    const allocated = await allocateInvoiceNumber(studioId, tx);
    const result = await tx.insert(invoices).values({
      studioId,
      jobId: input.jobId,
      number: allocated.number,
      status: input.status ?? "DRAFT",
      notes: emptyToNull(input.notes),
      templateId: input.templateId ?? allocated.templateId,
    });
    const id = result[0].insertId;
    await replaceMilestones(id, input.milestones ?? [], tx);
    return id;
  });

  const created = await getInvoice(studioId, invoiceId);
  if (!created) throw new MoneyServiceError("Failed to create invoice.", 500);
  return created;
}

export async function updateInvoice(
  studioId: number,
  id: number,
  input: {
    status?: "DRAFT" | "SENT" | "PAID" | "VOID";
    notes?: string | null;
    templateId?: string;
    milestones?: MilestoneInput[];
  },
) {
  const existing = await getInvoice(studioId, id);
  if (!existing) throw new MoneyServiceError("Invoice not found.", 404);

  const updates: Partial<typeof invoices.$inferInsert> = {};
  if (input.status !== undefined) updates.status = input.status;
  if (input.notes !== undefined) updates.notes = emptyToNull(input.notes);
  if (input.templateId !== undefined) updates.templateId = input.templateId;

  if (Object.keys(updates).length === 0 && input.milestones === undefined) {
    throw new MoneyServiceError("At least one field is required to update.", 400);
  }

  await db.transaction(async (tx) => {
    if (Object.keys(updates).length > 0) {
      await tx
        .update(invoices)
        .set(updates)
        .where(and(eq(invoices.id, id), eq(invoices.studioId, studioId)));
    }
    if (input.milestones !== undefined) {
      await replaceMilestones(id, input.milestones, tx);
    }
  });

  const updated = await getInvoice(studioId, id);
  if (!updated) throw new MoneyServiceError("Invoice not found.", 404);
  return updated;
}

export async function deleteInvoice(studioId: number, id: number) {
  const existing = await getInvoice(studioId, id);
  if (!existing) throw new MoneyServiceError("Invoice not found.", 404);
  await db
    .delete(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.studioId, studioId)));
  return { id, deleted: true as const };
}

/* ── Payments ─────────────────────────────────────────────── */

export async function listPayments(params: {
  studioId: number;
  page: number;
  pageSize: number;
  status?: (typeof payments.$inferSelect)["status"];
  jobId?: number;
}) {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const conditions: SQL[] = [eq(payments.studioId, params.studioId)];
  if (params.status) conditions.push(eq(payments.status, params.status));
  if (params.jobId) conditions.push(eq(payments.jobId, params.jobId));
  const where = and(...conditions);

  const totalResult = await db
    .select({ total: count() })
    .from(payments)
    .where(where);
  const total = Number(totalResult[0]?.total ?? 0);

  const items = await db
    .select()
    .from(payments)
    .where(where)
    .orderBy(desc(payments.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

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

export async function getPayment(studioId: number, id: number) {
  const rows = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, id), eq(payments.studioId, studioId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createPayment(
  studioId: number,
  input: {
    jobId?: number | null;
    milestoneId?: number | null;
    amount: string;
    status?: "PAID" | "UNPAID" | "WRITTEN_OFF";
    paidAt?: string | null;
    payMethodItemId?: number | null;
    bankItemId?: number | null;
    notes?: string | null;
  },
) {
  if (input.jobId != null) await assertJobInStudio(studioId, input.jobId);

  const result = await db.insert(payments).values({
    studioId,
    jobId: input.jobId ?? null,
    milestoneId: input.milestoneId ?? null,
    amount: input.amount,
    status: input.status ?? "UNPAID",
    paidAt: parseDate(input.paidAt),
    payMethodItemId: input.payMethodItemId ?? null,
    bankItemId: input.bankItemId ?? null,
    notes: emptyToNull(input.notes),
  });

  const created = await getPayment(studioId, result[0].insertId);
  if (!created) throw new MoneyServiceError("Failed to create payment.", 500);
  return created;
}

export async function updatePayment(
  studioId: number,
  id: number,
  input: {
    jobId?: number | null;
    milestoneId?: number | null;
    amount?: string;
    status?: "PAID" | "UNPAID" | "WRITTEN_OFF";
    paidAt?: string | null;
    payMethodItemId?: number | null;
    bankItemId?: number | null;
    notes?: string | null;
  },
) {
  const existing = await getPayment(studioId, id);
  if (!existing) throw new MoneyServiceError("Payment not found.", 404);
  if (input.jobId != null) await assertJobInStudio(studioId, input.jobId);

  const updates: Partial<typeof payments.$inferInsert> = {};
  if (input.jobId !== undefined) updates.jobId = input.jobId;
  if (input.milestoneId !== undefined) updates.milestoneId = input.milestoneId;
  if (input.amount !== undefined) updates.amount = input.amount;
  if (input.status !== undefined) updates.status = input.status;
  if (input.paidAt !== undefined) updates.paidAt = parseDate(input.paidAt);
  if (input.payMethodItemId !== undefined)
    updates.payMethodItemId = input.payMethodItemId;
  if (input.bankItemId !== undefined) updates.bankItemId = input.bankItemId;
  if (input.notes !== undefined) updates.notes = emptyToNull(input.notes);

  if (Object.keys(updates).length === 0) {
    throw new MoneyServiceError("At least one field is required to update.", 400);
  }

  await db
    .update(payments)
    .set(updates)
    .where(and(eq(payments.id, id), eq(payments.studioId, studioId)));

  const updated = await getPayment(studioId, id);
  if (!updated) throw new MoneyServiceError("Payment not found.", 404);
  return updated;
}

export async function deletePayment(studioId: number, id: number) {
  const existing = await getPayment(studioId, id);
  if (!existing) throw new MoneyServiceError("Payment not found.", 404);
  await db
    .delete(payments)
    .where(and(eq(payments.id, id), eq(payments.studioId, studioId)));
  return { id, deleted: true as const };
}

/* ── Expenses ─────────────────────────────────────────────── */

export async function listExpenses(params: {
  studioId: number;
  page: number;
  pageSize: number;
  taxBucket?: (typeof expenses.$inferSelect)["taxBucket"];
  jobId?: number;
}) {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const conditions: SQL[] = [eq(expenses.studioId, params.studioId)];
  if (params.taxBucket) conditions.push(eq(expenses.taxBucket, params.taxBucket));
  if (params.jobId) conditions.push(eq(expenses.jobId, params.jobId));
  const where = and(...conditions);

  const totalResult = await db
    .select({ total: count() })
    .from(expenses)
    .where(where);
  const total = Number(totalResult[0]?.total ?? 0);

  const items = await db
    .select()
    .from(expenses)
    .where(where)
    .orderBy(desc(expenses.spentAt), desc(expenses.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

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

export async function getExpense(studioId: number, id: number) {
  const rows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.studioId, studioId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createExpense(
  studioId: number,
  input: {
    jobId?: number | null;
    amount: string;
    categoryItemId?: number | null;
    taxBucket?: "CLAIMABLE" | "EQUIPMENT" | "NOT_CLAIMABLE" | "DRAWING";
    spentAt: string;
    receiptUrl?: string | null;
    notes?: string | null;
  },
) {
  if (input.jobId != null) await assertJobInStudio(studioId, input.jobId);

  const result = await db.insert(expenses).values({
    studioId,
    jobId: input.jobId ?? null,
    amount: input.amount,
    categoryItemId: input.categoryItemId ?? null,
    taxBucket: input.taxBucket ?? "CLAIMABLE",
    spentAt: parseDate(input.spentAt, true)!,
    receiptUrl: emptyToNull(input.receiptUrl),
    notes: emptyToNull(input.notes),
  });

  const created = await getExpense(studioId, result[0].insertId);
  if (!created) throw new MoneyServiceError("Failed to create expense.", 500);
  return created;
}

export async function updateExpense(
  studioId: number,
  id: number,
  input: {
    jobId?: number | null;
    amount?: string;
    categoryItemId?: number | null;
    taxBucket?: "CLAIMABLE" | "EQUIPMENT" | "NOT_CLAIMABLE" | "DRAWING";
    spentAt?: string;
    receiptUrl?: string | null;
    notes?: string | null;
  },
) {
  const existing = await getExpense(studioId, id);
  if (!existing) throw new MoneyServiceError("Expense not found.", 404);
  if (input.jobId != null) await assertJobInStudio(studioId, input.jobId);

  const updates: Partial<typeof expenses.$inferInsert> = {};
  if (input.jobId !== undefined) updates.jobId = input.jobId;
  if (input.amount !== undefined) updates.amount = input.amount;
  if (input.categoryItemId !== undefined)
    updates.categoryItemId = input.categoryItemId;
  if (input.taxBucket !== undefined) updates.taxBucket = input.taxBucket;
  if (input.spentAt !== undefined)
    updates.spentAt = parseDate(input.spentAt, true)!;
  if (input.receiptUrl !== undefined)
    updates.receiptUrl = emptyToNull(input.receiptUrl);
  if (input.notes !== undefined) updates.notes = emptyToNull(input.notes);

  if (Object.keys(updates).length === 0) {
    throw new MoneyServiceError("At least one field is required to update.", 400);
  }

  await db
    .update(expenses)
    .set(updates)
    .where(and(eq(expenses.id, id), eq(expenses.studioId, studioId)));

  const updated = await getExpense(studioId, id);
  if (!updated) throw new MoneyServiceError("Expense not found.", 404);
  return updated;
}

export async function deleteExpense(studioId: number, id: number) {
  const existing = await getExpense(studioId, id);
  if (!existing) throw new MoneyServiceError("Expense not found.", 404);
  await db
    .delete(expenses)
    .where(and(eq(expenses.id, id), eq(expenses.studioId, studioId)));
  return { id, deleted: true as const };
}

/* ── Drawings ─────────────────────────────────────────────── */

export async function listDrawings(studioId: number) {
  return db
    .select()
    .from(ownerDrawings)
    .where(eq(ownerDrawings.studioId, studioId))
    .orderBy(desc(ownerDrawings.drawnAt), desc(ownerDrawings.id));
}

export async function createDrawing(
  studioId: number,
  input: { amount: string; drawnAt: string; notes?: string | null },
) {
  const result = await db.insert(ownerDrawings).values({
    studioId,
    amount: input.amount,
    drawnAt: parseDate(input.drawnAt, true)!,
    notes: emptyToNull(input.notes),
  });
  const rows = await db
    .select()
    .from(ownerDrawings)
    .where(eq(ownerDrawings.id, result[0].insertId))
    .limit(1);
  return rows[0]!;
}

export async function deleteDrawing(studioId: number, id: number) {
  const rows = await db
    .select()
    .from(ownerDrawings)
    .where(and(eq(ownerDrawings.id, id), eq(ownerDrawings.studioId, studioId)))
    .limit(1);
  if (!rows[0]) throw new MoneyServiceError("Drawing not found.", 404);
  await db
    .delete(ownerDrawings)
    .where(and(eq(ownerDrawings.id, id), eq(ownerDrawings.studioId, studioId)));
  return { id, deleted: true as const };
}

/* ── Other income ─────────────────────────────────────────── */

export async function listOtherIncome(studioId: number) {
  return db
    .select()
    .from(otherIncome)
    .where(eq(otherIncome.studioId, studioId))
    .orderBy(desc(otherIncome.receivedAt), desc(otherIncome.id));
}

export async function createOtherIncome(
  studioId: number,
  input: {
    amount: string;
    categoryItemId?: number | null;
    countsTowardProfit?: boolean;
    receivedAt: string;
    notes?: string | null;
  },
) {
  const result = await db.insert(otherIncome).values({
    studioId,
    amount: input.amount,
    categoryItemId: input.categoryItemId ?? null,
    countsTowardProfit: input.countsTowardProfit ?? true,
    receivedAt: parseDate(input.receivedAt, true)!,
    notes: emptyToNull(input.notes),
  });
  const rows = await db
    .select()
    .from(otherIncome)
    .where(eq(otherIncome.id, result[0].insertId))
    .limit(1);
  return rows[0]!;
}

export async function deleteOtherIncome(studioId: number, id: number) {
  const rows = await db
    .select()
    .from(otherIncome)
    .where(and(eq(otherIncome.id, id), eq(otherIncome.studioId, studioId)))
    .limit(1);
  if (!rows[0]) throw new MoneyServiceError("Other income not found.", 404);
  await db
    .delete(otherIncome)
    .where(and(eq(otherIncome.id, id), eq(otherIncome.studioId, studioId)));
  return { id, deleted: true as const };
}
