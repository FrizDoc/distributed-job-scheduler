import { DefaultJobOptions, Queue } from "bullmq";
import { getRedisConnectionOptions, QUEUE_NAMES } from "./index";

const ONE_HOUR = 60 * 60;
const SEVEN_DAYS = 7 * 24 * ONE_HOUR;

// finished jobs are trimmed from redis, the jobs table keeps the history
const defaultJobOptions: DefaultJobOptions = {
  removeOnComplete: {
    age: parseInt(process.env.COMPLETED_JOB_RETENTION_SECONDS || `${ONE_HOUR}`, 10),
    count: 1000,
  },
  removeOnFail: {
    age: parseInt(process.env.FAILED_JOB_RETENTION_SECONDS || `${SEVEN_DAYS}`, 10),
  },
};

export const emailQueue = new Queue(QUEUE_NAMES.EMAILS, {
  connection: getRedisConnectionOptions(),
  defaultJobOptions,
});

export const notificationQueue = new Queue(QUEUE_NAMES.PUSH_NOTIFICATIONS, {
  connection: getRedisConnectionOptions(),
  defaultJobOptions,
});
