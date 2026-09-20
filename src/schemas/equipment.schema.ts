import * as z from "zod";

export const equipmentStatuses = [
  "IN_STUDIO",
  "ON_JOB",
  "WITH_CREW",
  "IN_REPAIR",
  "RETIRED",
] as const;

export const createEquipmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().max(100).optional().nullable(),
  serial: z.string().trim().max(100).optional().nullable(),
  status: z.enum(equipmentStatuses).optional(),
  notes: z.string().trim().max(5000).optional().nullable(),
  jobId: z.number().int().min(1).optional().nullable(),
  crewContactId: z.number().int().min(1).optional().nullable(),
});

export const updateEquipmentSchema = createEquipmentSchema.partial();

export type CreateEquipmentBody = z.infer<typeof createEquipmentSchema>;
export type UpdateEquipmentBody = z.infer<typeof updateEquipmentSchema>;
