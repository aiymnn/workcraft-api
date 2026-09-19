import * as z from "zod";

const optionalDateTime = z
  .union([z.string().datetime({ offset: true }), z.string().min(1), z.null()])
  .optional()
  .nullable();

const requiredDateTime = z.union([
  z.string().datetime({ offset: true }),
  z.string().min(1),
]);

export const jobStatuses = ["CONFIRMED", "COMPLETED", "CANCELLED"] as const;
export const deliverableStatuses = [
  "PENDING",
  "IN_PROGRESS",
  "DELIVERED",
] as const;
export const jobContractStatuses = ["DRAFT", "SENT", "SIGNED"] as const;
export const checklistPhases = ["BEFORE", "ON_DAY", "AFTER"] as const;

export const sessionCrewSchema = z
  .object({
    studioMemberId: z.number().int().positive().optional().nullable(),
    crewContactId: z.number().int().positive().optional().nullable(),
    crewRoleItemId: z.number().int().positive().optional().nullable(),
  })
  .refine(
    (row) => row.studioMemberId != null || row.crewContactId != null,
    { message: "Crew row needs a studio member or crew contact." },
  );

export const jobSessionSchema = z.object({
  ceremonyTypeItemId: z.number().int().positive().optional().nullable(),
  label: z.string().trim().max(200).optional().nullable(),
  startsAt: requiredDateTime,
  endsAt: optionalDateTime,
  venue: z.string().trim().max(255).optional().nullable(),
  crew: z.array(sessionCrewSchema).max(50).optional(),
});

export const checklistItemSchema = z.object({
  label: z.string().trim().min(1).max(255),
  phase: z.enum(checklistPhases),
  done: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const deliverableSchema = z.object({
  title: z.string().trim().min(1).max(255),
  status: z.enum(deliverableStatuses).optional(),
  clientVisible: z.boolean().optional(),
  url: z.string().trim().max(512).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export const jobContractSchema = z.object({
  name: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(100_000),
  status: z.enum(jobContractStatuses).optional(),
});

export const createJobSchema = z.object({
  clientId: z.number().int().positive(),
  quotationId: z.number().int().positive().optional().nullable(),
  status: z.enum(jobStatuses).optional(),
  jobTypeItemId: z.number().int().positive().optional().nullable(),
  leadSourceItemId: z.number().int().positive().optional().nullable(),
  cancelReasonItemId: z.number().int().positive().optional().nullable(),
  notes: z.string().trim().max(8000).optional().nullable(),
  sessions: z.array(jobSessionSchema).max(50).optional(),
  checklistItems: z.array(checklistItemSchema).max(200).optional(),
  deliverables: z.array(deliverableSchema).max(100).optional(),
  contracts: z.array(jobContractSchema).max(20).optional(),
});

export const updateJobSchema = z.object({
  clientId: z.number().int().positive().optional(),
  quotationId: z.number().int().positive().optional().nullable(),
  status: z.enum(jobStatuses).optional(),
  jobTypeItemId: z.number().int().positive().optional().nullable(),
  leadSourceItemId: z.number().int().positive().optional().nullable(),
  cancelReasonItemId: z.number().int().positive().optional().nullable(),
  notes: z.string().trim().max(8000).optional().nullable(),
  sessions: z.array(jobSessionSchema).max(50).optional(),
  checklistItems: z.array(checklistItemSchema).max(200).optional(),
  deliverables: z.array(deliverableSchema).max(100).optional(),
  contracts: z.array(jobContractSchema).max(20).optional(),
});

export const patchChecklistItemSchema = z.object({
  done: z.boolean().optional(),
  label: z.string().trim().min(1).max(255).optional(),
  phase: z.enum(checklistPhases).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const patchDeliverableSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  status: z.enum(deliverableStatuses).optional(),
  clientVisible: z.boolean().optional(),
  url: z.string().trim().max(512).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateJobBody = z.infer<typeof createJobSchema>;
export type UpdateJobBody = z.infer<typeof updateJobSchema>;
