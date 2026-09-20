import * as z from "zod";

/** `period` is the quick filter; `from`/`to` are ISO dates and take priority. */
export const dashboardQuerySchema = z.object({
  period: z.enum(["7", "30", "90"]).optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
