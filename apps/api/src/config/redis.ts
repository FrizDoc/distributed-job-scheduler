import { createRedisConnection } from "@scheduler/redis";

// fail fast so the rate limiter fails open instead of hanging while redis is down
const redisClient = createRedisConnection("api", { enableOfflineQueue: false });

export default redisClient;
