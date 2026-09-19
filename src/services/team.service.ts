import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db/database.js";
import { users } from "../db/schema/users.js";
import { roles } from "../db/schema/roles.js";
import { userRoles } from "../db/schema/user_roles.js";
import {
  studioMembers,
  studioMemberCrafts,
} from "../db/schema/studio_members.js";
import {
  crewContacts,
  crewContactCrafts,
} from "../db/schema/crew_contacts.js";
import {
  optionItems,
  optionLists,
} from "../db/schema/option_lists.js";
import { hashPassword } from "../auth/password.js";
import type { StudioAccess } from "../auth/jwt.js";

export class TeamServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "TeamServiceError";
  }
}

function emptyToNull(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

type CraftSummary = { id: number; label: string };

async function assertCraftItemIds(studioId: number, ids: number[]) {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;

  const rows = await db
    .select({ id: optionItems.id })
    .from(optionItems)
    .innerJoin(optionLists, eq(optionItems.listId, optionLists.id))
    .where(
      and(
        eq(optionLists.studioId, studioId),
        eq(optionLists.key, "CRAFT"),
        inArray(optionItems.id, unique),
        isNull(optionItems.retiredAt),
      ),
    );

  if (rows.length !== unique.length) {
    throw new TeamServiceError(
      "One or more craft items are invalid for this studio.",
      400,
    );
  }
}

async function getMemberCrafts(
  memberIds: number[],
): Promise<Map<number, CraftSummary[]>> {
  const map = new Map<number, CraftSummary[]>();
  if (memberIds.length === 0) return map;

  const rows = await db
    .select({
      memberId: studioMemberCrafts.studioMemberId,
      id: optionItems.id,
      label: optionItems.label,
    })
    .from(studioMemberCrafts)
    .innerJoin(optionItems, eq(studioMemberCrafts.optionItemId, optionItems.id))
    .where(inArray(studioMemberCrafts.studioMemberId, memberIds));

  for (const row of rows) {
    const list = map.get(row.memberId) ?? [];
    list.push({ id: row.id, label: row.label });
    map.set(row.memberId, list);
  }
  return map;
}

async function getCrewCrafts(
  crewIds: number[],
): Promise<Map<number, CraftSummary[]>> {
  const map = new Map<number, CraftSummary[]>();
  if (crewIds.length === 0) return map;

  const rows = await db
    .select({
      crewId: crewContactCrafts.crewContactId,
      id: optionItems.id,
      label: optionItems.label,
    })
    .from(crewContactCrafts)
    .innerJoin(optionItems, eq(crewContactCrafts.optionItemId, optionItems.id))
    .where(inArray(crewContactCrafts.crewContactId, crewIds));

  for (const row of rows) {
    const list = map.get(row.crewId) ?? [];
    list.push({ id: row.id, label: row.label });
    map.set(row.crewId, list);
  }
  return map;
}

async function resolvePlatformRoleName(
  access: "ADMIN" | "MEMBER",
): Promise<number> {
  const roleName = access === "ADMIN" ? "ADMIN" : "MANAGER";
  const rows = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.name, roleName))
    .limit(1);
  const role = rows[0];
  if (!role) {
    throw new TeamServiceError(`Platform role ${roleName} not found.`, 500);
  }
  return role.id;
}

