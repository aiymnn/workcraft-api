import { and, asc, count, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { db } from "../db/database.js";
import { clients } from "../db/schema/clients.js";
import { quotations } from "../db/schema/quotations.js";
import { jobSessions, jobs } from "../db/schema/jobs.js";
import { payments } from "../db/schema/money.js";

export class DashboardServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "DashboardServiceError";
  }
}

function moneySum(rows: { amount: string }[]): string {
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  return total.toFixed(2);
}

export async function getDashboardSummary(studioId: number) {
  const now = new Date();

  const [
    clientCountRows,
    quoteStatusRows,
    jobStatusRows,
    unpaidPayments,
    upcomingSessions,
    cancelledJobs,
    acceptedQuotes,
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

  return {
    kpis: {
      expectedIncome,
      bookedAhead,
      averagePerClient,
      cancellations: Number(cancelledJobs[0]?.total ?? 0),
      clientsTotal,
      unpaidPaymentsCount: unpaidPayments.length,
    },
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
