import { and, eq } from "drizzle-orm";
import { db } from "../db/database.js";
import { users } from "../db/schema/users.js";
import { studioMembers } from "../db/schema/studio_members.js";
import { studios } from "../db/schema/studios.js";
import { verifyPassword } from "./password.js";
import {
  accessTokenLifetimeSeconds,
  signAccessToken,
  signTwoFactorToken,
  verifyTwoFactorToken,
  type StudioAccess,
} from "./jwt.js";
import { createUserSession } from "./session.service.js";
import { verifyTotpCode } from "../lib/totp.js";

export interface LoginContext {
  userAgent?: string | null;
  ipAddress?: string | null;
}

type LoginUser = typeof users.$inferSelect;

export interface FullLoginResult {
  accessToken: string;
  user: {
    id: number;
    name: string;
    email: string;
    phone: string | null;
    status: "ACTIVE" | "INACTIVE";
  };
  studio: { id: number; name: string; currency: string };
  access: StudioAccess;
}

export interface TwoFactorChallengeResult {
  requires2fa: true;
  tempToken: string;
}

/** Issues the real JWT and records the session behind its `sid` claim. */
async function completeLogin(
  user: LoginUser,
  membership: NonNullable<Awaited<ReturnType<typeof getPrimaryStudioMembership>>>,
  context: LoginContext = {},
): Promise<FullLoginResult> {
  const lifetimeSeconds = accessTokenLifetimeSeconds();
  const { sessionId } = await createUserSession({
    userId: user.id,
    expiresAt: new Date(Date.now() + lifetimeSeconds * 1000),
    userAgent: context.userAgent ?? null,
    ipAddress: context.ipAddress ?? null,
  });

  const accessToken = signAccessToken({
    userId: user.id,
    studioId: membership.studioId,
    access: membership.access,
    sid: sessionId,
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

export async function authenticateUser(
  email: string,
  password: string,
  context: LoginContext = {},
): Promise<FullLoginResult | TwoFactorChallengeResult> {
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

  if (user.totpEnabledAt && user.totpSecret) {
    return { requires2fa: true, tempToken: signTwoFactorToken(user.id) };
  }

  return completeLogin(user, membership, context);
}

/** Second login step: swaps the temp token + TOTP code for a real JWT. */
export async function completeTwoFactorLogin(
  tempToken: string,
  code: string,
  context: LoginContext = {},
): Promise<FullLoginResult> {
  let userId: number;
  try {
    userId = verifyTwoFactorToken(tempToken).userId;
  } catch {
    throw new Error("Two-factor session expired. Sign in again.");
  }

  const userResult = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = userResult[0];
  if (!user || user.status !== "ACTIVE") {
    throw new Error("User account is inactive.");
  }

  if (!user.totpEnabledAt || !user.totpSecret) {
    throw new Error("Two-factor authentication is not enabled.");
  }

  if (!verifyTotpCode(user.totpSecret, user.email, code)) {
    throw new Error("That code is not valid. Try the next one.");
  }

  const membership = await getPrimaryStudioMembership(user.id);
  if (!membership) {
    throw new Error("No studio membership for this account.");
  }

  return completeLogin(user, membership, context);
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
