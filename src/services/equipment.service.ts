import { and, asc, count, eq, like, or, type SQL } from "drizzle-orm";
import { db } from "../db/database.js";
import { crewContacts } from "../db/schema/crew_contacts.js";
import { equipmentAssets } from "../db/schema/equipment_assets.js";
import { jobs } from "../db/schema/jobs.js";
import type { equipmentStatuses } from "../schemas/equipment.schema.js";

export class EquipmentServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "EquipmentServiceError";
  }
}

export type EquipmentRecord = typeof equipmentAssets.$inferSelect;

type EquipmentStatus = (typeof equipmentStatuses)[number];

type EquipmentInput = {
  name?: string;
  category?: string | null;
  serial?: string | null;
  status?: EquipmentStatus;
  notes?: string | null;
  jobId?: number | null;
  crewContactId?: number | null;
};

function emptyToNull(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

async function assertJobInStudio(studioId: number, jobId: number) {
  const rows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.studioId, studioId)))
    .limit(1);
  if (!rows[0]) {
    throw new EquipmentServiceError("Job not found for this studio.", 400);
  }
}

async function assertCrewContactInStudio(studioId: number, crewId: number) {
  const rows = await db
    .select({ id: crewContacts.id })
    .from(crewContacts)
    .where(
      and(eq(crewContacts.id, crewId), eq(crewContacts.studioId, studioId)),
    )
    .limit(1);
  if (!rows[0]) {
    throw new EquipmentServiceError(
      "Crew contact not found for this studio.",
      400,
    );
  }
}

export async function listEquipment(params: {
  studioId: number;
  page: number;
  pageSize: number;
  search?: string;
  status?: EquipmentStatus;
}) {
  const page = Math.max(1, params.page);
  const pageSize = Math.min(100, Math.max(1, params.pageSize));
  const conditions: SQL[] = [eq(equipmentAssets.studioId, params.studioId)];

  if (params.status) {
    conditions.push(eq(equipmentAssets.status, params.status));
  }

  if (params.search) {
    const term = `%${params.search}%`;
    const searchCondition = or(
      like(equipmentAssets.name, term),
      like(equipmentAssets.category, term),
      like(equipmentAssets.serial, term),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const where = and(...conditions);
  const offset = (page - 1) * pageSize;

  const totalResult = await db
    .select({ total: count() })
    .from(equipmentAssets)
    .where(where);

  const total = Number(totalResult[0]?.total ?? 0);

  const items = await db
    .select()
    .from(equipmentAssets)
    .where(where)
    .orderBy(asc(equipmentAssets.name), asc(equipmentAssets.id))
    .limit(pageSize)
    .offset(offset);

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

export async function getEquipment(studioId: number, id: number) {
  const rows = await db
    .select()
    .from(equipmentAssets)
    .where(
      and(eq(equipmentAssets.id, id), eq(equipmentAssets.studioId, studioId)),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function createEquipment(studioId: number, input: EquipmentInput) {
  const name = (input.name ?? "").trim();
  if (!name) {
    throw new EquipmentServiceError("Name is required.", 400);
  }

  if (input.jobId) await assertJobInStudio(studioId, input.jobId);
  if (input.crewContactId) {
    await assertCrewContactInStudio(studioId, input.crewContactId);
  }

  const result = await db.insert(equipmentAssets).values({
    studioId,
    name,
    category: emptyToNull(input.category),
    serial: emptyToNull(input.serial),
    status: input.status ?? "IN_STUDIO",
    notes: emptyToNull(input.notes),
    jobId: input.jobId ?? null,
    crewContactId: input.crewContactId ?? null,
  });

  const created = await getEquipment(studioId, result[0].insertId);
  if (!created) {
    throw new EquipmentServiceError("Failed to create equipment asset.", 500);
  }
  return created;
}

export async function updateEquipment(
  studioId: number,
  id: number,
  input: EquipmentInput,
) {
  const existing = await getEquipment(studioId, id);
  if (!existing) {
    throw new EquipmentServiceError("Equipment asset not found.", 404);
  }

  if (input.jobId) await assertJobInStudio(studioId, input.jobId);
  if (input.crewContactId) {
    await assertCrewContactInStudio(studioId, input.crewContactId);
  }

  const updates: Partial<typeof equipmentAssets.$inferInsert> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new EquipmentServiceError("Name cannot be empty.", 400);
    updates.name = name;
  }
  if (input.category !== undefined)
    updates.category = emptyToNull(input.category);
  if (input.serial !== undefined) updates.serial = emptyToNull(input.serial);
  if (input.status !== undefined) updates.status = input.status;
  if (input.notes !== undefined) updates.notes = emptyToNull(input.notes);
  if (input.jobId !== undefined) updates.jobId = input.jobId ?? null;
  if (input.crewContactId !== undefined)
    updates.crewContactId = input.crewContactId ?? null;

  if (Object.keys(updates).length === 0) {
    throw new EquipmentServiceError(
      "At least one field is required to update.",
      400,
    );
  }

  await db
    .update(equipmentAssets)
    .set(updates)
    .where(
      and(eq(equipmentAssets.id, id), eq(equipmentAssets.studioId, studioId)),
    );

  const updated = await getEquipment(studioId, id);
  if (!updated) {
    throw new EquipmentServiceError("Equipment asset not found.", 404);
  }
  return updated;
}

export async function deleteEquipment(studioId: number, id: number) {
  const existing = await getEquipment(studioId, id);
  if (!existing) {
    throw new EquipmentServiceError("Equipment asset not found.", 404);
  }

  await db
    .delete(equipmentAssets)
    .where(
      and(eq(equipmentAssets.id, id), eq(equipmentAssets.studioId, studioId)),
    );

  return { id, deleted: true as const };
}
