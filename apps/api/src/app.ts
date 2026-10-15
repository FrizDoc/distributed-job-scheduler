import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import express, { Express, NextFunction, Request, Response } from "express";
import jobRouter from "./routes/route.jobs";
import authRouter from "./routes/auth.route";
import { rateLimiter } from "./middleware/rateLimiter";

const app: Express = express();

app.use(rateLimiter); // Apply rate limiting middleware to all routes
app.use(express.json());

app.use("/api/", jobRouter);
app.use("/api/auth", authRouter);

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "Welcome to the API!" });
});


app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Postgres unique violation, e.g. two concurrent registrations with one email.
  if (err?.cause?.code === "23505") {
    return res.status(409).json({ message: "Resource already exists!" });
  }

  // Client errors raised by Express itself, e.g. malformed JSON from express.json().
  if (err?.status >= 400 && err?.status < 500) {
    return res.status(err.status).json({ message: err.expose ? err.message : "Bad request" });
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

export default app;
