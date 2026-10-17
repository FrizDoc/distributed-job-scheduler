import { Request, Response } from "express";
import { and, eq, sql, SQL } from "drizzle-orm";
import { JobsOptions } from "bullmq";
import { emailQueue, notificationQueue } from "@scheduler/redis/queues";
import type { QueueJobData } from "@scheduler/redis";
import db, { jobsTable } from "@scheduler/db";
import type { CreateJobInput, JobPriority } from "@scheduler/validations";

type AuthedRequest = Request & { user: { id: number } };

const EDITABLE_STATES = ["waiting", "delayed", "prioritized", "paused"];

// bullmq runs lower numbers first
const PRIORITY_RANK: Record<JobPriority, number> = { high: 1, medium: 2, low: 3 };

// metadata is the validated create body, read back from json (so runAt is a string there)
type JobMetadata = Pick<CreateJobInput, "payload" | "priority" | "attempts" | "backoff" | "timeoutMs"> & {
  type?: string;
  repeat?: CreateJobInput["repeat"];
};

const toQueueJob = (job: JobMetadata) => {
  const data: QueueJobData = { payload: job.payload, timeoutMs: job.timeoutMs };
  const opts: JobsOptions = {
    attempts: job.attempts,
    backoff: job.backoff,
    priority: PRIORITY_RANK[job.priority],
  };
  return { data, opts };
};

const getQueueForType = (type: unknown) => {
  switch (type) {
    case "email":
      return { queue: emailQueue, jobName: "sendEmail" };
    case "notification":
      return { queue: notificationQueue, jobName: "sendNotification" };
    default:
      return null;
  }
};

export const addJob = async (req: Request, res: Response) => {
  try {
    const jobData = res.locals.validated.body;
    const userId = (req as AuthedRequest).user.id;

    const target = getQueueForType(jobData.type);
    if (!target) {
      return res.status(400).json({ error: "Invalid job type" });
    }

    const isScheduled = Boolean(jobData.runAt || jobData.repeat);

    const [savedJob] = await db
      .insert(jobsTable)
      .values({
        name: jobData.name,
        status: isScheduled ? "delayed" : "waiting",
        userId,
        metadata: jobData,
      })
      .returning({ id: jobsTable.id });

    if (!savedJob) {
      throw new Error("Failed to persist job");
    }

    // bullmq doesn't allow purely numeric custom ids
    const queueJobId = `job-${savedJob.id}`;

    await db.update(jobsTable).set({ jobId: queueJobId }).where(eq(jobsTable.id, savedJob.id));

    const { data, opts } = toQueueJob(jobData);

    try {
      if (jobData.repeat) {
        // the scheduler id doubles as the row's job id, each run carries it as repeatJobKey
        await target.queue.upsertJobScheduler(queueJobId, jobData.repeat, {
          name: target.jobName,
          data,
          opts,
        });
      } else {
        await target.queue.add(target.jobName, data, {
          ...opts,
          jobId: queueJobId,
          ...(jobData.runAt && { delay: Math.max(0, jobData.runAt.getTime() - Date.now()) }),
        });
      }
    } catch (error) {
      await db.delete(jobsTable).where(eq(jobsTable.id, savedJob.id));
      throw error;
    }

    return res.status(201).json({
      message: "Job added successfully",
      jobInfo: {
        persistentJobId: savedJob.id,
        queueJobId,
        queueName: jobData.type,
      },
    });
  } catch (error) {
    console.error("Failed to add job:", error);

    return res.status(500).json({
      error: "Failed to add job",
    });
  }
};

