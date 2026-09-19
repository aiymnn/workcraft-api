import { eq } from "drizzle-orm";
import { db } from "../db/database.js";
import { users } from "../db/schema/users.js";
import { getPrimaryStudioMembership } from "../auth/auth.service.js";
import { hashPassword, verifyPassword } from "../auth/password.js";

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

  const membership = await getPrimaryStudioMembership(userId);

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
