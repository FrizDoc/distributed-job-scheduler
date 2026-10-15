import express, { Request, Response } from "express";
import {
  addJob,
  getJobById,
  getJobs,
  updateJob,
} from "../controller/jobs.controller";
import { validate } from "../middleware/validate";
import {
  createJobSchema,
  jobIdParamsSchema,
  listJobsQuerySchema,
  updateJobSchema,
} from "@scheduler/validations";

const jobRouter = express.Router();

jobRouter.get("/jobs", validate({ query: listJobsQuerySchema }), getJobs);
jobRouter.post("/jobs", validate({ body: createJobSchema }), addJob);
jobRouter.get(
  "/jobs/:jobId",
  validate({ params: jobIdParamsSchema }),
  getJobById,
);
jobRouter.patch(
  "/jobs/:jobId",
  validate({ params: jobIdParamsSchema, body: updateJobSchema }),
  updateJob,
);

jobRouter.post("/add", (req: Request, res: Response) => {
  res.status(201).json({ message: "Job added successfully!" });
});

export default jobRouter;
