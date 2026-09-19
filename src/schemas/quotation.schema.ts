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

const qtySchema = z
  .union([
    z.number().positive(),
    z
      .string()
      .trim()
      .regex(/^\d+(\.\d{1,2})?$/, "Invalid quantity"),
  ])
  .transform((value) =>
    typeof value === "number" ? value.toFixed(2) : value,
  );

const optionalDateTime = z
  .union([z.string().datetime({ offset: true }), z.string().min(1), z.null()])
  .optional()
  .nullable();

export const quotationStatuses = ["DRAFT", "SENT", "ACCEPTED", "LOST"] as const;

export const lineItemSchema = z.object({
  packageId: z.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(8000).optional().nullable(),
  quantity: qtySchema.optional(),
  unitPrice: moneySchema.optional(),
  amount: moneySchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const sessionSchema = z.object({
  ceremonyTypeItemId: z.number().int().positive().optional().nullable(),
  label: z.string().trim().max(200).optional().nullable(),
  startsAt: optionalDateTime,
  endsAt: optionalDateTime,
  venue: z.string().trim().max(255).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export const paymentRowSchema = z.object({
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

export const contractRowSchema = z.object({
  name: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(100_000),
});

export const createQuotationSchema = z.object({
  clientId: z.number().int().positive(),
  status: z.enum(quotationStatuses).optional(),
  currency: z.string().trim().min(3).max(8).optional(),
  intro: z.string().trim().max(8000).optional().nullable(),
  notes: z.string().trim().max(8000).optional().nullable(),
  lineItems: z.array(lineItemSchema).max(100).optional(),
  sessions: z.array(sessionSchema).max(50).optional(),
  paymentRows: z.array(paymentRowSchema).max(50).optional(),
  contracts: z.array(contractRowSchema).max(20).optional(),
});

export const updateQuotationSchema = z.object({
  clientId: z.number().int().positive().optional(),
  status: z.enum(quotationStatuses).optional(),
  currency: z.string().trim().min(3).max(8).optional(),
  intro: z.string().trim().max(8000).optional().nullable(),
  notes: z.string().trim().max(8000).optional().nullable(),
  lineItems: z.array(lineItemSchema).max(100).optional(),
  sessions: z.array(sessionSchema).max(50).optional(),
  paymentRows: z.array(paymentRowSchema).max(50).optional(),
  contracts: z.array(contractRowSchema).max(20).optional(),
});

export type CreateQuotationBody = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationBody = z.infer<typeof updateQuotationSchema>;
