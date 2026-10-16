import { Request, Response } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { emailQueue, notificationQueue } from "../config/queue/queue";
import { jobsTable } from "../db/schema";
import db from "../db";




type JobInfo = {
  persistentJobId: string | number;
  queueJobId: string;
  queueName: "email" | "notification";
};

export const addJob = async (req: Request, res: Response) => {
  try {
    const jobData = res.locals.validated.body;
    const userId = (req as Request & { user: { id: number } }).user.id;

    let jobInfo: JobInfo;

    switch (jobData.type) {
      case "email": {
        const queueJob = await emailQueue.add(
          "sendEmail",
          jobData.payload,
        );

        if (queueJob.id == null) {
          throw new Error("BullMQ did not return an email job ID");
        }

        const [savedJob] = await db
          .insert(jobsTable)
          .values({
            name: jobData.name,
            status: "pending",
            userId,
            jobId: queueJob.id,
            metadata: jobData,
          })
          .returning({ id: jobsTable.id });

        if (!savedJob) {
          throw new Error("Failed to persist email job");
        }

        jobInfo = {
          persistentJobId: savedJob.id,
          queueJobId: queueJob.id,
          queueName: "email",
        };

        break;
      }

      case "notification": {
        const queueJob = await notificationQueue.add(
          "sendNotification",
          jobData.payload,
        );

        if (queueJob.id == null) {
          throw new Error("BullMQ did not return a notification job ID");
        }

        const [savedJob] = await db
          .insert(jobsTable)
          .values({
            name: jobData.name,
            status: "pending",
            userId,
            jobId: queueJob.id,
            metadata: jobData,
          })
          .returning({ id: jobsTable.id });

        if (!savedJob) {
          throw new Error("Failed to persist notification job");
        }

        jobInfo = {
          persistentJobId: savedJob.id,
          queueJobId: queueJob.id,
          queueName: "notification",
        };

        break;
      }

      default:
        return res.status(400).json({
          error: "Invalid job type",
        });
    }

    return res.status(201).json({
      message: "Job added successfully",
      jobInfo,
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
    const userId = (req as Request & { user: { id: number } }).user.id;

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

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.status(200).json({ message: "Job fetched successfully!", job });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch job" });
  }
};
export const getJobs = async (req: Request, res: Response) => {
  try {
    const { status, page, limit, order } = res.locals.validated.query;
    const userId = (req as Request & { user: { id: number } }).user.id;

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
    const { jobId } = req.params;
    const { jobData } = req.body;

    res
      .status(200)
      .json({ message: "Job updated successfully!", jobId, jobData });
  } catch (error) {
    res.status(500).json({ error: "Failed to update job" });
  }
};
