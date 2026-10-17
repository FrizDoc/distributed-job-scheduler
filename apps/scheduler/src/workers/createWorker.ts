import { Job, Processor, Worker } from "bullmq";
import type { JobStatus } from "@scheduler/validations";
import { getRedisConnectionOptions, QueueName } from "@scheduler/redis";
import { updateJobStatus } from "../lib/jobStatus";

type CreateWorkerOptions = {
  queueName: QueueName;
  processor: Processor;
  concurrency: number;
};

// writes for the same job are chained so "active" can't land after "completed"
const pendingWrites = new Map<string, Promise<void>>();

const syncStatus = (job: Job, status: JobStatus) => {
  const jobId = job.id;
  if (jobId == null) return;

  const previous = pendingWrites.get(jobId) ?? Promise.resolve();

  const write = previous
    .then(() => updateJobStatus(jobId, status))
    .catch((error) => {
      console.error(`Failed to set ${jobId} to ${status}:`, error);
    })
    .finally(() => {
      if (pendingWrites.get(jobId) === write) pendingWrites.delete(jobId);
    });

  pendingWrites.set(jobId, write);
};

export const flushStatusWrites = () => Promise.all(pendingWrites.values());

export const createWorker = ({ queueName, processor, concurrency }: CreateWorkerOptions) => {
  const worker = new Worker(queueName, processor, {
    connection: {
      ...getRedisConnectionOptions(),
      maxRetriesPerRequest: null,
      retryStrategy: (times: number) => Math.min(times * 500, 5000),
    },
    concurrency,
  });

  worker.on("ready", () => {
    console.log(`[${queueName}] Worker ready (concurrency ${concurrency})`);
  });

  worker.on("active", (job) => {
    syncStatus(job, "active");
  });

  worker.on("completed", (job) => {
    console.log(`[${queueName}] Job ${job.id} completed`);
    syncStatus(job, "completed");
  });

  worker.on("failed", (job, error) => {
    if (!job) {
      console.error(`[${queueName}] Job failed:`, error.message);
      return;
    }

    const attempts = job.opts.attempts || 1;
    const willRetry = job.attemptsMade < attempts && error.name !== "UnrecoverableError";

    console.error(
      `[${queueName}] Job ${job.id} failed (attempt ${job.attemptsMade}/${attempts}):`,
      error.message,
    );

    syncStatus(job, willRetry ? "waiting" : "failed");
  });

  worker.on("stalled", (jobId) => {
    console.warn(`[${queueName}] Job ${jobId} stalled`);
  });

  worker.on("error", (error) => {
    console.error(`[${queueName}] Worker error:`, error.message);
  });

  return worker;
};
