import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, ne } from "drizzle-orm";
import { db } from "../db/database.js";
import { users } from "../db/schema/users.js";
import { emailChangeTokens } from "../db/schema/email_change_tokens.js";
import { userOauthConnections } from "../db/schema/user_sessions.js";
import { getPrimaryStudioMembership } from "../auth/auth.service.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { revokeAllUserSessions } from "../auth/session.service.js";
import { env } from "../config/env.js";
import { isSmtpConfigured, MailerError, sendMail } from "../lib/mailer.js";
import {
  generateTotpSecret,
  totpAuthUrl,
  totpQrDataUrl,
  verifyTotpCode,
} from "../lib/totp.js";
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  googleScopes,
  isGoogleConfigured,
  type GoogleOauthPurpose,
} from "../lib/google-oauth.js";
import { signOauthStateToken, verifyOauthStateToken } from "../auth/jwt.js";
import { encryptToken } from "../lib/token-crypto.js";

/** Email-change links stay valid for a day. */
const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;

export class AccountServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "AccountServiceError";
  }
}

function emptyToNull(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getGoogleConnection(userId: number) {
  const rows = await db
    .select()
    .from(userOauthConnections)
    .where(
      and(
        eq(userOauthConnections.userId, userId),
        eq(userOauthConnections.provider, "GOOGLE"),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/** Shape the Account page reads for Connected apps + Footage. */
function connectionFlags(
  connection: Awaited<ReturnType<typeof getGoogleConnection>>,
) {
  return {
    googleConfigured: isGoogleConfigured(),
    googleConnected: Boolean(connection?.accessTokenEnc),
    googleEmail: connection?.providerEmail ?? null,
    calendarSyncEnabled: Boolean(connection?.calendarSyncEnabled),
    driveReceiptsEnabled: Boolean(connection?.driveReceiptsEnabled),
    footagePortalEnabled: Boolean(connection?.footagePortalEnabled),
  };
}

/** Creates the GOOGLE row on demand so flag-only toggles work without OAuth. */
async function upsertGoogleConnection(
  userId: number,
  values: Partial<typeof userOauthConnections.$inferInsert>,
) {
  const existing = await getGoogleConnection(userId);

  if (existing) {
    await db
      .update(userOauthConnections)
      .set(values)
      .where(eq(userOauthConnections.id, existing.id));
  } else {
    await db.insert(userOauthConnections).values({
      userId,
      provider: "GOOGLE",
      ...values,
    });
  }

  return getGoogleConnection(userId);
}

export async function getAccountProfile(userId: number) {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      status: users.status,
      waUpdatesOptIn: users.waUpdatesOptIn,
      myBillsRemindersEnabled: users.myBillsRemindersEnabled,
      myBillsDaysBefore: users.myBillsDaysBefore,
      totpEnabled: users.totpEnabledAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) return null;

  const [membership, connection] = await Promise.all([
    getPrimaryStudioMembership(userId),
    getGoogleConnection(userId),
  ]);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      waUpdatesOptIn: user.waUpdatesOptIn,
      myBillsRemindersEnabled: user.myBillsRemindersEnabled,
      myBillsDaysBefore: user.myBillsDaysBefore,
      totpEnabled: Boolean(user.totpEnabled),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    studio: membership?.studio ?? null,
    access: membership?.access ?? null,
    connections: connectionFlags(connection),
  };
}

export async function updateAccountProfile(
  userId: number,
  input: {
    name?: string;
    phone?: string | null;
    waUpdatesOptIn?: boolean;
    myBillsRemindersEnabled?: boolean;
    myBillsDaysBefore?: number;
  },
) {
  const updates: Partial<typeof users.$inferInsert> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new AccountServiceError("Name cannot be empty.", 400);
    updates.name = name;
  }
  if (input.phone !== undefined) updates.phone = emptyToNull(input.phone);
  if (input.waUpdatesOptIn !== undefined)
    updates.waUpdatesOptIn = input.waUpdatesOptIn;
  if (input.myBillsRemindersEnabled !== undefined)
    updates.myBillsRemindersEnabled = input.myBillsRemindersEnabled;
  if (input.myBillsDaysBefore !== undefined)
    updates.myBillsDaysBefore = input.myBillsDaysBefore;

  if (Object.keys(updates).length === 0) {
    throw new AccountServiceError(
      "At least one field is required to update.",
      400,
    );
  }

  await db.update(users).set(updates).where(eq(users.id, userId));

  const profile = await getAccountProfile(userId);
  if (!profile) throw new AccountServiceError("User not found.", 404);
  return profile;
}

export async function changeAccountPassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
) {
  const rows = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) throw new AccountServiceError("User not found.", 404);

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AccountServiceError("Current password is incorrect.", 401);
  }

  if (currentPassword === newPassword) {
    throw new AccountServiceError(
      "New password must be different from the current password.",
      400,
    );
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

  return { changed: true as const };
}

