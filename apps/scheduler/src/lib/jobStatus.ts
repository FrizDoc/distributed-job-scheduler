import { eq, sql } from "drizzle-orm";
import db, { jobsTable } from "@scheduler/db";
import type { JobStatus } from "@scheduler/validations";

export const updateJobStatus = async (queueJobId: string, status: JobStatus) => {
  const updated = await db
    .update(jobsTable)
    // db clock like created_at, so worker clock skew doesn't leak into end-to-end timings
    // retries keep the first start, so started_at - created_at is the initial queue wait
    .set({
      status,
      ...(status === "active" && { started_at: sql`coalesce(${jobsTable.started_at}, now())` }),
      ...(status === "completed" && { completed_at: sql`now()` }),
    })
    .where(eq(jobsTable.jobId, queueJobId))
    .returning({ id: jobsTable.id });

  if (updated.length === 0) {
    console.warn(`No jobs row for ${queueJobId} (status: ${status})`);
  }
};
