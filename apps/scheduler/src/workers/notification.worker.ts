import { Job, UnrecoverableError } from "bullmq";
import { QUEUE_NAMES } from "@scheduler/redis";
import { createWorker } from "./createWorker";
import { sendNotification } from "../processors/sendNotification";

const processNotificationJob = async (job: Job) => {
  switch (job.name) {
    case "sendNotification":
      return sendNotification(job);

    default:
      throw new UnrecoverableError(`Unknown notification job: ${job.name}`);
  }
};

export const createNotificationWorker = () =>
  createWorker({
    queueName: QUEUE_NAMES.PUSH_NOTIFICATIONS,
    processor: processNotificationJob,
    concurrency: parseInt(
      process.env.NOTIFICATION_WORKER_CONCURRENCY || "10",
      10,
    ),
  });
