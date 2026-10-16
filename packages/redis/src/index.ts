import Redis, { RedisOptions } from "ioredis";

export const QUEUE_NAMES = {
  EMAILS: "emails",
  PUSH_NOTIFICATIONS: "pushNotifications",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// bullmq's connection type doesn't accept a null retryStrategy
export type RedisConnectionOptions = RedisOptions & {
  retryStrategy: (times: number) => number | null;
};

export const getRedisConnectionOptions = (): RedisConnectionOptions => ({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "7000", 10),
  // password: process.env.REDIS_PASSWORD || undefined,

  retryStrategy(times) {
    if (times > 10) {
      return null; // Stop reconnecting after 10 attempts
    }

    return Math.min(times * 500, 5000);
  },
});

export const createRedisConnection = (
  name: string,
  overrides: RedisOptions = {},
): Redis => {
  const client = new Redis({ ...getRedisConnectionOptions(), ...overrides });

  client.on("connect", () => {
    console.log(`[${name}] Redis connected`);
  });

  client.on("ready", () => {
    console.log(`[${name}] Redis ready`);
  });

  client.on("error", (error) => {
    console.error(`[${name}] Redis error:`, error.message);
  });

  client.on("reconnecting", (delay: number | null) => {
    console.warn(`[${name}] Redis reconnecting in ${delay}ms`);
  });

  client.on("end", () => {
    console.warn(`[${name}] Redis connection ended`);
  });

  return client;
};

export { Redis };
export type { RedisOptions };