/* ---------------------------------------------------------------- email change */

export async function requestEmailChange(
  userId: number,
  newEmail: string,
  password: string,
) {
  const rows = await db
    .select({
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) throw new AccountServiceError("User not found.", 404);

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new AccountServiceError("Your password is incorrect.", 401);
  }

  const email = newEmail.trim().toLowerCase();
  if (email === user.email.trim().toLowerCase()) {
    throw new AccountServiceError(
      "That is already your login email.",
      400,
    );
  }

  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), ne(users.id, userId)))
    .limit(1);
  if (taken[0]) {
    throw new AccountServiceError("That email is already in use.", 409);
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_MS);

  // One pending request per user keeps the newest link the only usable one.
  await db.delete(emailChangeTokens).where(eq(emailChangeTokens.userId, userId));
  await db.insert(emailChangeTokens).values({
    userId,
    newEmail: email,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const confirmUrl = `${env.PUBLIC_WEB_ORIGIN.replace(/\/$/, "")}/account/confirm-email?token=${token}`;
  let emailSent = false;

  if (isSmtpConfigured()) {
    try {
      await sendMail({
        to: email,
        subject: "Confirm your new Workcraft login email",
        text: `Hello ${user.name},\n\nConfirm this address as the new login email for your Workcraft account:\n${confirmUrl}\n\nThe link expires in 24 hours. Your current email (${user.email}) keeps working until you confirm.\n\nIf this wasn't you, ignore this email.`,
      });
      emailSent = true;
    } catch (error) {
      if (!(error instanceof MailerError)) throw error;
      console.error("Email-change message could not be sent.", error);
    }
  }

  return {
    requested: true as const,
    newEmail: email,
    expiresAt,
    emailSent,
    /** Returned only when SMTP is off, so the change is still completable. */
    confirmUrl: emailSent ? null : confirmUrl,
  };
}

export async function confirmEmailChange(token: string) {
  const rows = await db
    .select()
    .from(emailChangeTokens)
    .where(
      and(
        eq(emailChangeTokens.tokenHash, hashToken(token)),
        gt(emailChangeTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const pending = rows[0];
  if (!pending) {
    throw new AccountServiceError(
      "This confirmation link is invalid or has expired.",
      404,
    );
  }

  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, pending.newEmail), ne(users.id, pending.userId)))
    .limit(1);
  if (taken[0]) {
    await db.delete(emailChangeTokens).where(eq(emailChangeTokens.id, pending.id));
    throw new AccountServiceError("That email is already in use.", 409);
  }

  await db
    .update(users)
    .set({ email: pending.newEmail })
    .where(eq(users.id, pending.userId));

  await db.delete(emailChangeTokens).where(eq(emailChangeTokens.id, pending.id));

  return { changed: true as const, email: pending.newEmail };
}

/* ------------------------------------------------------------------- TOTP 2FA */

export async function enroll2fa(userId: number) {
  const rows = await db
    .select({ email: users.email, totpEnabledAt: users.totpEnabledAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) throw new AccountServiceError("User not found.", 404);
  if (user.totpEnabledAt) {
    throw new AccountServiceError(
      "Two-factor authentication is already on. Turn it off first.",
      409,
    );
  }

  // Pending enrollment: secret stored, totpEnabledAt still null.
  const secret = generateTotpSecret();
  await db
    .update(users)
    .set({ totpSecret: secret, totpEnabledAt: null })
    .where(eq(users.id, userId));

  const otpauthUrl = totpAuthUrl(secret, user.email);

  return {
    secret,
    otpauthUrl,
    qrDataUrl: await totpQrDataUrl(otpauthUrl),
  };
}

export async function confirm2fa(userId: number, code: string) {
  const rows = await db
    .select({
      email: users.email,
      totpSecret: users.totpSecret,
      totpEnabledAt: users.totpEnabledAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) throw new AccountServiceError("User not found.", 404);
  if (!user.totpSecret) {
    throw new AccountServiceError(
      "Start enrollment before confirming a code.",
      400,
    );
  }
  if (user.totpEnabledAt) {
    throw new AccountServiceError(
      "Two-factor authentication is already on.",
      409,
    );
  }

  if (!verifyTotpCode(user.totpSecret, user.email, code)) {
    throw new AccountServiceError(
      "That code is not valid. Try the next one.",
      400,
    );
  }

  await db
    .update(users)
    .set({ totpEnabledAt: new Date() })
    .where(eq(users.id, userId));

  return { enabled: true as const };
}

export async function disable2fa(
  userId: number,
  input: { password?: string; code?: string },
) {
  const rows = await db
    .select({
      email: users.email,
      passwordHash: users.passwordHash,
      totpSecret: users.totpSecret,
      totpEnabledAt: users.totpEnabledAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) throw new AccountServiceError("User not found.", 404);

  if (!user.totpSecret && !user.totpEnabledAt) {
    throw new AccountServiceError(
      "Two-factor authentication is already off.",
      409,
    );
  }

  const password = input.password?.trim();
  const code = input.code?.trim();

  if (password) {
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new AccountServiceError("Your password is incorrect.", 401);
    }
  } else if (code) {
    if (
      !user.totpSecret ||
      !verifyTotpCode(user.totpSecret, user.email, code)
    ) {
      throw new AccountServiceError(
        "That code is not valid. Try the next one.",
        400,
      );
    }
  } else {
    throw new AccountServiceError(
      "Confirm with your password or a 6-digit code.",
      400,
    );
  }

  await db
    .update(users)
    .set({ totpSecret: null, totpEnabledAt: null })
    .where(eq(users.id, userId));

  return { disabled: true as const };
}

/* --------------------------------------------------------------- all sessions */

export async function revokeAllSessions(userId: number) {
  return revokeAllUserSessions(userId);
}

/* -------------------------------------------------------------- Google OAuth */

function requireGoogle() {
  if (!isGoogleConfigured()) {
    throw new AccountServiceError(
      "Google is not configured on this server.",
      503,
    );
  }
}

export function startGoogleOauth(userId: number, purpose: GoogleOauthPurpose) {
  requireGoogle();

  return {
    url: buildGoogleAuthUrl({
      purpose,
      state: signOauthStateToken({ userId, purpose }),
    }),
  };
}

export async function completeGoogleOauth(code: string, state: string) {
  requireGoogle();

  let parsed: { userId: number; purpose: GoogleOauthPurpose };
  try {
    parsed = verifyOauthStateToken(state);
  } catch {
    throw new AccountServiceError(
      "This Google link expired. Start again from Account.",
      400,
    );
  }

  const tokens = await exchangeGoogleCode(code);
  const existing = await getGoogleConnection(parsed.userId);

  await upsertGoogleConnection(parsed.userId, {
    providerEmail: tokens.email,
    accessTokenEnc: encryptToken(tokens.accessToken),
    // Google only resends a refresh token on re-consent; keep the old one.
    refreshTokenEnc: tokens.refreshToken
      ? encryptToken(tokens.refreshToken)
      : (existing?.refreshTokenEnc ?? null),
    scopes: tokens.scope ?? googleScopes(parsed.purpose).join(" "),
    ...(parsed.purpose === "calendar"
      ? { calendarSyncEnabled: true }
      : { driveReceiptsEnabled: true }),
  });

  return { connected: true as const, purpose: parsed.purpose };
}

export async function disconnectGoogle(
  userId: number,
  purpose: GoogleOauthPurpose,
) {
  const existing = await getGoogleConnection(userId);
  if (!existing) {
    throw new AccountServiceError("Google is not connected.", 404);
  }

  const stillUsed =
    purpose === "calendar"
      ? existing.driveReceiptsEnabled
      : existing.calendarSyncEnabled;

  const connection = await upsertGoogleConnection(userId, {
    ...(purpose === "calendar"
      ? { calendarSyncEnabled: false }
      : { driveReceiptsEnabled: false }),
    // Drop the tokens once no Google feature is left on.
    ...(stillUsed
      ? {}
      : { accessTokenEnc: null, refreshTokenEnc: null, scopes: null }),
  });

  return { disconnected: true as const, connections: connectionFlags(connection) };
}

export async function syncGoogle(userId: number, purpose: GoogleOauthPurpose) {
  requireGoogle();

  const connection = await getGoogleConnection(userId);
  if (!connection?.accessTokenEnc) {
    throw new AccountServiceError("Connect Google first.", 409);
  }

  const enabled =
    purpose === "calendar"
      ? connection.calendarSyncEnabled
      : connection.driveReceiptsEnabled;
  if (!enabled) {
    throw new AccountServiceError(
      purpose === "calendar"
        ? "Calendar sync is off for this account."
        : "Drive receipts are off for this account.",
      409,
    );
  }

  return { synced: true as const, purpose, syncedAt: new Date() };
}

/* ------------------------------------------------------------- footage portal */

export async function setFootagePortal(userId: number, enabled: boolean) {
  const connection = await upsertGoogleConnection(userId, {
    footagePortalEnabled: enabled,
  });

  return { footagePortalEnabled: enabled, connections: connectionFlags(connection) };
}
