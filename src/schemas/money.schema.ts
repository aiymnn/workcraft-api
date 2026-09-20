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

const optionalDateTime = z
  .union([z.string().datetime({ offset: true }), z.string().min(1), z.null()])
  .optional()
  .nullable();

const requiredDateTime = z.union([
  z.string().datetime({ offset: true }),
  z.string().min(1),
]);

export const invoiceStatuses = ["DRAFT", "SENT", "PAID", "VOID"] as const;
export const paymentStatuses = ["PAID", "UNPAID", "WRITTEN_OFF"] as const;
export const taxBuckets = [
  "CLAIMABLE",
  "EQUIPMENT",
  "NOT_CLAIMABLE",
  "DRAWING",
] as const;

export const milestoneSchema = z.object({
  label: z.string().trim().min(1).max(200),
  amount: moneySchema,
  dueDate: optionalDateTime,
  sortOrder: z.number().int().min(0).optional(),
});

export const createInvoiceSchema = z.object({
  jobId: z.number().int().positive(),
  status: z.enum(invoiceStatuses).optional(),
  notes: z.string().trim().max(8000).optional().nullable(),
  templateId: z.string().trim().max(32).optional(),
  milestones: z.array(milestoneSchema).max(50).optional(),
});

export const updateInvoiceSchema = z.object({
  status: z.enum(invoiceStatuses).optional(),
  notes: z.string().trim().max(8000).optional().nullable(),
  templateId: z.string().trim().max(32).optional(),
  milestones: z.array(milestoneSchema).max(50).optional(),
});

export const createPaymentSchema = z.object({
  jobId: z.number().int().positive().optional().nullable(),
  milestoneId: z.number().int().positive().optional().nullable(),
  amount: moneySchema,
  status: z.enum(paymentStatuses).optional(),
  paidAt: optionalDateTime,
  payMethodItemId: z.number().int().positive().optional().nullable(),
  bankItemId: z.number().int().positive().optional().nullable(),
  notes: z.string().trim().max(8000).optional().nullable(),
});

export const updatePaymentSchema = createPaymentSchema.partial();

export const createExpenseSchema = z.object({
  jobId: z.number().int().positive().optional().nullable(),
  amount: moneySchema,
  categoryItemId: z.number().int().positive().optional().nullable(),
  taxBucket: z.enum(taxBuckets).optional(),
  spentAt: requiredDateTime,
  receiptUrl: z.string().trim().max(512).optional().nullable(),
  notes: z.string().trim().max(8000).optional().nullable(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const createDrawingSchema = z.object({
  amount: moneySchema,
  drawnAt: requiredDateTime,
  notes: z.string().trim().max(8000).optional().nullable(),
});

export const updateDrawingSchema = createDrawingSchema.partial();

export const createOtherIncomeSchema = z.object({
  amount: moneySchema,
  categoryItemId: z.number().int().positive().optional().nullable(),
  countsTowardProfit: z.boolean().optional(),
  receivedAt: requiredDateTime,
  notes: z.string().trim().max(8000).optional().nullable(),
});

export const updateOtherIncomeSchema = createOtherIncomeSchema.partial();

export const issuePortalTokenSchema = z.object({
  jobId: z.number().int().positive(),
  expiresAt: optionalDateTime,
});

export const portalCheckoutSchema = z.object({
  invoiceId: z.number().int().positive(),
  milestoneId: z.number().int().positive().optional().nullable(),
});

export const invoiceShareMessageSchema = z
  .object({
    markSent: z.boolean().optional(),
    channel: z.enum(["whatsapp", "email"]).optional(),
  })
  .optional()
  .default({});

export const invoiceSendEmailSchema = z
  .object({
    to: z.string().trim().email().max(255).optional(),
    attachPdf: z.boolean().optional(),
    markSent: z.boolean().optional(),
  })
  .optional()
  .default({});
