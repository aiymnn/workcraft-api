import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  like,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { db } from "../db/database.js";
import { clients } from "../db/schema/clients.js";
import { quotations } from "../db/schema/quotations.js";
import { studioMembers } from "../db/schema/studio_members.js";
import { crewContacts } from "../db/schema/crew_contacts.js";
import {
  jobChecklistItems,
  jobContracts,
  jobDeliverables,
  jobSessions,
  jobs,
  sessionCrew,
} from "../db/schema/jobs.js";

export class JobServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "JobServiceError";
  }
}

type CrewInput = {
  studioMemberId?: number | null;
  crewContactId?: number | null;
  crewRoleItemId?: number | null;
};

type SessionInput = {
  ceremonyTypeItemId?: number | null;
  label?: string | null;
  startsAt: string;
  endsAt?: string | null;
  venue?: string | null;
  crew?: CrewInput[];
};

type ChecklistInput = {
  label: string;
  phase: "BEFORE" | "ON_DAY" | "AFTER";
  done?: boolean;
  sortOrder?: number;
};

type DeliverableInput = {
  title: string;
  status?: "PENDING" | "IN_PROGRESS" | "DELIVERED";
  clientVisible?: boolean;
  url?: string | null;
  sortOrder?: number;
};

type ContractInput = {
  name: string;
  body: string;
  status?: "DRAFT" | "SENT" | "SIGNED";
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function emptyToNull(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function parseDate(value: string | null | undefined, required = false): Date | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new JobServiceError("Session start time is required.", 400);
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new JobServiceError("Invalid date value.", 400);
  }
  return date;
}

export function formatJobNumber(id: number, at = new Date()) {
  return `JOB-${at.getFullYear()}-${String(id).padStart(4, "0")}`;
}

async function assertClientInStudio(studioId: number, clientId: number) {
  const rows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.studioId, studioId)))
    .limit(1);
  if (!rows[0]) {
    throw new JobServiceError("Client not found in this studio.", 400);
  }
}

async function assertQuotationInStudio(
  studioId: number,
  quotationId: number | null | undefined,
) {
  if (quotationId == null) return;
  const rows = await db
    .select({ id: quotations.id })
    .from(quotations)
    .where(
      and(eq(quotations.id, quotationId), eq(quotations.studioId, studioId)),
    )
    .limit(1);
  if (!rows[0]) {
    throw new JobServiceError("Quotation not found in this studio.", 400);
  }
}

async function assertCrewRefs(studioId: number, crew: CrewInput[]) {
  for (const row of crew) {
    if (row.studioMemberId != null) {
      const members = await db
        .select({ id: studioMembers.id })
        .from(studioMembers)
        .where(
          and(
            eq(studioMembers.id, row.studioMemberId),
            eq(studioMembers.studioId, studioId),
          ),
        )
        .limit(1);
      if (!members[0]) {
        throw new JobServiceError("Studio member not found for crew row.", 400);
      }
    }
    if (row.crewContactId != null) {
      const contacts = await db
        .select({ id: crewContacts.id })
        .from(crewContacts)
        .where(
          and(
            eq(crewContacts.id, row.crewContactId),
            eq(crewContacts.studioId, studioId),
          ),
        )
        .limit(1);
      if (!contacts[0]) {
        throw new JobServiceError("Crew contact not found for crew row.", 400);
      }
    }
  }
}

async function insertSessions(
  jobId: number,
  sessions: SessionInput[],
  studioId: number,
  tx: Tx,
) {
  for (const session of sessions) {
    await assertCrewRefs(studioId, session.crew ?? []);
    const result = await tx.insert(jobSessions).values({
      jobId,
      ceremonyTypeItemId: session.ceremonyTypeItemId ?? null,
      label: emptyToNull(session.label),
      startsAt: parseDate(session.startsAt, true)!,
      endsAt: parseDate(session.endsAt),
      venue: emptyToNull(session.venue),
    });
    const sessionId = result[0].insertId;
    const crew = session.crew ?? [];
    if (crew.length > 0) {
      await tx.insert(sessionCrew).values(
        crew.map((row) => ({
          sessionId,
          studioMemberId: row.studioMemberId ?? null,
          crewContactId: row.crewContactId ?? null,
          crewRoleItemId: row.crewRoleItemId ?? null,
        })),
      );
    }
  }
}

