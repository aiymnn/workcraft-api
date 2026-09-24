import {
  and,
  count,
  eq,
  gt,
  inArray,
  isNull,
  like,
  min,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../db/database.js";
import { clients } from "../db/schema/clients.js";
import { jobs, jobSessions } from "../db/schema/jobs.js";
import { payments } from "../db/schema/money.js";

export class ClientServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ClientServiceError";
  }
}

export type ClientRecord = typeof clients.$inferSelect;

export type ClientWithStats = ClientRecord & {
  jobCount: number;
  lifetimePaid: number;
  soon: boolean;
  cameBack: boolean;
  nextSessionAt: string | null;
};

function emptyToNull(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

async function attachClientStats(
  studioId: number,
  items: ClientRecord[],
): Promise<ClientWithStats[]> {
  if (items.length === 0) return [];

  const clientIds = items.map((c) => c.id);
  const now = new Date();

  const jobCountRows = await db
    .select({
      clientId: jobs.clientId,
      jobCount: count(),
    })
    .from(jobs)
    .where(
      and(eq(jobs.studioId, studioId), inArray(jobs.clientId, clientIds)),
    )
    .groupBy(jobs.clientId);

  const paidRows = await db
    .select({
      clientId: jobs.clientId,
      lifetimePaid: sql<string>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .innerJoin(jobs, eq(payments.jobId, jobs.id))
    .where(
      and(
        eq(payments.studioId, studioId),
        eq(payments.status, "PAID"),
        inArray(jobs.clientId, clientIds),
      ),
    )
    .groupBy(jobs.clientId);

  const nextSessionRows = await db
    .select({
      clientId: jobs.clientId,
      nextSessionAt: min(jobSessions.startsAt),
    })
    .from(jobSessions)
    .innerJoin(jobs, eq(jobSessions.jobId, jobs.id))
    .where(
      and(
        eq(jobs.studioId, studioId),
        inArray(jobs.clientId, clientIds),
        gt(jobSessions.startsAt, now),
      ),
    )
    .groupBy(jobs.clientId);

  const jobCountByClient = new Map(
    jobCountRows.map((r) => [r.clientId, Number(r.jobCount)]),
  );
  const paidByClient = new Map(
    paidRows.map((r) => [r.clientId, Number(r.lifetimePaid) || 0]),
  );
  const nextByClient = new Map(
    nextSessionRows.map((r) => [
      r.clientId,
      r.nextSessionAt ? r.nextSessionAt.toISOString() : null,
    ]),
  );

  return items.map((client) => {
    const jobCount = jobCountByClient.get(client.id) ?? 0;
    const lifetimePaid = paidByClient.get(client.id) ?? 0;
    const nextSessionAt = nextByClient.get(client.id) ?? null;
    return {
      ...client,
      jobCount,
      lifetimePaid,
      soon: nextSessionAt != null,
      cameBack: jobCount >= 2,
      nextSessionAt,
    };
  });
}

export async function listClients(params: {
  studioId: number;
  page: number;
  pageSize: number;
  search?: string;
  includeRetired?: boolean;
}) {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const conditions: SQL[] = [eq(clients.studioId, params.studioId)];

  if (!params.includeRetired) {
    conditions.push(isNull(clients.retiredAt));
  }

  if (params.search) {
    const term = `%${params.search}%`;
    const searchCondition = or(
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
    .from(clients)
    .where(where);

  const total = Number(totalResult[0]?.total ?? 0);

  const items = await db
    .select()
    .from(clients)
    .where(where)
    .orderBy(clients.name)
    .limit(pageSize)
    .offset(offset);

  const withStats = await attachClientStats(params.studioId, items);

  return {
    items: withStats,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    },
  };
}

export async function getClient(studioId: number, id: number) {
  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.studioId, studioId)))
    .limit(1);

  const row = rows[0] ?? null;
  if (!row) return null;
  const [withStats] = await attachClientStats(studioId, [row]);
  return withStats ?? null;
}

export async function createClient(
  studioId: number,
  input: {
    name: string;
    phone?: string | null;
    email?: string | null;
    nricOrSsm?: string | null;
    tin?: string | null;
    socialHandle?: string | null;
    address?: string | null;
    whatsappConsent?: boolean;
  },
) {
  const name = input.name.trim();
  if (!name) {
    throw new ClientServiceError("Name is required.", 400);
  }

  const email = emptyToNull(input.email);

  const result = await db.insert(clients).values({
    studioId,
    name,
    phone: emptyToNull(input.phone),
    email,
    nricOrSsm: emptyToNull(input.nricOrSsm),
    tin: emptyToNull(input.tin),
    socialHandle: emptyToNull(input.socialHandle),
    address: emptyToNull(input.address),
    whatsappConsent: input.whatsappConsent ?? false,
  });

  const created = await getClient(studioId, result[0].insertId);
  if (!created) {
    throw new ClientServiceError("Failed to create client.", 500);
  }
  return created;
}

export async function updateClient(
  studioId: number,
  id: number,
  input: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    nricOrSsm?: string | null;
    tin?: string | null;
    socialHandle?: string | null;
    address?: string | null;
    whatsappConsent?: boolean;
  },
) {
  const existing = await getClient(studioId, id);
  if (!existing) {
    throw new ClientServiceError("Client not found.", 404);
  }

  const updates: Partial<typeof clients.$inferInsert> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new ClientServiceError("Name cannot be empty.", 400);
    updates.name = name;
  }
  if (input.phone !== undefined) updates.phone = emptyToNull(input.phone);
  if (input.email !== undefined) updates.email = emptyToNull(input.email);
  if (input.nricOrSsm !== undefined)
    updates.nricOrSsm = emptyToNull(input.nricOrSsm);
  if (input.tin !== undefined) updates.tin = emptyToNull(input.tin);
  if (input.socialHandle !== undefined)
    updates.socialHandle = emptyToNull(input.socialHandle);
  if (input.address !== undefined) updates.address = emptyToNull(input.address);
  if (input.whatsappConsent !== undefined)
    updates.whatsappConsent = input.whatsappConsent;

  if (Object.keys(updates).length === 0) {
    throw new ClientServiceError("At least one field is required to update.", 400);
  }

  await db
    .update(clients)
    .set(updates)
    .where(and(eq(clients.id, id), eq(clients.studioId, studioId)));

  const updated = await getClient(studioId, id);
  if (!updated) throw new ClientServiceError("Client not found.", 404);
  return updated;
}

export async function softDeleteClient(studioId: number, id: number) {
  const existing = await getClient(studioId, id);
  if (!existing) {
    throw new ClientServiceError("Client not found.", 404);
  }
  if (existing.retiredAt) {
    return existing;
  }

  await db
    .update(clients)
    .set({ retiredAt: new Date() })
    .where(and(eq(clients.id, id), eq(clients.studioId, studioId)));

  const updated = await getClient(studioId, id);
  if (!updated) throw new ClientServiceError("Client not found.", 404);
  return updated;
}
