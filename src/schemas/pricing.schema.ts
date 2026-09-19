import * as z from "zod";

const moneySchema = z
  .union([
    z.number().nonnegative(),
    z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "Invalid money amount"),
  ])
  .transform((value) =>
    typeof value === "number" ? value.toFixed(2) : value,
  );

export const upsertOpexSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
});

export const upsertTargetsSchema = z.object({
  jobsPerMonth: z.number().int().min(0).max(10_000),
  avgPrice: moneySchema,
  profitGoal: moneySchema,
});

export const createSavedCalcSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sellPrice: moneySchema,
  directCost: moneySchema,
  verdict: z.string().trim().max(32).optional().nullable(),
  notes: z.string().trim().max(8000).optional().nullable(),
  packageId: z.number().int().positive().optional().nullable(),
});

export const updateSavedCalcSchema = createSavedCalcSchema.partial();
