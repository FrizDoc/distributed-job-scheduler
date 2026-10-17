import { Job, Processor, Worker } from "bullmq";
import type { JobStatus } from "@scheduler/validations";
import { getRedisConnectionOptions, QueueJobData, QueueName } from "@scheduler/redis";
import { updateJobStatus } from "../lib/jobStatus";

type CreateWorkerOptions = {
  queueName: QueueName;
  processor: Processor<QueueJobData>;
  concurrency: number;
};

// writes for the same job are chained so "active" can't land after "completed"
const pendingWrites = new Map<string, Promise<void>>();

const syncStatus = (job: Job, status: JobStatus) => {
  // runs created by a job scheduler have their own ids, the row is keyed by the scheduler id
  const jobId = job.repeatJobKey ?? job.id;
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

// promise.race can't stop the processor itself, so it also gets the signal to abort its own work
const withTimeout =
  (processor: Processor<QueueJobData>): Processor<QueueJobData> =>
  async (job, token, signal) => {
    const timeoutMs = job.data.timeoutMs;
    if (!timeoutMs) return processor(job, token, signal);

    const controller = new AbortController();
    signal?.addEventListener("abort", () => controller.abort(signal.reason));

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(`Job timed out after ${timeoutMs}ms`);
        controller.abort(error);
        reject(error);
      }, timeoutMs);
    });

    try {
      return await Promise.race([processor(job, token, controller.signal), timeout]);
    } finally {
      clearTimeout(timer);
    }
  };

export const createWorker = ({ queueName, processor, concurrency }: CreateWorkerOptions) => {
  const worker = new Worker(queueName, withTimeout(processor), {
    connection: {
      ...getRedisConnectionOptions(),
      maxRetriesPerRequest: null,
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
