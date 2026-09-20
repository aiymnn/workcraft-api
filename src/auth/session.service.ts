import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/database.js";
import { userSessions } from "../db/schema/user_sessions.js";

/** `user_sessions.refresh_token_hash` stores this hash of the JWT `sid` claim. */
function hashSessionId(sessionId: string) {
  return createHash("sha256").update(sessionId).digest("hex");
}

export async function createUserSession(input: {
  userId: number;
  expiresAt: Date;
  userAgent?: string | null;
  ipAddress?: string | null;
}) {
  const sessionId = randomUUID();

  await db.insert(userSessions).values({
    userId: input.userId,
    refreshTokenHash: hashSessionId(sessionId),
    expiresAt: input.expiresAt,
    userAgent: input.userAgent?.slice(0, 512) ?? null,
    ipAddress: input.ipAddress?.slice(0, 64) ?? null,
  });

  return { sessionId };
}

/** False when the session was revoked (or never existed) for this user. */
export async function isSessionActive(userId: number, sessionId: string) {
  const rows = await db
    .select({ id: userSessions.id })
    .from(userSessions)
    .where(
      and(
        eq(userSessions.userId, userId),
        eq(userSessions.refreshTokenHash, hashSessionId(sessionId)),
        isNull(userSessions.revokedAt),
      ),
    )
    .limit(1);

  return Boolean(rows[0]);
}

export async function revokeAllUserSessions(userId: number) {
  const active = await db
    .select({ id: userSessions.id })
    .from(userSessions)
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));

  if (active.length > 0) {
    await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(
        and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)),
      );
  }

  return { revoked: active.length };
}
