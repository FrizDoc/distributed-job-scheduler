import express, { Request, Response } from "express";
import {
  addJob,
  getJobById,
  getJobs,
  updateJob,
} from "@controller/jobs.controller";
import { validate } from "@middleware/validate";
import { isAuthenticated } from "@middleware/isAuthenticated";
import {
  createJobSchema,
  jobIdParamsSchema,
  listJobsQuerySchema,
  updateJobSchema,
} from "@scheduler/validations";

const jobRouter = express.Router();

jobRouter.get("/", isAuthenticated, validate({ query: listJobsQuerySchema }), getJobs);
jobRouter.post("", isAuthenticated, validate({ body: createJobSchema }), addJob);
jobRouter.get(
  "/:jobId", isAuthenticated,
  validate({ params: jobIdParamsSchema }),
  getJobById,
);
jobRouter.patch(
  "/:jobId", isAuthenticated,
  validate({ params: jobIdParamsSchema, body: updateJobSchema }),
  updateJob,
);

jobRouter.post("/add", isAuthenticated, (req: Request, res: Response) => {
  res.status(201).json({ message: "Job added successfully!" });
});

export default jobRouter;