async function insertChecklist(
  jobId: number,
  items: ChecklistInput[],
  tx: Tx,
) {
  if (items.length === 0) return;
  await tx.insert(jobChecklistItems).values(
    items.map((item, index) => ({
      jobId,
      label: item.label.trim(),
      phase: item.phase,
      doneAt: item.done ? new Date() : null,
      sortOrder: item.sortOrder ?? index,
    })),
  );
}

async function insertDeliverables(
  jobId: number,
  items: DeliverableInput[],
  tx: Tx,
) {
  if (items.length === 0) return;
  await tx.insert(jobDeliverables).values(
    items.map((item, index) => ({
      jobId,
      title: item.title.trim(),
      status: item.status ?? "PENDING",
      clientVisible: item.clientVisible ?? false,
      url: emptyToNull(item.url),
      sortOrder: item.sortOrder ?? index,
    })),
  );
}

async function insertContracts(
  jobId: number,
  items: ContractInput[],
  tx: Tx,
) {
  if (items.length === 0) return;
  await tx.insert(jobContracts).values(
    items.map((item) => ({
      jobId,
      name: item.name.trim(),
      body: item.body,
      status: item.status ?? "DRAFT",
    })),
  );
}

async function loadNested(jobIds: number[]) {
  const sessionsByJob = new Map<number, (typeof jobSessions.$inferSelect)[]>();
  const crewBySession = new Map<number, (typeof sessionCrew.$inferSelect)[]>();
  const checklistByJob = new Map<
    number,
    (typeof jobChecklistItems.$inferSelect)[]
  >();
  const deliverablesByJob = new Map<
    number,
    (typeof jobDeliverables.$inferSelect)[]
  >();
  const contractsByJob = new Map<number, (typeof jobContracts.$inferSelect)[]>();

  if (jobIds.length === 0) {
    return {
      sessionsByJob,
      crewBySession,
      checklistByJob,
      deliverablesByJob,
      contractsByJob,
    };
  }

  const [sessions, checklists, deliverables, contracts] = await Promise.all([
    db
      .select()
      .from(jobSessions)
      .where(inArray(jobSessions.jobId, jobIds))
      .orderBy(asc(jobSessions.startsAt), asc(jobSessions.id)),
    db
      .select()
      .from(jobChecklistItems)
      .where(inArray(jobChecklistItems.jobId, jobIds))
      .orderBy(asc(jobChecklistItems.sortOrder), asc(jobChecklistItems.id)),
    db
      .select()
      .from(jobDeliverables)
      .where(inArray(jobDeliverables.jobId, jobIds))
      .orderBy(asc(jobDeliverables.sortOrder), asc(jobDeliverables.id)),
    db
      .select()
      .from(jobContracts)
      .where(inArray(jobContracts.jobId, jobIds))
      .orderBy(asc(jobContracts.id)),
  ]);

  for (const row of sessions) {
    const list = sessionsByJob.get(row.jobId) ?? [];
    list.push(row);
    sessionsByJob.set(row.jobId, list);
  }
  for (const row of checklists) {
    const list = checklistByJob.get(row.jobId) ?? [];
    list.push(row);
    checklistByJob.set(row.jobId, list);
  }
  for (const row of deliverables) {
    const list = deliverablesByJob.get(row.jobId) ?? [];
    list.push(row);
    deliverablesByJob.set(row.jobId, list);
  }
  for (const row of contracts) {
    const list = contractsByJob.get(row.jobId) ?? [];
    list.push(row);
    contractsByJob.set(row.jobId, list);
  }

  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length > 0) {
    const crewRows = await db
      .select()
      .from(sessionCrew)
      .where(inArray(sessionCrew.sessionId, sessionIds))
      .orderBy(asc(sessionCrew.id));
    for (const row of crewRows) {
      const list = crewBySession.get(row.sessionId) ?? [];
      list.push(row);
      crewBySession.set(row.sessionId, list);
    }
  }

  return {
    sessionsByJob,
    crewBySession,
    checklistByJob,
    deliverablesByJob,
    contractsByJob,
  };
}

