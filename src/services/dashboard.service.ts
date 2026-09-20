import {
  and,
  asc,
  count,
  eq,
  gte,
  inArray,
  isNull,
  lte,
} from "drizzle-orm";
import { db } from "../db/database.js";
import { clients } from "../db/schema/clients.js";
import { quotations } from "../db/schema/quotations.js";
import { jobSessions, jobs } from "../db/schema/jobs.js";
import { expenses, invoiceMilestones, invoices, payments } from "../db/schema/money.js";
import { optionItems } from "../db/schema/option_lists.js";
import { studios } from "../db/schema/studios.js";

export class DashboardServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "DashboardServiceError";
  }
}

export const DASHBOARD_PERIODS = [7, 30, 90] as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export interface DashboardRangeInput {
  period?: DashboardPeriod;
  from?: string;
  to?: string;
}

export interface DashboardRange {
  from: Date;
  to: Date;
  period: DashboardPeriod | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
/** Payments and milestones this many days either side of now need a nudge. */
const ATTENTION_WINDOW_DAYS = 7;
const ATTENTION_LIMIT = 10;

function moneySum(rows: { amount: string }[]): string {
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return total.toFixed(2);
}

function parseBound(value: string, label: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new DashboardServiceError(`Invalid ${label} date.`, 400);
  }
  return date;
}

/** `from`/`to` win over `period`; falling back to the last 30 days. */
export function resolveDashboardRange(input: DashboardRangeInput): DashboardRange {
  const now = new Date();

  if (input.from || input.to) {
    const from = input.from ? parseBound(input.from, "from") : new Date(now.getTime() - 30 * DAY_MS);
    const to = input.to ? parseBound(input.to, "to") : now;
    if (from > to) {
      throw new DashboardServiceError("`from` must be before `to`.", 400);
    }
    return { from, to, period: null };
  }

  const period = input.period ?? 30;
  return { from: new Date(now.getTime() - period * DAY_MS), to: now, period };
}

/** Monday 00:00 of the week holding `date`, in server local time. */
function weekStart(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const isoWeekday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - isoWeekday);
  return start;
}

function dateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCashflow(
  range: DashboardRange,
  paidRows: { amount: string; paidAt: Date | null }[],
  expenseRows: { amount: string; spentAt: Date }[],
) {
  const buckets = new Map<string, { weekStart: string; in: number; out: number }>();

  for (
    let cursor = weekStart(range.from);
    cursor.getTime() <= range.to.getTime();
    cursor = new Date(cursor.getTime() + WEEK_MS)
  ) {
    const key = dateOnly(cursor);
    buckets.set(key, { weekStart: key, in: 0, out: 0 });
  }

  function bucketFor(date: Date) {
    return buckets.get(dateOnly(weekStart(date)));
  }

  for (const row of paidRows) {
    if (!row.paidAt) continue;
    const bucket = bucketFor(row.paidAt);
    if (bucket) bucket.in += Number(row.amount || 0);
  }
  for (const row of expenseRows) {
    const bucket = bucketFor(row.spentAt);
    if (bucket) bucket.out += Number(row.amount || 0);
  }

  return [...buckets.values()].map((bucket) => ({
    weekStart: bucket.weekStart,
    in: bucket.in.toFixed(2),
    out: bucket.out.toFixed(2),
  }));
}

export interface DashboardAttentionItem {
  id: string;
  kind: "PAYMENT_UNPAID" | "MILESTONE_DUE";
  label: string;
  jobId: number | null;
  dueDate: string | null;
  amount: string;
}

