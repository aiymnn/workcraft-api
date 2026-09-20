import * as z from "zod";
import { optionalDateTime } from "./quotation.schema.js";

export const publicSessionPatchSchema = z.object({
  id: z.number().int().positive().optional(),
  label: z.string().trim().max(200).optional().nullable(),
  startsAt: optionalDateTime,
  endsAt: optionalDateTime,
  venue: z.string().trim().max(255).optional().nullable(),
});

export const acceptPublicQuotationSchema = z.object({
  agreementAccepted: z.literal(true),
  sessions: z.array(publicSessionPatchSchema).max(50).optional(),
});

export type AcceptPublicQuotationBody = z.infer<
  typeof acceptPublicQuotationSchema
>;
