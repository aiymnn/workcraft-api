import * as z from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8),
});

export const loginTwoFactorSchema = z.object({
  tempToken: z.string().min(10),
  code: z.string().trim().min(6).max(6),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type LoginTwoFactorInput = z.infer<typeof loginTwoFactorSchema>;