/** Unpaid milestones (and their unpaid payment rows) due around today. */
async function loadAttention(
  studioId: number,
  now: Date,
): Promise<DashboardAttentionItem[]> {
  const windowStart = new Date(now.getTime() - ATTENTION_WINDOW_DAYS * DAY_MS);
  const windowEnd = new Date(now.getTime() + ATTENTION_WINDOW_DAYS * DAY_MS);

  const rows = await db
    .select({
      milestoneId: invoiceMilestones.id,
      milestoneLabel: invoiceMilestones.label,
      milestoneAmount: invoiceMilestones.amount,
      dueDate: invoiceMilestones.dueDate,
      invoiceNumber: invoices.number,
      jobId: invoices.jobId,
      paymentId: payments.id,
      paymentStatus: payments.status,
      paymentAmount: payments.amount,
    })
    .from(invoiceMilestones)
    .innerJoin(invoices, eq(invoiceMilestones.invoiceId, invoices.id))
    .leftJoin(payments, eq(payments.milestoneId, invoiceMilestones.id))
    .where(
      and(
        eq(invoices.studioId, studioId),
        gte(invoiceMilestones.dueDate, windowStart),
        lte(invoiceMilestones.dueDate, windowEnd),
      ),
    )
    .orderBy(asc(invoiceMilestones.dueDate));

  type Pending = DashboardAttentionItem & { settled: boolean };
  const byMilestone = new Map<number, Pending>();

  for (const row of rows) {
    const existing = byMilestone.get(row.milestoneId);
    const settled =
      (existing?.settled ?? false) ||
      row.paymentStatus === "PAID" ||
      row.paymentStatus === "WRITTEN_OFF";

    byMilestone.set(row.milestoneId, {
      settled,
      id: row.paymentId ? `payment-${row.paymentId}` : `milestone-${row.milestoneId}`,
      kind: row.paymentId ? "PAYMENT_UNPAID" : "MILESTONE_DUE",
      label: `${row.invoiceNumber ?? "Invoice"} · ${row.milestoneLabel}`,
      jobId: row.jobId,
      dueDate: row.dueDate ? row.dueDate.toISOString() : null,
      amount: Number(row.paymentAmount ?? row.milestoneAmount ?? 0).toFixed(2),
    });
  }

  return [...byMilestone.values()]
    .filter((item) => !item.settled)
    .slice(0, ATTENTION_LIMIT)
    .map(({ settled: _settled, ...item }) => item);
}