export const getJobById = async (req: Request, res: Response) => {
  try {
    const { jobId } = res.locals.validated.params;
    const { queueName } = res.locals.validated.query;
    const userId = (req as AuthedRequest).user.id;

    const [record] = await db
      .select()
      .from(jobsTable)
      .where(and(eq(jobsTable.id, jobId), eq(jobsTable.userId, userId)))
      .limit(1);

    if (!record || record.jobId == null) {
      return res.status(404).json({ error: "Job not found" });
    }

    let queue;
    switch (queueName) {
      case "emails":
        queue = emailQueue;
        break;
      case "notifications":
        queue = notificationQueue;
        break;
      default:
        return res.status(400).json({ error: "Invalid queue name" });
    }

    const metadata = (record.metadata ?? {}) as JobMetadata;

    // repeating jobs live in redis as a scheduler, not as a single job
    if (metadata.repeat) {
      const schedule = await queue.getJobScheduler(record.jobId);
      return res.status(200).json({
        message: "Job fetched successfully!",
        record,
        schedule: schedule ?? null,
      });
    }

    const job = await queue.getJob(record.jobId);

    // job is null once redis has cleared it, the record still has the final status
    res.status(200).json({
      message: "Job fetched successfully!",
      record,
      job: job ?? null,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch job" });
  }
};

export const getJobs = async (req: Request, res: Response) => {
  try {
    const { status, queue, priority, page, limit, sortBy, order } = res.locals.validated.query;
    const userId = (req as AuthedRequest).user.id;

    const conditions: SQL[] = [eq(jobsTable.userId, userId)];
    if (status) conditions.push(eq(jobsTable.status, status));
    if (queue) conditions.push(sql`${jobsTable.metadata}->>'queue' = ${queue}`);
    if (priority) conditions.push(sql`${jobsTable.metadata}->>'priority' = ${priority}`);

    const sortColumns: Record<typeof sortBy, SQL> = {
      createdAt: sql`${jobsTable.created_at}`,
      runAt: sql`(${jobsTable.metadata}->>'runAt')::timestamptz`,
      // so "desc" puts high priority first
      priority: sql`case ${jobsTable.metadata}->>'priority' when 'high' then 3 when 'medium' then 2 else 1 end`,
    };
    const direction = sql.raw(order === "asc" ? "asc" : "desc");

    const jobs = await db
      .select()
      .from(jobsTable)
      .where(and(...conditions))
      // id breaks ties so pages don't shuffle, nulls last keeps jobs without a runAt at the end
      .orderBy(
        sql`${sortColumns[sortBy]} ${direction} nulls last`,
        sql`${jobsTable.id} ${direction}`,
      )
      .limit(limit)
      .offset((page - 1) * limit);

    res.status(200).json({ jobs });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
};

export const updateJob = async (req: Request, res: Response) => {
  try {
    const { jobId } = res.locals.validated.params;
    const data = res.locals.validated.body;
    const userId = (req as AuthedRequest).user.id;

    const [record] = await db
      .select({
        id: jobsTable.id,
        metadata: jobsTable.metadata,
        jobId: jobsTable.jobId,
      })
      .from(jobsTable)
      .where(and(eq(jobsTable.id, jobId), eq(jobsTable.userId, userId)))
      .limit(1);

    if (!record || record.jobId == null) {
      return res.status(404).json({ message: "Job not found" });
    }

    const existingMetadata =
      typeof record.metadata === "object" &&
      record.metadata !== null &&
      !Array.isArray(record.metadata)
        ? (record.metadata as JobMetadata)
        : ({} as JobMetadata);

    const target = getQueueForType(existingMetadata.type);
    if (!target) {
      return res.status(400).json({ message: "Unsupported job type" });
    }

    if (data.payload && existingMetadata.repeat) {
      // a schedule can always be edited, the new payload applies from the next run
      const schedule = await target.queue.getJobScheduler(record.jobId);
      if (!schedule) {
        return res.status(409).json({ message: "Job schedule has already ended" });
      }

      const { data: queueData, opts } = toQueueJob({ ...existingMetadata, payload: data.payload });
      await target.queue.upsertJobScheduler(record.jobId, existingMetadata.repeat, {
        name: target.jobName,
        data: queueData,
        opts,
      });
    } else if (data.payload) {
      const queueJob = await target.queue.getJob(record.jobId);
      if (!queueJob) {
        return res.status(409).json({
          message: "Job payload can't be changed once it has finished",
        });
      }

      const state = await queueJob.getState();
      if (!EDITABLE_STATES.includes(state)) {
        return res.status(409).json({
          message: `Job payload can't be changed once it is ${state}`,
        });
      }

      await queueJob.updateData({ ...queueJob.data, payload: data.payload });
    }

    const metadata = {
      ...existingMetadata,
      ...(data.name && { name: data.name }),
      ...(data.payload && { payload: data.payload }),
    };

    await db
      .update(jobsTable)
      .set({ metadata, ...(data.name && { name: data.name }) })
      .where(and(eq(jobsTable.id, record.id), eq(jobsTable.userId, userId)));

    return res.status(200).json({
      message: "Job updated successfully",
    });
  } catch (error) {
    console.error("Failed to update job:", error);

    return res.status(500).json({
      message: "Failed to update job",
    });
  }
};