export async function listTeamMembers(studioId: number) {
  const rows = await db
    .select({
      id: studioMembers.id,
      studioId: studioMembers.studioId,
      userId: studioMembers.userId,
      access: studioMembers.access,
      createdAt: studioMembers.createdAt,
      updatedAt: studioMembers.updatedAt,
      name: users.name,
      email: users.email,
      phone: users.phone,
      status: users.status,
    })
    .from(studioMembers)
    .innerJoin(users, eq(studioMembers.userId, users.id))
    .where(eq(studioMembers.studioId, studioId))
    .orderBy(asc(studioMembers.id));

  const craftsByMember = await getMemberCrafts(rows.map((r) => r.id));

  return rows.map((row) => ({
    id: row.id,
    studioId: row.studioId,
    userId: row.userId,
    access: row.access as StudioAccess,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    crafts: craftsByMember.get(row.id) ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function getTeamMember(studioId: number, memberId: number) {
  const members = await listTeamMembers(studioId);
  return members.find((m) => m.id === memberId) ?? null;
}

export async function createTeamMember(
  studioId: number,
  input: {
    name: string;
    email: string;
    password: string;
    phone?: string | null;
    access: "ADMIN" | "MEMBER";
    craftItemIds?: number[];
  },
) {
  const email = input.email.trim().toLowerCase();
  const craftItemIds = [...new Set(input.craftItemIds ?? [])];
  await assertCraftItemIds(studioId, craftItemIds);

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) {
    throw new TeamServiceError("A user with this email already exists.", 409);
  }

  const passwordHash = await hashPassword(input.password);
  const roleId = await resolvePlatformRoleName(input.access);

  const memberId = await db.transaction(async (tx) => {
    const userResult = await tx.insert(users).values({
      name: input.name.trim(),
      email,
      passwordHash,
      phone: emptyToNull(input.phone),
      status: "ACTIVE",
    });
    const userId = userResult[0].insertId;

    await tx.insert(userRoles).values({ userId, roleId });

    const memberResult = await tx.insert(studioMembers).values({
      studioId,
      userId,
      access: input.access,
    });
    const newMemberId = memberResult[0].insertId;

    if (craftItemIds.length > 0) {
      await tx.insert(studioMemberCrafts).values(
        craftItemIds.map((optionItemId) => ({
          studioMemberId: newMemberId,
          optionItemId,
        })),
      );
    }

    return newMemberId;
  });

  const created = await getTeamMember(studioId, memberId);
  if (!created) throw new TeamServiceError("Failed to create team member.", 500);
  return created;
}

export async function updateTeamMember(
  studioId: number,
  memberId: number,
  input: {
    name?: string;
    phone?: string | null;
    access?: "ADMIN" | "MEMBER";
    craftItemIds?: number[];
  },
) {
  const existing = await getTeamMember(studioId, memberId);
  if (!existing) {
    throw new TeamServiceError("Team member not found.", 404);
  }

  if (existing.access === "OWNER") {
    if (input.access !== undefined) {
      throw new TeamServiceError("Owner access cannot be changed.", 400);
    }
  }

  const craftItemIds =
    input.craftItemIds !== undefined
      ? [...new Set(input.craftItemIds)]
      : undefined;
  if (craftItemIds !== undefined) {
    await assertCraftItemIds(studioId, craftItemIds);
  }

  const nextAccess = input.access;
  const nextRoleId =
    nextAccess !== undefined && existing.access !== "OWNER"
      ? await resolvePlatformRoleName(nextAccess)
      : null;

  await db.transaction(async (tx) => {
    const userUpdates: Partial<typeof users.$inferInsert> = {};
    if (input.name !== undefined) userUpdates.name = input.name.trim();
    if (input.phone !== undefined) userUpdates.phone = emptyToNull(input.phone);

    if (Object.keys(userUpdates).length > 0) {
      await tx
        .update(users)
        .set(userUpdates)
        .where(eq(users.id, existing.userId));
    }

    if (nextAccess !== undefined && existing.access !== "OWNER" && nextRoleId) {
      await tx
        .update(studioMembers)
        .set({ access: nextAccess })
        .where(
          and(
            eq(studioMembers.id, memberId),
            eq(studioMembers.studioId, studioId),
          ),
        );

      await tx.delete(userRoles).where(eq(userRoles.userId, existing.userId));
      await tx.insert(userRoles).values({
        userId: existing.userId,
        roleId: nextRoleId,
      });
    }

    if (craftItemIds !== undefined) {
      await tx
        .delete(studioMemberCrafts)
        .where(eq(studioMemberCrafts.studioMemberId, memberId));
      if (craftItemIds.length > 0) {
        await tx.insert(studioMemberCrafts).values(
          craftItemIds.map((optionItemId) => ({
            studioMemberId: memberId,
            optionItemId,
          })),
        );
      }
    }
  });

  const updated = await getTeamMember(studioId, memberId);
  if (!updated) throw new TeamServiceError("Team member not found.", 404);
  return updated;
}

export async function removeTeamMember(studioId: number, memberId: number) {
  const existing = await getTeamMember(studioId, memberId);
  if (!existing) {
    throw new TeamServiceError("Team member not found.", 404);
  }
  if (existing.access === "OWNER") {
    throw new TeamServiceError("Cannot remove the studio owner.", 400);
  }

  await db
    .delete(studioMembers)
    .where(
      and(eq(studioMembers.id, memberId), eq(studioMembers.studioId, studioId)),
    );

  return { id: memberId, removed: true as const };
}

export async function listCrewContacts(
  studioId: number,
  includeRetired = false,
) {
  const conditions = [eq(crewContacts.studioId, studioId)];
  if (!includeRetired) {
    conditions.push(isNull(crewContacts.retiredAt));
  }

  const rows = await db
    .select()
    .from(crewContacts)
    .where(and(...conditions))
    .orderBy(asc(crewContacts.name));

  const craftsByCrew = await getCrewCrafts(rows.map((r) => r.id));

  return rows.map((row) => ({
    ...row,
    crafts: craftsByCrew.get(row.id) ?? [],
  }));
}

export async function getCrewContact(studioId: number, id: number) {
  const rows = await db
    .select()
    .from(crewContacts)
    .where(and(eq(crewContacts.id, id), eq(crewContacts.studioId, studioId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const crafts = await getCrewCrafts([row.id]);
  return { ...row, crafts: crafts.get(row.id) ?? [] };
}

export async function createCrewContact(
  studioId: number,
  input: {
    name: string;
    phone?: string | null;
    email?: string | null;
    craftItemIds?: number[];
  },
) {
  const craftItemIds = [...new Set(input.craftItemIds ?? [])];
  await assertCraftItemIds(studioId, craftItemIds);

  const result = await db.insert(crewContacts).values({
    studioId,
    name: input.name.trim(),
    phone: emptyToNull(input.phone),
    email: emptyToNull(input.email),
  });
  const id = result[0].insertId;

  if (craftItemIds.length > 0) {
    await db.insert(crewContactCrafts).values(
      craftItemIds.map((optionItemId) => ({
        crewContactId: id,
        optionItemId,
      })),
    );
  }

  const created = await getCrewContact(studioId, id);
  if (!created) throw new TeamServiceError("Failed to create crew contact.", 500);
  return created;
}

export async function updateCrewContact(
  studioId: number,
  id: number,
  input: {
    name?: string;
    phone?: string | null;
    email?: string | null;
    craftItemIds?: number[];
    retired?: boolean;
  },
) {
  const existing = await getCrewContact(studioId, id);
  if (!existing) {
    throw new TeamServiceError("Crew contact not found.", 404);
  }

  const craftItemIds =
    input.craftItemIds !== undefined
      ? [...new Set(input.craftItemIds)]
      : undefined;
  if (craftItemIds !== undefined) {
    await assertCraftItemIds(studioId, craftItemIds);
  }

  const updates: Partial<typeof crewContacts.$inferInsert> = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.phone !== undefined) updates.phone = emptyToNull(input.phone);
  if (input.email !== undefined) updates.email = emptyToNull(input.email);
  if (input.retired === true) updates.retiredAt = new Date();
  if (input.retired === false) updates.retiredAt = null;

  await db.transaction(async (tx) => {
    if (Object.keys(updates).length > 0) {
      await tx
        .update(crewContacts)
        .set(updates)
        .where(and(eq(crewContacts.id, id), eq(crewContacts.studioId, studioId)));
    }

    if (craftItemIds !== undefined) {
      await tx
        .delete(crewContactCrafts)
        .where(eq(crewContactCrafts.crewContactId, id));
      if (craftItemIds.length > 0) {
        await tx.insert(crewContactCrafts).values(
          craftItemIds.map((optionItemId) => ({
            crewContactId: id,
            optionItemId,
          })),
        );
      }
    }
  });

  const updated = await getCrewContact(studioId, id);
  if (!updated) throw new TeamServiceError("Crew contact not found.", 404);
  return updated;
}

export async function softDeleteCrewContact(studioId: number, id: number) {
  return updateCrewContact(studioId, id, { retired: true });
}
