import { eq } from "drizzle-orm";
import db, { jobsTable } from "@scheduler/db";
import type { JobStatus } from "@scheduler/validations";

export const updateJobStatus = async (queueJobId: string, status: JobStatus) => {
  const updated = await db
    .update(jobsTable)
    .set({ status })
    .where(eq(jobsTable.jobId, queueJobId))
    .returning({ id: jobsTable.id });

  if (updated.length === 0) {
    console.warn(`No jobs row for ${queueJobId} (status: ${status})`);
  }
};