export async function getDashboardSummary(
  studioId: number,
  rangeInput: DashboardRangeInput = {},
) {
  const now = new Date();
  const range = resolveDashboardRange(rangeInput);

  const [
    clientCountRows,
    quoteStatusRows,
    jobStatusRows,
    unpaidPayments,
    upcomingSessions,
    cancelledJobs,
    acceptedQuotes,
    studioRows,
    paidInRange,
    expensesInRange,
    leadRows,
    attention,
  ] = await Promise.all([
    db
      .select({ total: count() })
      .from(clients)
      .where(and(eq(clients.studioId, studioId), isNull(clients.retiredAt))),
    db
      .select({ status: quotations.status, total: count() })
      .from(quotations)
      .where(eq(quotations.studioId, studioId))
      .groupBy(quotations.status),
    db
      .select({ status: jobs.status, total: count() })
      .from(jobs)
      .where(eq(jobs.studioId, studioId))
      .groupBy(jobs.status),
    db
      .select({ amount: payments.amount })
      .from(payments)
      .where(
        and(eq(payments.studioId, studioId), eq(payments.status, "UNPAID")),
      ),
    db
      .select({
        session: jobSessions,
        jobId: jobs.id,
        jobNumber: jobs.number,
        jobStatus: jobs.status,
        clientId: clients.id,
        clientName: clients.name,
      })
      .from(jobSessions)
      .innerJoin(jobs, eq(jobSessions.jobId, jobs.id))
      .innerJoin(clients, eq(jobs.clientId, clients.id))
      .where(
        and(
          eq(jobs.studioId, studioId),
          eq(jobs.status, "CONFIRMED"),
          gte(jobSessions.startsAt, now),
        ),
      )
      .orderBy(asc(jobSessions.startsAt))
      .limit(8),
    db
      .select({ total: count() })
      .from(jobs)
      .where(and(eq(jobs.studioId, studioId), eq(jobs.status, "CANCELLED"))),
    db
      .select({ totalAmount: quotations.totalAmount })
      .from(quotations)
      .where(
        and(
          eq(quotations.studioId, studioId),
          inArray(quotations.status, ["ACCEPTED", "SENT"]),
        ),
      ),
    db
      .select({ currency: studios.currency })
      .from(studios)
      .where(eq(studios.id, studioId))
      .limit(1),
    db
      .select({ amount: payments.amount, paidAt: payments.paidAt })
      .from(payments)
      .where(
        and(
          eq(payments.studioId, studioId),
          eq(payments.status, "PAID"),
          gte(payments.paidAt, range.from),
          lte(payments.paidAt, range.to),
        ),
      ),
    db
      .select({ amount: expenses.amount, spentAt: expenses.spentAt })
      .from(expenses)
      .where(
        and(
          eq(expenses.studioId, studioId),
          gte(expenses.spentAt, range.from),
          lte(expenses.spentAt, range.to),
        ),
      ),
    db
      .select({
        itemId: jobs.leadSourceItemId,
        label: optionItems.label,
        total: count(),
      })
      .from(jobs)
      .leftJoin(optionItems, eq(jobs.leadSourceItemId, optionItems.id))
      .where(
        and(
          eq(jobs.studioId, studioId),
          gte(jobs.createdAt, range.from),
          lte(jobs.createdAt, range.to),
        ),
      )
      .groupBy(jobs.leadSourceItemId, optionItems.label),
    loadAttention(studioId, now),
  ]);

  const quotesByStatus: Record<string, number> = {
    DRAFT: 0,
    SENT: 0,
    ACCEPTED: 0,
    LOST: 0,
  };
  for (const row of quoteStatusRows) {
    quotesByStatus[row.status] = Number(row.total);
  }

  const jobsByStatus: Record<string, number> = {
    CONFIRMED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  for (const row of jobStatusRows) {
    jobsByStatus[row.status] = Number(row.total);
  }

  const clientsTotal = Number(clientCountRows[0]?.total ?? 0);
  const expectedIncome = moneySum(unpaidPayments);
  const bookedAhead = jobsByStatus.CONFIRMED;
  const acceptedRevenue = acceptedQuotes.reduce(
    (sum, row) => sum + Number(row.totalAmount || 0),
    0,
  );
  const averagePerClient =
    clientsTotal > 0 ? (acceptedRevenue / clientsTotal).toFixed(2) : "0.00";

  const income = Number(moneySum(paidInRange));
  const expenseTotal = Number(moneySum(expensesInRange));

  const leads = leadRows
    .map((row) => ({
      label: row.itemId === null ? "Unknown" : (row.label ?? "Unknown"),
      count: Number(row.total),
    }))
    .sort((a, b) => b.count - a.count);

  return {
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      period: range.period,
    },
    kpis: {
      expectedIncome,
      bookedAhead,
      averagePerClient,
      cancellations: Number(cancelledJobs[0]?.total ?? 0),
      clientsTotal,
      unpaidPaymentsCount: unpaidPayments.length,
    },
    profit: {
      income: income.toFixed(2),
      expenses: expenseTotal.toFixed(2),
      net: (income - expenseTotal).toFixed(2),
      currency: studioRows[0]?.currency ?? "MYR",
    },
    cashflow: buildCashflow(range, paidInRange, expensesInRange),
    leads,
    attention,
    quotations: {
      byStatus: quotesByStatus,
      total: Object.values(quotesByStatus).reduce((a, b) => a + b, 0),
    },
    jobs: {
      byStatus: jobsByStatus,
      total: Object.values(jobsByStatus).reduce((a, b) => a + b, 0),
    },
    nextSessions: upcomingSessions.map((row) => ({
      ...row.session,
      job: {
        id: row.jobId,
        number: row.jobNumber,
        status: row.jobStatus,
      },
      client: {
        id: row.clientId,
        name: row.clientName,
      },
    })),
  };
}
