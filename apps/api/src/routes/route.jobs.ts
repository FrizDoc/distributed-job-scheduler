import express from "express";
import { addJob, getJobById, getJobs, updateJob } from "@controller/jobs.controller";
import { validate } from "@middleware/validate";
import { isAuthenticated } from "@middleware/isAuthenticated";
import {
  createJobSchema,
  getJobByIdQuerySchema,
  jobIdParamsSchema,
  listJobsQuerySchema,
  updateJobSchema,
} from "@scheduler/validations";

const jobRouter = express.Router();

jobRouter.get("/", isAuthenticated, validate({ query: listJobsQuerySchema }), getJobs);
jobRouter.post("", isAuthenticated, validate({ body: createJobSchema }), addJob);
jobRouter.get(
  "/:jobId",
  isAuthenticated,
  validate({ params: jobIdParamsSchema, query: getJobByIdQuerySchema }),
  getJobById,
);
jobRouter.patch(
  "/:jobId",
  isAuthenticated,
  validate({ params: jobIdParamsSchema, body: updateJobSchema }),
  updateJob,
);

export default jobRouter;
