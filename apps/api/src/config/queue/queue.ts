import { Queue } from 'bullmq';


export const emailQueue = new Queue('emails', {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "7000", 10),
  },
});


export const notificationQueue = new Queue('pushNotifications', {
  connection: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "7000", 10),
  },
});