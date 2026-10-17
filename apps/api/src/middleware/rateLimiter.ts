import redisClient from "../config/redis";

import { Request, Response, NextFunction } from "express";

export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
  const key = `ratelimit:${req.ip}`;
  const windowSizeInMilliseconds = 60 * 1000; // 1 minute
  const maxRequestsPerWindow = parseInt(process.env.RATE_LIMIT_MAX || "10", 10); // Maximum requests allowed per window

  try {
    const count = await redisClient.incr(key);

    // only set the ttl on the first hit so the window doesn't keep sliding
    if (count === 1) {
      await redisClient.expire(key, windowSizeInMilliseconds / 1000);
    }

    if (count > maxRequestsPerWindow) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
  } catch (err) {
    console.error("Redis error:", err);
  }

  next();
};
