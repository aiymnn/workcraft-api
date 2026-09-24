import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "../database.js";
import { studios } from "../schema/studios.js";
import { packages } from "../schema/packages.js";
import {
  paymentPlanMilestones,
  paymentPlanTemplates,
} from "../schema/payment_plans.js";
import { contractTemplates } from "../schema/contract_templates.js";
import { optionLists, optionItems } from "../schema/option_lists.js";
import { OPTION_DEFAULT_LABELS } from "../../services/option-catalog.defaults.js";

/**
 * Idempotent wedding photography/videography starter templates for the first studio.
 * Only inserts packages / payment plans / contracts when that table is empty for the studio.
 * Ensures CEREMONY_TYPE has default ceremony labels when it has no active items.
 * Run after: rbac → system-admin → studio.
 */
const WEDDING_PACKAGES = [
  {
    name: "PHOTOGRAPHY NIKAH",
    price: "799.00",
    description:
      "1 photographer · 3–4 hours · Edited photos · Drive delivery",
  },
  {
    name: "VIDEOGRAPHY SANDING",
    price: "1499.00",
    description:
      "1 videographer · Highlight film · Raw clips optional",
  },
  {
    name: "COMBO NIKAH & SANDING",
    price: "2699.00",
    description:
      "1 photographer · 1 videographer · Teaser · Edited photos",
  },
  {
    name: "FULL DAY WEDDING PHOTO + VIDEO",
    price: "3999.00",
    description:
      "Full-day photo + video · Teaser · Highlight · Edited gallery",
  },
] as const;

const SERVICE_AGREEMENT_BODY =
  "This agreement is between [STUDIO NAME] and [CLIENT NAME] for services related to quote [QUOTE NUMBER]. Total [TOTAL]. Deposit [DEPOSIT]. First session [FIRST SESSION DATE].\n\nSigned on [TODAY].";

async function seedStudioTemplates() {
  console.log("Seeding wedding studio templates...");

  const existingStudios = await db.select().from(studios).limit(1);
  const studio = existingStudios[0];
  if (!studio) {
    throw new Error(
      "No studio found. Run db:seed:studio before db:seed:templates.",
    );
  }

  const studioId = studio.id;
  console.log(`Studio: ${studio.name} (#${studioId})`);

  // --- Packages ---
  const packageCountRows = await db
    .select({ value: count() })
    .from(packages)
    .where(eq(packages.studioId, studioId));
  const packageCount = Number(packageCountRows[0]?.value ?? 0);

  if (packageCount === 0) {
    await db.insert(packages).values(
      WEDDING_PACKAGES.map((pkg) => ({
        studioId,
        name: pkg.name,
        price: pkg.price,
        description: pkg.description,
      })),
    );
    console.log(`Inserted ${WEDDING_PACKAGES.length} wedding packages.`);
  } else {
    console.log(`Packages already exist (${packageCount}); skipped.`);
  }

  // --- Payment plan ---
  const planCountRows = await db
    .select({ value: count() })
    .from(paymentPlanTemplates)
    .where(eq(paymentPlanTemplates.studioId, studioId));
  const planCount = Number(planCountRows[0]?.value ?? 0);

  if (planCount === 0) {
    const planResult = await db.insert(paymentPlanTemplates).values({
      studioId,
      name: "STANDARD DEPO 300+7 DAY BALANCE",
    });
    const planId = planResult[0].insertId;
    await db.insert(paymentPlanMilestones).values([
      {
        planId,
        label: "Booking Deposit",
        type: "FIXED",
        value: "300.00",
        dueN: 0,
        dueUnit: "DAYS",
        dueAnchor: "TODAY",
        sortOrder: 0,
      },
      {
        planId,
        label: "Before First Event",
        type: "PCT_REMAINING",
        value: "100.00",
        dueN: 7,
        dueUnit: "DAYS",
        dueAnchor: "BEFORE_SHOOT",
        sortOrder: 1,
      },
    ]);
    console.log("Inserted STANDARD DEPO 300+7 DAY BALANCE payment plan.");
  } else {
    console.log(`Payment plans already exist (${planCount}); skipped.`);
  }

  // --- Contract ---
  const contractCountRows = await db
    .select({ value: count() })
    .from(contractTemplates)
    .where(eq(contractTemplates.studioId, studioId));
  const contractCount = Number(contractCountRows[0]?.value ?? 0);

  if (contractCount === 0) {
    await db.insert(contractTemplates).values({
      studioId,
      name: "SERVICE AGREEMENT",
      body: SERVICE_AGREEMENT_BODY,
    });
    console.log("Inserted SERVICE AGREEMENT contract.");
  } else {
    console.log(`Contracts already exist (${contractCount}); skipped.`);
  }

  // --- CEREMONY_TYPE labels if empty ---
  const ceremonyLists = await db
    .select()
    .from(optionLists)
    .where(
      and(eq(optionLists.studioId, studioId), eq(optionLists.key, "CEREMONY_TYPE")),
    )
    .limit(1);
  let ceremonyList = ceremonyLists[0];

  if (!ceremonyList) {
    const insertResult = await db.insert(optionLists).values({
      studioId,
      key: "CEREMONY_TYPE",
      seeded: true,
    });
    const created = await db
      .select()
      .from(optionLists)
      .where(eq(optionLists.id, insertResult[0].insertId))
      .limit(1);
    ceremonyList = created[0];
  }

  if (ceremonyList) {
    const itemCountRows = await db
      .select({ value: count() })
      .from(optionItems)
      .where(
        and(
          eq(optionItems.listId, ceremonyList.id),
          isNull(optionItems.retiredAt),
        ),
      );
    const itemCount = Number(itemCountRows[0]?.value ?? 0);
    const labels = OPTION_DEFAULT_LABELS.CEREMONY_TYPE ?? [];

    if (itemCount === 0 && labels.length > 0) {
      await db.insert(optionItems).values(
        labels.map((label, index) => ({
          listId: ceremonyList!.id,
          label,
          sortOrder: index,
        })),
      );
      if (!ceremonyList.seeded) {
        await db
          .update(optionLists)
          .set({ seeded: true })
          .where(eq(optionLists.id, ceremonyList.id));
      }
      console.log(`Seeded ${labels.length} CEREMONY_TYPE labels.`);
    } else if (itemCount > 0) {
      // Fill any missing defaults without creating duplicates (idempotent).
      const existing = await db
        .select({ label: optionItems.label })
        .from(optionItems)
        .where(
          and(
            eq(optionItems.listId, ceremonyList.id),
            isNull(optionItems.retiredAt),
          ),
        );
      const existingLabels = new Set(
        existing.map((row) => row.label.trim().toLowerCase()),
      );
      const missing = labels.filter(
        (label) => !existingLabels.has(label.trim().toLowerCase()),
      );
      if (missing.length > 0) {
        const maxSort = itemCount;
        await db.insert(optionItems).values(
          missing.map((label, index) => ({
            listId: ceremonyList!.id,
            label,
            sortOrder: maxSort + index,
          })),
        );
        console.log(`Added ${missing.length} missing CEREMONY_TYPE labels.`);
      } else {
        console.log(
          `CEREMONY_TYPE already has ${itemCount} item(s); skipped.`,
        );
      }
      if (!ceremonyList.seeded) {
        await db
          .update(optionLists)
          .set({ seeded: true })
          .where(eq(optionLists.id, ceremonyList.id));
      }
    }
  }

  console.log("Studio templates seed completed.");
}

seedStudioTemplates()
  .catch((error) => {
    console.error("Studio templates seed failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