function attachDetail(
  job: typeof jobs.$inferSelect,
  client: {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
  } | null,
  nested: Awaited<ReturnType<typeof loadNested>>,
) {
  const sessions = (nested.sessionsByJob.get(job.id) ?? []).map((session) => ({
    ...session,
    crew: nested.crewBySession.get(session.id) ?? [],
  }));

  return {
    ...job,
    client,
    sessions,
    checklistItems: nested.checklistByJob.get(job.id) ?? [],
    deliverables: nested.deliverablesByJob.get(job.id) ?? [],
    contracts: nested.contractsByJob.get(job.id) ?? [],
    sessionsCount: sessions.length,
    nextSessionAt: sessions[0]?.startsAt ?? null,
  };
}

export async function listJobs(params: {
  studioId: number;
  page: number;
  pageSize: number;
  status?: (typeof jobs.$inferSelect)["status"];
  search?: string;
}) {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const conditions: SQL[] = [eq(jobs.studioId, params.studioId)];

  if (params.status) conditions.push(eq(jobs.status, params.status));

  if (params.search) {
    const term = `%${params.search}%`;
    const searchCondition = or(
      like(jobs.number, term),
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
    .from(jobs)
    .innerJoin(clients, eq(jobs.clientId, clients.id))
    .where(where);
  const total = Number(totalResult[0]?.total ?? 0);

  const rows = await db
    .select({
      job: jobs,
      clientId: clients.id,
      clientName: clients.name,
      clientPhone: clients.phone,
      clientEmail: clients.email,
    })
    .from(jobs)
    .innerJoin(clients, eq(jobs.clientId, clients.id))
    .where(where)
    .orderBy(desc(jobs.id))
    .limit(pageSize)
    .offset(offset);

  const nested = await loadNested(rows.map((r) => r.job.id));
  const items = rows.map((row) =>
    attachDetail(
      row.job,
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

export async function getJob(studioId: number, id: number) {
  const rows = await db
    .select({
      job: jobs,
      clientId: clients.id,
      clientName: clients.name,
      clientPhone: clients.phone,
      clientEmail: clients.email,
    })
    .from(jobs)
    .innerJoin(clients, eq(jobs.clientId, clients.id))
    .where(and(eq(jobs.id, id), eq(jobs.studioId, studioId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const nested = await loadNested([row.job.id]);
  return attachDetail(
    row.job,
    {
      id: row.clientId,
      name: row.clientName,
      phone: row.clientPhone,
      email: row.clientEmail,
    },
    nested,
  );
}

export async function createJob(
  studioId: number,
  input: {
    clientId: number;
    quotationId?: number | null;
    status?: "CONFIRMED" | "COMPLETED" | "CANCELLED";
    jobTypeItemId?: number | null;
    leadSourceItemId?: number | null;
    cancelReasonItemId?: number | null;
    notes?: string | null;
    sessions?: SessionInput[];
    checklistItems?: ChecklistInput[];
    deliverables?: DeliverableInput[];
    contracts?: ContractInput[];
  },
) {
  await assertClientInStudio(studioId, input.clientId);
  await assertQuotationInStudio(studioId, input.quotationId);

  const jobId = await db.transaction(async (tx) => {
    const result = await tx.insert(jobs).values({
      studioId,
      clientId: input.clientId,
      quotationId: input.quotationId ?? null,
      status: input.status ?? "CONFIRMED",
      jobTypeItemId: input.jobTypeItemId ?? null,
      leadSourceItemId: input.leadSourceItemId ?? null,
      cancelReasonItemId: input.cancelReasonItemId ?? null,
      notes: emptyToNull(input.notes),
    });
    const id = result[0].insertId;
    await tx
      .update(jobs)
      .set({ number: formatJobNumber(id) })
      .where(eq(jobs.id, id));

    await insertSessions(id, input.sessions ?? [], studioId, tx);
    await insertChecklist(id, input.checklistItems ?? [], tx);
    await insertDeliverables(id, input.deliverables ?? [], tx);
    await insertContracts(id, input.contracts ?? [], tx);
    return id;
  });

  const created = await getJob(studioId, jobId);
  if (!created) throw new JobServiceError("Failed to create job.", 500);
  return created;
}

export async function updateJob(
  studioId: number,
  id: number,
  input: {
    clientId?: number;
    quotationId?: number | null;
    status?: "CONFIRMED" | "COMPLETED" | "CANCELLED";
    jobTypeItemId?: number | null;
    leadSourceItemId?: number | null;
    cancelReasonItemId?: number | null;
    notes?: string | null;
    sessions?: SessionInput[];
    checklistItems?: ChecklistInput[];
    deliverables?: DeliverableInput[];
    contracts?: ContractInput[];
  },
) {
  const existing = await getJob(studioId, id);
  if (!existing) throw new JobServiceError("Job not found.", 404);

  if (input.clientId !== undefined) {
    await assertClientInStudio(studioId, input.clientId);
  }
  if (input.quotationId !== undefined) {
    await assertQuotationInStudio(studioId, input.quotationId);
  }

  const hasNested =
    input.sessions !== undefined ||
    input.checklistItems !== undefined ||
    input.deliverables !== undefined ||
    input.contracts !== undefined;

  const updates: Partial<typeof jobs.$inferInsert> = {};
  if (input.clientId !== undefined) updates.clientId = input.clientId;
  if (input.quotationId !== undefined) updates.quotationId = input.quotationId;
  if (input.status !== undefined) updates.status = input.status;
  if (input.jobTypeItemId !== undefined)
    updates.jobTypeItemId = input.jobTypeItemId;
  if (input.leadSourceItemId !== undefined)
    updates.leadSourceItemId = input.leadSourceItemId;
  if (input.cancelReasonItemId !== undefined)
    updates.cancelReasonItemId = input.cancelReasonItemId;
  if (input.notes !== undefined) updates.notes = emptyToNull(input.notes);

  if (Object.keys(updates).length === 0 && !hasNested) {
    throw new JobServiceError("At least one field is required to update.", 400);
  }

  await db.transaction(async (tx) => {
    if (Object.keys(updates).length > 0) {
      await tx
        .update(jobs)
        .set(updates)
        .where(and(eq(jobs.id, id), eq(jobs.studioId, studioId)));
    }

    if (hasNested) {
      // Replace only provided collections; clear all then reinsert provided ones
      // and leave omitted collections untouched via selective clear
      if (input.sessions !== undefined) {
        const sessionRows = await tx
          .select({ id: jobSessions.id })
          .from(jobSessions)
          .where(eq(jobSessions.jobId, id));
        const sessionIds = sessionRows.map((s) => s.id);
        if (sessionIds.length > 0) {
          await tx
            .delete(sessionCrew)
            .where(inArray(sessionCrew.sessionId, sessionIds));
        }
        await tx.delete(jobSessions).where(eq(jobSessions.jobId, id));
        await insertSessions(id, input.sessions, studioId, tx);
      }
      if (input.checklistItems !== undefined) {
        await tx
          .delete(jobChecklistItems)
          .where(eq(jobChecklistItems.jobId, id));
        await insertChecklist(id, input.checklistItems, tx);
      }
      if (input.deliverables !== undefined) {
        await tx.delete(jobDeliverables).where(eq(jobDeliverables.jobId, id));
        await insertDeliverables(id, input.deliverables, tx);
      }
      if (input.contracts !== undefined) {
        await tx.delete(jobContracts).where(eq(jobContracts.jobId, id));
        await insertContracts(id, input.contracts, tx);
      }
    }
  });

  const updated = await getJob(studioId, id);
  if (!updated) throw new JobServiceError("Job not found.", 404);
  return updated;
}

export async function deleteJob(studioId: number, id: number) {
  const existing = await getJob(studioId, id);
  if (!existing) throw new JobServiceError("Job not found.", 404);
  await db
    .delete(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.studioId, studioId)));
  return { id, deleted: true as const };
}

export async function patchChecklistItem(
  studioId: number,
  jobId: number,
  itemId: number,
  input: {
    done?: boolean;
    label?: string;
    phase?: "BEFORE" | "ON_DAY" | "AFTER";
    sortOrder?: number;
  },
) {
  const job = await getJob(studioId, jobId);
  if (!job) throw new JobServiceError("Job not found.", 404);

  const item = job.checklistItems.find((i) => i.id === itemId);
  if (!item) throw new JobServiceError("Checklist item not found.", 404);

  const updates: Partial<typeof jobChecklistItems.$inferInsert> = {};
  if (input.label !== undefined) updates.label = input.label.trim();
  if (input.phase !== undefined) updates.phase = input.phase;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.done === true) updates.doneAt = new Date();
  if (input.done === false) updates.doneAt = null;

  if (Object.keys(updates).length === 0) {
    throw new JobServiceError("At least one field is required to update.", 400);
  }

  await db
    .update(jobChecklistItems)
    .set(updates)
    .where(
      and(
        eq(jobChecklistItems.id, itemId),
        eq(jobChecklistItems.jobId, jobId),
      ),
    );

  return getJob(studioId, jobId);
}

export async function patchDeliverable(
  studioId: number,
  jobId: number,
  deliverableId: number,
  input: {
    title?: string;
    status?: "PENDING" | "IN_PROGRESS" | "DELIVERED";
    clientVisible?: boolean;
    url?: string | null;
    sortOrder?: number;
  },
) {
  const job = await getJob(studioId, jobId);
  if (!job) throw new JobServiceError("Job not found.", 404);

  const item = job.deliverables.find((d) => d.id === deliverableId);
  if (!item) throw new JobServiceError("Deliverable not found.", 404);

  const updates: Partial<typeof jobDeliverables.$inferInsert> = {};
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.status !== undefined) updates.status = input.status;
  if (input.clientVisible !== undefined)
    updates.clientVisible = input.clientVisible;
  if (input.url !== undefined) updates.url = emptyToNull(input.url);
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

  if (Object.keys(updates).length === 0) {
    throw new JobServiceError("At least one field is required to update.", 400);
  }

  await db
    .update(jobDeliverables)
    .set(updates)
    .where(
      and(
        eq(jobDeliverables.id, deliverableId),
        eq(jobDeliverables.jobId, jobId),
      ),
    );

  return getJob(studioId, jobId);
}

/** Calendar read: sessions in [from, to] inclusive window. */
export async function listCalendarSessions(params: {
  studioId: number;
  from: Date;
  to: Date;
}) {
  if (params.from.getTime() > params.to.getTime()) {
    throw new JobServiceError("`from` must be before or equal to `to`.", 400);
  }

  const rows = await db
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
        eq(jobs.studioId, params.studioId),
        gte(jobSessions.startsAt, params.from),
        lte(jobSessions.startsAt, params.to),
      ),
    )
    .orderBy(asc(jobSessions.startsAt), asc(jobSessions.id));

  const sessionIds = rows.map((r) => r.session.id);
  const crewBySession = new Map<number, (typeof sessionCrew.$inferSelect)[]>();
  if (sessionIds.length > 0) {
    const crewRows = await db
      .select()
      .from(sessionCrew)
      .where(inArray(sessionCrew.sessionId, sessionIds));
    for (const row of crewRows) {
      const list = crewBySession.get(row.sessionId) ?? [];
      list.push(row);
      crewBySession.set(row.sessionId, list);
    }
  }

  return rows.map((row) => ({
    ...row.session,
    crew: crewBySession.get(row.session.id) ?? [],
    job: {
      id: row.jobId,
      number: row.jobNumber,
      status: row.jobStatus,
    },
    client: {
      id: row.clientId,
      name: row.clientName,
    },
  }));
}
