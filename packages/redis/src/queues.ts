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

// fail fast while redis is down instead of buffering commands until it's back
const connection = { ...getRedisConnectionOptions(), enableOfflineQueue: false };

export const emailQueue = new Queue(QUEUE_NAMES.EMAILS, {
  connection,
  defaultJobOptions,
});

export const notificationQueue = new Queue(QUEUE_NAMES.PUSH_NOTIFICATIONS, {
  connection,
  defaultJobOptions,
});
