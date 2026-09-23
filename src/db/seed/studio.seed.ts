import { and, eq } from "drizzle-orm";
import { db } from "../database.js";
import { studios } from "../schema/studios.js";
import { studioMembers } from "../schema/studio_members.js";
import { users } from "../schema/users.js";
import { roles } from "../schema/roles.js";
import { userRoles } from "../schema/user_roles.js";
import { optionListKeys, optionLists } from "../schema/option_lists.js";
import { hashPassword } from "../../auth/password.js";

/**
 * Idempotent: default studio, sole OWNER (studio owner env), System Admin as
 * studio ADMIN (keeps SYSTEM_ADMIN platform role). Run after rbac + system-admin.
 */
async function seedStudio() {
  console.log("Seeding default studio...");

  const systemAdminEmail = (process.env.SYSTEM_ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();
  if (!systemAdminEmail) {
    throw new Error("SYSTEM_ADMIN_EMAIL is required for studio seed.");
  }

  const ownerName =
    process.env.STUDIO_OWNER_NAME?.trim() || "Adam Syamil";
  const ownerEmail = (
    process.env.STUDIO_OWNER_EMAIL || "adam@workcraft.local"
  )
    .trim()
    .toLowerCase();
  const ownerPassword = process.env.STUDIO_OWNER_PASSWORD || "password";

  if (ownerPassword.length < 8) {
    throw new Error("STUDIO_OWNER_PASSWORD must be at least 8 characters.");
  }

  if (ownerEmail === systemAdminEmail) {
    throw new Error(
      "STUDIO_OWNER_EMAIL must differ from SYSTEM_ADMIN_EMAIL (sole Owner vs platform admin).",
    );
  }

  const studioName =
    process.env.DEFAULT_STUDIO_NAME?.trim() || "Workcraft Studio";

  const existingStudios = await db.select().from(studios).limit(1);
  let studio = existingStudios[0];

  if (!studio) {
    const result = await db.insert(studios).values({
      name: studioName,
      currency: "MYR",
      workingDays: [1, 2, 3, 4, 5],
      capacityPerDay: 2,
      portalMessage:
        "Welcome, {name}. Here you can view your quotation, agreement, and invoices.",
      quoteIntro:
        "Thank you for considering Workcraft Studio. Below is a tailored quotation for your event.",
      quoteNotes: "Deposit secures your date. Balance due as per payment plan.",
      invoiceNotes: "Please include the invoice number as payment reference.",
    });

    const insertId = result[0].insertId;
    const created = await db
      .select()
      .from(studios)
      .where(eq(studios.id, insertId))
      .limit(1);
    studio = created[0];
    if (!studio) throw new Error("Failed to create default studio.");
    console.log(`Created studio: ${studio.name} (#${studio.id})`);
  } else {
    console.log(`Studio already exists: ${studio.name} (#${studio.id})`);
  }

  for (const key of optionListKeys) {
    const existing = await db
      .select()
      .from(optionLists)
      .where(
        and(eq(optionLists.studioId, studio.id), eq(optionLists.key, key)),
      )
      .limit(1);
    if (!existing[0]) {
      await db.insert(optionLists).values({
        studioId: studio.id,
        key,
        seeded: false,
      });
    }
  }
  console.log("Ensured option_lists rows for studio.");

  const adminRoleRows = await db
    .select()
    .from(roles)
    .where(eq(roles.name, "ADMIN"))
    .limit(1);
  const adminRole = adminRoleRows[0];
  if (!adminRole) {
    throw new Error("ADMIN role not found. Run RBAC seed before studio seed.");
  }

  // --- Sole studio Owner ---
  const existingOwners = await db
    .select()
    .from(users)
    .where(eq(users.email, ownerEmail))
    .limit(1);
  let owner = existingOwners[0];

  if (!owner) {
    const passwordHash = await hashPassword(ownerPassword);
    const result = await db.insert(users).values({
      name: ownerName,
      email: ownerEmail,
      passwordHash,
      status: "ACTIVE",
    });
    const insertId = result[0].insertId;
    const created = await db
      .select()
      .from(users)
      .where(eq(users.id, insertId))
      .limit(1);
    owner = created[0];
    if (!owner) throw new Error("Failed to create studio Owner user.");
    console.log(`Created studio Owner: ${ownerEmail}`);
  } else {
    console.log(
      `Studio Owner already exists: ${ownerEmail} (password not overwritten)`,
    );
  }

  const ownerRoleRows = await db
    .select()
    .from(userRoles)
    .where(
      and(eq(userRoles.userId, owner.id), eq(userRoles.roleId, adminRole.id)),
    )
    .limit(1);
  if (!ownerRoleRows[0]) {
    await db.insert(userRoles).values({
      userId: owner.id,
      roleId: adminRole.id,
    });
    console.log("Assigned ADMIN platform role to studio Owner.");
  } else {
    console.log("Studio Owner already has ADMIN platform role.");
  }

  const ownerMembership = await db
    .select()
    .from(studioMembers)
    .where(
      and(
        eq(studioMembers.studioId, studio.id),
        eq(studioMembers.userId, owner.id),
      ),
    )
    .limit(1);

  if (!ownerMembership[0]) {
    await db.insert(studioMembers).values({
      studioId: studio.id,
      userId: owner.id,
      access: "OWNER",
    });
    console.log(`Linked ${ownerEmail} as OWNER.`);
  } else if (ownerMembership[0].access !== "OWNER") {
    await db
      .update(studioMembers)
      .set({ access: "OWNER" })
      .where(eq(studioMembers.id, ownerMembership[0].id));
    console.log(`Updated ${ownerEmail} membership to OWNER.`);
  } else {
    console.log(`OWNER membership already exists for ${ownerEmail}.`);
  }

  // --- System Admin: studio ADMIN only (keep SYSTEM_ADMIN platform role) ---
  const adminUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, systemAdminEmail))
    .limit(1);
  const admin = adminUsers[0];
  if (!admin) {
    throw new Error(
      `User ${systemAdminEmail} not found. Run system-admin seed before studio seed.`,
    );
  }

  const adminMembership = await db
    .select()
    .from(studioMembers)
    .where(
      and(
        eq(studioMembers.studioId, studio.id),
        eq(studioMembers.userId, admin.id),
      ),
    )
    .limit(1);

  if (!adminMembership[0]) {
    await db.insert(studioMembers).values({
      studioId: studio.id,
      userId: admin.id,
      access: "ADMIN",
    });
    console.log(`Linked ${systemAdminEmail} as studio ADMIN.`);
  } else if (adminMembership[0].access === "OWNER") {
    await db
      .update(studioMembers)
      .set({ access: "ADMIN" })
      .where(eq(studioMembers.id, adminMembership[0].id));
    console.log(
      `Demoted ${systemAdminEmail} from OWNER to studio ADMIN (platform SYSTEM_ADMIN unchanged).`,
    );
  } else if (adminMembership[0].access !== "ADMIN") {
    await db
      .update(studioMembers)
      .set({ access: "ADMIN" })
      .where(eq(studioMembers.id, adminMembership[0].id));
    console.log(`Updated ${systemAdminEmail} membership to studio ADMIN.`);
  } else {
    console.log(`Studio ADMIN membership already exists for ${systemAdminEmail}.`);
  }

  console.log("Studio seed completed.");
}

seedStudio()
  .catch((error) => {
    console.error("Studio seed failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
