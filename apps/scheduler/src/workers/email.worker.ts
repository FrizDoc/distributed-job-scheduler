import { Job, UnrecoverableError } from "bullmq";
import { QUEUE_NAMES } from "@scheduler/redis";
import { createWorker } from "./createWorker";
import { sendEmail } from "../processors/sendEmail";

const processEmailJob = async (job: Job) => {
  switch (job.name) {
    case "sendEmail":
      return sendEmail(job);

    default:
      throw new UnrecoverableError(`Unknown email job: ${job.name}`);
  }
};

export const createEmailWorker = () =>
  createWorker({
    queueName: QUEUE_NAMES.EMAILS,
    processor: processEmailJob,
    concurrency: parseInt(process.env.EMAIL_WORKER_CONCURRENCY || "5", 10),
  });
