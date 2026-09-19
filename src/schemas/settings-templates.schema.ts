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

const milestoneSchema = z.object({
  label: z.string().trim().min(1).max(200),
  type: z.enum(["FIXED", "PCT_TOTAL", "PCT_REMAINING"]),
  value: moneySchema,
  dueN: z.number().int().min(0).max(3650).default(0),
  dueUnit: z.enum(["DAYS", "WEEKS", "MONTHS"]).default("DAYS"),
  dueAnchor: z
    .enum(["TODAY", "BEFORE_SHOOT", "AFTER_SHOOT"])
    .default("TODAY"),
  sortOrder: z.number().int().min(0).optional(),
});

const checklistItemSchema = z.object({
  label: z.string().trim().min(1).max(255),
  phase: z.enum(["BEFORE", "ON_DAY", "AFTER"]),
  sortOrder: z.number().int().min(0).optional(),
});

export const emailTemplateTypes = [
  "QUOTE",
  "INVOICE",
  "REM_BEFORE",
  "REM_DUE",
  "REM_AFTER",
] as const;

export const whatsappTemplateTypes = [
  "QUOTE",
  "INVOICE",
  "REM_BEFORE",
  "REM_DUE",
  "REM_AFTER",
  "CONTRACT",
] as const;

export const createPackageSchema = z.object({
  name: z.string().trim().min(1).max(200),
  price: moneySchema.optional(),
  description: z.string().trim().max(8000).optional().nullable(),
});

export const updatePackageSchema = createPackageSchema.partial();

export const createPaymentPlanSchema = z.object({
  name: z.string().trim().min(1).max(200),
  milestones: z.array(milestoneSchema).max(50).optional(),
});

export const updatePaymentPlanSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  milestones: z.array(milestoneSchema).max(50).optional(),
});

export const createContractSchema = z.object({
  name: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(100_000),
});

export const updateContractSchema = createContractSchema.partial();

export const createChecklistSchema = z.object({
  name: z.string().trim().min(1).max(200),
  isDefault: z.boolean().optional(),
  items: z.array(checklistItemSchema).max(200).optional(),
});

export const updateChecklistSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  isDefault: z.boolean().optional(),
  items: z.array(checklistItemSchema).max(200).optional(),
});

export const upsertEmailTemplateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(50_000),
});

export const upsertWhatsappTemplateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(50_000),
});

export type CreatePackageBody = z.infer<typeof createPackageSchema>;
export type UpdatePackageBody = z.infer<typeof updatePackageSchema>;
export type CreatePaymentPlanBody = z.infer<typeof createPaymentPlanSchema>;
export type UpdatePaymentPlanBody = z.infer<typeof updatePaymentPlanSchema>;
export type CreateContractBody = z.infer<typeof createContractSchema>;
export type UpdateContractBody = z.infer<typeof updateContractSchema>;
export type CreateChecklistBody = z.infer<typeof createChecklistSchema>;
export type UpdateChecklistBody = z.infer<typeof updateChecklistSchema>;
