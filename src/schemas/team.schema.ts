import * as z from "zod";

const craftItemIdsSchema = z.array(z.number().int().positive()).max(50);

export const createTeamMemberSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  phone: z.string().trim().max(32).optional().nullable(),
  access: z.enum(["ADMIN", "MEMBER"]),
  craftItemIds: craftItemIdsSchema.optional(),
});

export const updateTeamMemberSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().max(32).optional().nullable(),
  access: z.enum(["ADMIN", "MEMBER"]).optional(),
  craftItemIds: craftItemIdsSchema.optional(),
});

export const createCrewContactSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(32).optional().nullable(),
  email: z
    .union([z.string().trim().email().max(255), z.literal("")])
    .optional()
    .nullable(),
  craftItemIds: craftItemIdsSchema.optional(),
});

export const updateCrewContactSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(32).optional().nullable(),
  email: z
    .union([z.string().trim().email().max(255), z.literal("")])
    .optional()
    .nullable(),
  craftItemIds: craftItemIdsSchema.optional(),
  retired: z.boolean().optional(),
});

export type CreateTeamMemberBody = z.infer<typeof createTeamMemberSchema>;
export type UpdateTeamMemberBody = z.infer<typeof updateTeamMemberSchema>;
export type CreateCrewContactBody = z.infer<typeof createCrewContactSchema>;
export type UpdateCrewContactBody = z.infer<typeof updateCrewContactSchema>;
