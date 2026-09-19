import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/database.js";
import {
  pricingOpex,
  pricingSavedCalcs,
  pricingTargets,
} from "../db/schema/pricing.js";

export class PricingServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "PricingServiceError";
  }
}

function emptyToNull(value: string | null | undefined) {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function getOpex(studioId: number) {
  const rows = await db
    .select()
    .from(pricingOpex)
    .where(eq(pricingOpex.studioId, studioId))
    .orderBy(desc(pricingOpex.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertOpex(
  studioId: number,
  payload: Record<string, unknown>,
) {
  const existing = await getOpex(studioId);
  if (existing) {
    await db
      .update(pricingOpex)
      .set({ payload })
      .where(eq(pricingOpex.id, existing.id));
    return getOpex(studioId);
  }
  const result = await db.insert(pricingOpex).values({ studioId, payload });
  const rows = await db
    .select()
    .from(pricingOpex)
    .where(eq(pricingOpex.id, result[0].insertId))
    .limit(1);
  return rows[0]!;
}

export async function getTargets(studioId: number) {
  const rows = await db
    .select()
    .from(pricingTargets)
    .where(eq(pricingTargets.studioId, studioId))
    .orderBy(desc(pricingTargets.id))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertTargets(
  studioId: number,
  input: { jobsPerMonth: number; avgPrice: string; profitGoal: string },
) {
  const existing = await getTargets(studioId);
  if (existing) {
    await db
      .update(pricingTargets)
      .set({
        jobsPerMonth: input.jobsPerMonth,
        avgPrice: input.avgPrice,
        profitGoal: input.profitGoal,
      })
      .where(eq(pricingTargets.id, existing.id));
    return getTargets(studioId);
  }
  const result = await db.insert(pricingTargets).values({
    studioId,
    jobsPerMonth: input.jobsPerMonth,
    avgPrice: input.avgPrice,
    profitGoal: input.profitGoal,
  });
  const rows = await db
    .select()
    .from(pricingTargets)
    .where(eq(pricingTargets.id, result[0].insertId))
    .limit(1);
  return rows[0]!;
}

export async function listSavedCalcs(studioId: number) {
  return db
    .select()
    .from(pricingSavedCalcs)
    .where(eq(pricingSavedCalcs.studioId, studioId))
    .orderBy(desc(pricingSavedCalcs.id));
}

export async function getSavedCalc(studioId: number, id: number) {
  const rows = await db
    .select()
    .from(pricingSavedCalcs)
    .where(
      and(
        eq(pricingSavedCalcs.id, id),
        eq(pricingSavedCalcs.studioId, studioId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createSavedCalc(
  studioId: number,
  input: {
    name: string;
    sellPrice: string;
    directCost: string;
    verdict?: string | null;
    notes?: string | null;
    packageId?: number | null;
  },
) {
  const result = await db.insert(pricingSavedCalcs).values({
    studioId,
    name: input.name.trim(),
    sellPrice: input.sellPrice,
    directCost: input.directCost,
    verdict: emptyToNull(input.verdict),
    notes: emptyToNull(input.notes),
    packageId: input.packageId ?? null,
  });
  const created = await getSavedCalc(studioId, result[0].insertId);
  if (!created) throw new PricingServiceError("Failed to save calculation.", 500);
  return created;
}

export async function updateSavedCalc(
  studioId: number,
  id: number,
  input: {
    name?: string;
    sellPrice?: string;
    directCost?: string;
    verdict?: string | null;
    notes?: string | null;
    packageId?: number | null;
  },
) {
  const existing = await getSavedCalc(studioId, id);
  if (!existing) throw new PricingServiceError("Saved calculation not found.", 404);

  const updates: Partial<typeof pricingSavedCalcs.$inferInsert> = {};
  if (input.name !== undefined) updates.name = input.name.trim();
  if (input.sellPrice !== undefined) updates.sellPrice = input.sellPrice;
  if (input.directCost !== undefined) updates.directCost = input.directCost;
  if (input.verdict !== undefined) updates.verdict = emptyToNull(input.verdict);
  if (input.notes !== undefined) updates.notes = emptyToNull(input.notes);
  if (input.packageId !== undefined) updates.packageId = input.packageId;

  if (Object.keys(updates).length === 0) {
    throw new PricingServiceError("At least one field is required to update.", 400);
  }

  await db
    .update(pricingSavedCalcs)
    .set(updates)
    .where(
      and(
        eq(pricingSavedCalcs.id, id),
        eq(pricingSavedCalcs.studioId, studioId),
      ),
    );

  const updated = await getSavedCalc(studioId, id);
  if (!updated) throw new PricingServiceError("Saved calculation not found.", 404);
  return updated;
}

export async function deleteSavedCalc(studioId: number, id: number) {
  const existing = await getSavedCalc(studioId, id);
  if (!existing) throw new PricingServiceError("Saved calculation not found.", 404);
  await db
    .delete(pricingSavedCalcs)
    .where(
      and(
        eq(pricingSavedCalcs.id, id),
        eq(pricingSavedCalcs.studioId, studioId),
      ),
    );
  return { id, deleted: true as const };
}

export async function getPricingHub(studioId: number) {
  const [opex, targets, calcs] = await Promise.all([
    getOpex(studioId),
    getTargets(studioId),
    listSavedCalcs(studioId),
  ]);
  return { opex, targets, savedCalcs: calcs };
}
