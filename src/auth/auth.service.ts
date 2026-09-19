import { and, eq } from "drizzle-orm";
import { db } from "../db/database.js";
import { users } from "../db/schema/users.js";
import { studioMembers } from "../db/schema/studio_members.js";
import { studios } from "../db/schema/studios.js";
import { verifyPassword } from "./password.js";
import { signAccessToken, type StudioAccess } from "./jwt.js";

export async function authenticateUser(email: string, password: string) {
  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = userResult[0];

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  if (user.status !== "ACTIVE") {
    throw new Error("User account is inactive.");
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);

  if (!passwordValid) {
    throw new Error("Invalid email or password.");
  }

  const membership = await getPrimaryStudioMembership(user.id);

  if (!membership) {
    throw new Error("No studio membership for this account.");
  }

  const accessToken = signAccessToken({
    userId: user.id,
    studioId: membership.studioId,
    access: membership.access,
  });

  return {
    accessToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
    },
    studio: membership.studio,
    access: membership.access,
  };
}

export async function getPrimaryStudioMembership(userId: number) {
  const rows = await db
    .select({
      studioId: studioMembers.studioId,
      access: studioMembers.access,
      studioName: studios.name,
      studioCurrency: studios.currency,
    })
    .from(studioMembers)
    .innerJoin(studios, eq(studioMembers.studioId, studios.id))
    .where(eq(studioMembers.userId, userId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    studioId: row.studioId,
    access: row.access as StudioAccess,
    studio: {
      id: row.studioId,
      name: row.studioName,
      currency: row.studioCurrency,
    },
  };
}

export async function getCurrentUserProfile(userId: number) {
  const userResult = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      status: users.status,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userResult[0];
  if (!user) return null;

  const membership = await getPrimaryStudioMembership(userId);

  return {
    user,
    studio: membership?.studio ?? null,
    access: membership?.access ?? null,
  };
}

/** Verify membership still matches token studio (optional hardening). */
export async function assertStudioMembership(
  userId: number,
  studioId: number,
) {
  const rows = await db
    .select({ id: studioMembers.id })
    .from(studioMembers)
    .where(
      and(
        eq(studioMembers.userId, userId),
        eq(studioMembers.studioId, studioId),
      ),
    )
    .limit(1);

  return Boolean(rows[0]);
}
