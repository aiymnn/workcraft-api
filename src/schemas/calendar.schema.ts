import * as z from "zod";

export const crewSchedulePdfSchema = z.object({
  whoLabel: z.string().trim().min(1).max(120),
  windowLabel: z.string().trim().min(1).max(80),
  rows: z
    .array(
      z.object({
        date: z.string().trim().min(1).max(40),
        start: z.string().trim().min(1).max(20),
        end: z.string().trim().min(1).max(20),
        type: z.string().trim().min(1).max(120),
        clientName: z.string().trim().min(1).max(200),
        venue: z.string().trim().max(255),
        role: z.string().trim().min(1).max(120),
        personName: z.string().trim().max(120).optional().nullable(),
      }),
    )
    .max(400),
});

export type CrewSchedulePdfBody = z.infer<typeof crewSchedulePdfSchema>;
