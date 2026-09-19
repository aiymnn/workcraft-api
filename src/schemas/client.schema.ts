import * as z from "zod";

export const createClientSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(32).optional().nullable(),
  email: z
    .union([z.string().trim().email().max(255), z.literal("")])
    .optional()
    .nullable(),
  nricOrSsm: z.string().trim().max(64).optional().nullable(),
  tin: z.string().trim().max(64).optional().nullable(),
  socialHandle: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(2000).optional().nullable(),
  whatsappConsent: z.boolean().optional(),
});

export const updateClientSchema = createClientSchema.partial();

export type CreateClientBody = z.infer<typeof createClientSchema>;
export type UpdateClientBody = z.infer<typeof updateClientSchema>;
