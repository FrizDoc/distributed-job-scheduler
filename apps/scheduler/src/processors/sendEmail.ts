import { Job } from "bullmq";
import type { QueueJobData } from "@scheduler/redis";

// pass signal to the provider call so a timed out job actually stops
export const sendEmail = async (job: Job<QueueJobData>, _signal?: AbortSignal) => {
  // TODO: hook up email provider
  console.log(`[emails] Sending email for job ${job.id}`, job.data.payload);

  return { sentAt: new Date().toISOString() };
};
