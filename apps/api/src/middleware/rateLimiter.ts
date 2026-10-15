import redisClient from "../config/redis";

import { Request, Response, NextFunction } from "express";

export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const key = `ratelimit:${req.ip}`;
  const currentTime = Date.now();
  const windowSizeInMilliseconds = 60 * 1000; // 1 minute
  const maxRequestsPerWindow = 10; // Maximum requests allowed per window

  const current = redisClient.incr(key);
  redisClient.expire(key, windowSizeInMilliseconds / 1000);
  current.then((count) => {
    if (count > maxRequestsPerWindow) {
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    next();
  }).catch((err) => {
    console.error("Redis error:", err);
    next();
  });

}