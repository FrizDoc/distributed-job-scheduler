import { Request, Response } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { emailQueue, notificationQueue } from "@scheduler/redis/queues";
import db, { jobsTable } from "@scheduler/db";

type AuthedRequest = Request & { user: { id: number } };

const EDITABLE_STATES = ["waiting", "delayed", "prioritized", "paused"];

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

    const [savedJob] = await db
      .insert(jobsTable)
      .values({
        name: jobData.name,
        status: "waiting",
        userId,
        metadata: jobData,
      })
      .returning({ id: jobsTable.id });

    if (!savedJob) {
      throw new Error("Failed to persist job");
    }

    // bullmq doesn't allow purely numeric custom ids
    const queueJobId = `job-${savedJob.id}`;

    await db
      .update(jobsTable)
      .set({ jobId: queueJobId })
      .where(eq(jobsTable.id, savedJob.id));

    try {
      await target.queue.add(target.jobName, jobData.payload, {
        jobId: queueJobId,
        attempts: jobData.attempts,
        backoff: jobData.backoff,
      });
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

    let job;
    switch (queueName) {
      case "emails":
        job = await emailQueue.getJob(record.jobId);
        break;
      case "notifications":
        job = await notificationQueue.getJob(record.jobId);
        break;
      default:
        return res.status(400).json({ error: "Invalid queue name" });
    }

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
    const { status, page, limit, order } = res.locals.validated.query;
    const userId = (req as AuthedRequest).user.id;

    const conditions = [eq(jobsTable.userId, userId)];
    if (status) conditions.push(eq(jobsTable.status, status));

    const jobs = await db
      .select()
      .from(jobsTable)
      .where(and(...conditions))
      .orderBy(order === "asc" ? asc(jobsTable.created_at) : desc(jobsTable.created_at))
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
        ? (record.metadata as Record<string, unknown>)
        : {};

    const target = getQueueForType(existingMetadata.type);
    if (!target) {
      return res.status(400).json({ message: "Unsupported job type" });
    }

    if (data.payload) {
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

      await queueJob.updateData(data.payload);
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
