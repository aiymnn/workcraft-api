import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "../db/database.js";
import { jobActivity } from "../db/schema/job_activity.js";
import { jobs } from "../db/schema/jobs.js";
import { JobServiceError } from "./job.service.js";

export type JobActivityChannel = (typeof jobActivity.$inferSelect)["channel"];

export type CreateJobActivityInput = {
  channel: JobActivityChannel;
  kind: string;
  subject?: string | null;
  summary?: string | null;
  invoiceId?: number | null;
};

async function assertJobInStudio(studioId: number, jobId: number) {
  const rows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.studioId, studioId)))
    .limit(1);
  if (!rows[0]) {
    throw new JobServiceError("Job not found.", 404);
  }
}

export async function listJobActivity(studioId: number, jobId: number) {
  await assertJobInStudio(studioId, jobId);

  const items = await db
    .select()
    .from(jobActivity)
    .where(eq(jobActivity.jobId, jobId))
    .orderBy(desc(jobActivity.createdAt), desc(jobActivity.id));

  return { items };
}

export async function createJobActivity(
  studioId: number,
  jobId: number,
  input: CreateJobActivityInput,
) {
  await assertJobInStudio(studioId, jobId);

  const result = await db.insert(jobActivity).values({
    jobId,
    channel: input.channel,
    kind: input.kind.trim(),
    subject: input.subject?.trim() || null,
    summary: input.summary ?? null,
    invoiceId: input.invoiceId ?? null,
  });

  const id = result[0].insertId;
  const rows = await db
    .select()
    .from(jobActivity)
    .where(eq(jobActivity.id, id))
    .orderBy(asc(jobActivity.id))
    .limit(1);

  const activity = rows[0];
  if (!activity) {
    throw new JobServiceError("Failed to create job activity.", 500);
  }
  return activity;
}
