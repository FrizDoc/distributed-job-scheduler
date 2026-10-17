import { Job } from "bullmq";
import type { QueueJobData } from "@scheduler/redis";

// pass signal to the provider call so a timed out job actually stops
export const sendNotification = async (job: Job<QueueJobData>, _signal?: AbortSignal) => {
  // TODO: hook up push provider
  console.log(`[pushNotifications] Sending notification for job ${job.id}`, job.data.payload);

  return { sentAt: new Date().toISOString() };
};
