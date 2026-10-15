import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import express, { Express, Request, Response } from "express";
import jobRouter from "./routes/route.jobs";
import authRouter from "./routes/auth.route";

const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/", jobRouter);
app.use("/api/auth", authRouter);

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "Welcome to the API!" });
});

export default app;
