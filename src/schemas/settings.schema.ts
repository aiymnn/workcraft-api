import * as z from "zod";

export const updateStudioSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  ssm: z.string().trim().max(64).optional().nullable(),
  tin: z.string().trim().max(64).optional().nullable(),
  address: z.string().trim().max(4000).optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
  email: z.string().trim().max(255).optional().nullable(),
  bizType: z.enum(["SOLE_PROP", "SDN_BHD"]).optional().nullable(),
  logoUrl: z.string().trim().max(512).optional().nullable(),
  payToBank: z.string().trim().max(100).optional().nullable(),
  payToAccountName: z.string().trim().max(200).optional().nullable(),
  payToAccountNo: z.string().trim().max(64).optional().nullable(),
  portalMessage: z.string().trim().max(4000).optional().nullable(),
  currency: z.string().trim().min(3).max(8).optional(),
  workingDays: z.array(z.number().int().min(1).max(7)).min(0).max(7).optional(),
  capacityPerDay: z.number().int().min(1).max(100).optional(),
  invoiceTemplateId: z.string().trim().max(32).optional(),
  quoteNextNumber: z.number().int().min(1).optional(),
  invoiceNextNumber: z.number().int().min(1).optional(),
  quoteIntro: z.string().trim().max(8000).optional().nullable(),
  quoteNotes: z.string().trim().max(8000).optional().nullable(),
  invoiceNotes: z.string().trim().max(8000).optional().nullable(),
  chipEnabled: z.boolean().optional(),
  paymentRemindersEnabled: z.boolean().optional(),
});

export const createOptionItemSchema = z.object({
  label: z.string().trim().min(1).max(200),
});

export const updateOptionItemSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  sortOrder: z.number().int().min(0).optional(),
  retire: z.boolean().optional(),
});

export const replaceRemindersSchema = z.object({
  rules: z.array(
    z.object({
      days: z.number().int().min(0).max(365),
      dir: z.enum(["before", "after", "on"]),
      enabled: z.boolean(),
    }),
  ),
});

export type UpdateStudioBody = z.infer<typeof updateStudioSchema>;
