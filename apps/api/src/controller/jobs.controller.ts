import { Request, Response } from "express";
import { email } from "zod";
import { emailQueue, notificationQueue } from "../config/queue/queue";
import { jobsTable } from "../db/schema";
import db from "../db";


export const addJob = async (req: Request, res: Response) => {
  try {
    const { jobData } = res.locals.validated.body;

    console.log(res.locals.validated)
    console.log(jobData?.type)
    switch (jobData?.type) {
      case "email":
        const saveEmailJob = await db.insert(jobsTable).values({
          title: jobData.title,
          description: jobData.description,
          status: "pending",
          userId: jobData.userId,
          metadata: jobData
        }).returning({ id: jobData.id });
        await emailQueue.add("sendEmail", jobData.payload);
        break;
      case "notification":
        const saveNotificaitonJob = await db.insert(jobsTable).values({
          title: jobData.title,
          description: jobData.description,
          status: "pending",
          userId: jobData.userId,
          metadata: jobData
        }).returning({ id: jobsTable.id });
        await notificationQueue.add("sendNotification", jobData.payload);
        break;
      default:
        return res.status(400).json({ error: "Invalid job type" });
    }
    res.status(201).json({ message: "Job added successfully!", jobData });
  } catch (error) {
    console.log(error)
    res.status(500).json({ error: "Failed to add job" });
  }
};


export const getJobById = async (req: Request, res: Response) => {
  try {
    const { jobId, queueName } = req.params;
    // emailQueue.getJob(jobId).then((job) => {
    //   if (!job) {
    //     return res.status(404).json({ error: "Job not found" });
    //   }
    //   res.status(200).json({ job });
    // }



    // res.status(200).json({ job });

    res.json({ message: "Job fetched successfully!", jobId, queueName });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch job" });
  }
};
export const getJobs = async (req: Request, res: Response) => {
  try {
    const { jobs } = req.body;
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
