import { Job } from "bullmq";

export type EmailPayload = Record<string, unknown>;

export const sendEmail = async (job: Job<EmailPayload>) => {
  // TODO: hook up email provider
  console.log(`[emails] Sending email for job ${job.id}`, job.data);

  return { sentAt: new Date().toISOString() };
};
