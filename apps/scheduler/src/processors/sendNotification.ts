import { Job } from "bullmq";

export type NotificationPayload = Record<string, unknown>;

export const sendNotification = async (job: Job<NotificationPayload>) => {
  // TODO: hook up push provider
  console.log(
    `[pushNotifications] Sending notification for job ${job.id}`,
    job.data,
  );

  return { sentAt: new Date().toISOString() };
};
