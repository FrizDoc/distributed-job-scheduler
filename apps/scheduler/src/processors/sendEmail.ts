import { Job } from "bullmq";
import type { QueueJobData } from "@scheduler/redis";

// pass signal to the provider call so a timed out job actually stops
export const sendEmail = async (job: Job<QueueJobData>, _signal?: AbortSignal) => {
  // TODO: hook up email provider
  console.log(`[emails] Sending email for job ${job.id}`, job.data.payload);

  // stands in for provider latency when benchmarking, off by default
  const simulatedMs = parseInt(process.env.SIMULATED_SEND_MS || "0", 10);
  if (simulatedMs > 0) await new Promise((resolve) => setTimeout(resolve, simulatedMs));

  return { sentAt: new Date().toISOString() };
};
