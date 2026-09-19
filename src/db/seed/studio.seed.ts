import { and, eq } from "drizzle-orm";
import { db } from "../database.js";
import { studios } from "../schema/studios.js";
import { studioMembers } from "../schema/studio_members.js";
import { users } from "../schema/users.js";
import { optionListKeys, optionLists } from "../schema/option_lists.js";

/**
 * Idempotent: default studio + OWNER membership for SYSTEM_ADMIN email user.
 * Run after rbac + system-admin seeds.
 */
async function seedStudio() {
  console.log("Seeding default studio...");

  const email = (process.env.SYSTEM_ADMIN_EMAIL || "")
    .trim()
    .toLowerCase();
  if (!email) {
    throw new Error("SYSTEM_ADMIN_EMAIL is required for studio seed.");
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

  const adminUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const admin = adminUsers[0];
  if (!admin) {
    throw new Error(
      `User ${email} not found. Run system-admin seed before studio seed.`,
    );
  }

  const existingMembers = await db
    .select()
    .from(studioMembers)
    .where(
      and(
        eq(studioMembers.studioId, studio.id),
        eq(studioMembers.userId, admin.id),
      ),
    )
    .limit(1);

  if (!existingMembers[0]) {
    await db.insert(studioMembers).values({
      studioId: studio.id,
      userId: admin.id,
      access: "OWNER",
    });
    console.log(`Linked ${email} as OWNER.`);
  } else {
    console.log(`OWNER membership already exists for ${email}.`);
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
