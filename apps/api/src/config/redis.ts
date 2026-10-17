import { createRedisConnection } from "@scheduler/redis";

const redisClient = createRedisConnection("api");

export default redisClient;
