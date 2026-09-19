import { and, eq } from "drizzle-orm";
import { db } from "../database.js";
import { users } from "../schema/users.js";
import { roles } from "../schema/roles.js";
import { userRoles } from "../schema/user_roles.js";
import { hashPassword } from "../../auth/password.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function seedSystemAdmin() {
  console.log("Seeding System Admin...");

  const name = requireEnv("SYSTEM_ADMIN_NAME");
  const email = requireEnv("SYSTEM_ADMIN_EMAIL").trim().toLowerCase();
  const password = requireEnv("SYSTEM_ADMIN_PASSWORD");

  if (password.length < 8) {
    throw new Error("SYSTEM_ADMIN_PASSWORD must be at least 8 characters.");
  }

  const systemAdminRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.name, "SYSTEM_ADMIN"))
    .limit(1);

  const systemAdminRole = systemAdminRoles[0];

  if (!systemAdminRole) {
    throw new Error(
      "SYSTEM_ADMIN role not found. Run RBAC seed before system-admin seed.",
    );
  }

  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let user = existingUsers[0];

  if (!user) {
    const passwordHash = await hashPassword(password);

    const result = await db.insert(users).values({
      name,
      email,
      passwordHash,
      status: "ACTIVE",
    });

    const insertId = result[0].insertId;

    const createdUsers = await db
      .select()
      .from(users)
      .where(eq(users.id, insertId))
      .limit(1);

    user = createdUsers[0];

    if (!user) {
      throw new Error("Failed to create System Admin user.");
    }

    console.log(`Created System Admin user: ${email}`);
  } else {
    console.log(
      `System Admin user already exists: ${email} (password not overwritten)`,
    );
  }

  const existingAssignments = await db
    .select()
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, user.id),
        eq(userRoles.roleId, systemAdminRole.id),
      ),
    )
    .limit(1);

  if (!existingAssignments[0]) {
    await db.insert(userRoles).values({
      userId: user.id,
      roleId: systemAdminRole.id,
    });

    console.log("Assigned SYSTEM_ADMIN role.");
  } else {
    console.log("SYSTEM_ADMIN role already assigned.");
  }

  console.log("System Admin seed completed.");
}

seedSystemAdmin()
  .catch((error) => {
    console.error("System Admin seed failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
