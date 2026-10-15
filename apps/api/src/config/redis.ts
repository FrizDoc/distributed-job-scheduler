import Redis from "ioredis";

const redisClient = new Redis({
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

redisClient.on("connect", () => {
  console.log("Redis connected");
});

redisClient.on("ready", () => {
  console.log("Redis ready");
});

redisClient.on("error", (error) => {
  console.error("Redis error:", error.message);
});

redisClient.on("reconnecting", (delay: number | null) => {
  console.warn(`Redis reconnecting in ${delay}ms`);
});

redisClient.on("end", () => {
  console.warn("Redis connection ended");
});

export default redisClient;