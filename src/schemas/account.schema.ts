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
  newEmail: z.string().trim().toLowerCase().pipe(z.email().max(255)),
  password: z.string().min(1).max(128),
});

export const confirmEmailChangeSchema = z.object({
  token: z.string().trim().min(16).max(128),
});

export const confirm2faSchema = z.object({
  code: z.string().trim().length(6),
});

/** Either proof works — password for the usual case, code from the app. */
export const disable2faSchema = z
  .object({
    password: z.string().min(1).max(128).optional(),
    code: z.string().trim().length(6).optional(),
  })
  .refine((value) => Boolean(value.password ?? value.code), {
    message: "Confirm with your password or a 6-digit code.",
  });

export const googleOauthPurposeSchema = z.enum(["calendar", "drive"]);

export const googleOauthActionSchema = z.object({
  purpose: googleOauthPurposeSchema,
});

export const footagePortalSchema = z.object({
  enabled: z.boolean(),
});

export type UpdateAccountProfileBody = z.infer<
  typeof updateAccountProfileSchema
>;
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;
export type ChangeEmailBody = z.infer<typeof changeEmailSchema>;
export type Disable2faBody = z.infer<typeof disable2faSchema>;
export type GoogleOauthActionBody = z.infer<typeof googleOauthActionSchema>;
