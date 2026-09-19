import * as z from "zod";

export const updateAccountProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(32).optional().nullable(),
  waUpdatesOptIn: z.boolean().optional(),
  myBillsRemindersEnabled: z.boolean().optional(),
  myBillsDaysBefore: z.number().int().min(0).max(365).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

export const changeEmailSchema = z.object({
  newEmail: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

export const enroll2faSchema = z.object({
  code: z.string().trim().length(6).optional(),
});

export type UpdateAccountProfileBody = z.infer<
  typeof updateAccountProfileSchema
>;
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
