import { z } from "zod";

export const jobStatusSchema = z.enum([
  "waiting",
  "delayed",
  "active",
  "completed",
  "failed",
  "paused",
  "cancelled",
]);

export const jobPrioritySchema = z.enum(["low", "medium", "high"]);

export const userRegisterSchema = z.object({
  username: z.string().trim().min(3).max(20),
  email: z.string().email(),
  age: z.number().int().min(18).max(100),
  password: z.string().min(6).max(100),
});

export const userLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const backoffSchema = z.object({
  type: z.enum(["fixed", "exponential"]),
  delay: z
    .int()
    .min(1000)
    .max(24 * 60 * 60 * 1000),
});

export const repeatSchema = z.union([
  z.object({
    pattern: z
      .string()
      .trim()
      .regex(
        /^(\S+\s+){4,5}\S+$/,
        "pattern must be a 5 or 6 field cron expression",
      ),
    tz: z.string().optional(),
    limit: z.int().positive().optional(),
  }),
  z.object({
    every: z.int().min(1000),
    limit: z.int().positive().optional(),
  }),
]);

const futureDate = z.coerce.date().refine((d) => d.getTime() > Date.now(), {
  message: "runAt must be a future date",
});

const jobFields = {
  name: z.string().trim().min(3).max(20),
  queue: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "queue may only contain letters, numbers, '-' and '_'",
    ),
  payload: z.record(z.string(), z.unknown()),
  runAt: futureDate.optional(),
  type: z.enum(["email", "notification"]),
  repeat: repeatSchema.optional(),
  priority: jobPrioritySchema.default("medium"),
  attempts: z.int().min(1).max(5).default(3),
  backoff: backoffSchema.default({ type: "exponential", delay: 1000 }),
  timeoutMs: z
    .int()
    .min(1000)
    .max(60 * 60 * 1000)
    .optional(),
};

const runAtXorRepeat = (job: { runAt?: Date; repeat?: unknown }) =>
  !(job.runAt && job.repeat);
const runAtXorRepeatError = {
  message: "Provide either runAt or repeat, not both",
  path: ["repeat"],
};

// /jobs/:jobId
export const jobIdParamsSchema = z.object({
  jobId: z.coerce.number().int().positive(),

});

// GET /jobs/:jobId
export const getJobByIdQuerySchema = z.object({
  queueName: z.enum(["emails", "notifications"]),
});

// POST /jobs
export const createJobSchema = z
  .object(jobFields)
  .refine(runAtXorRepeat, runAtXorRepeatError);

// PATCH /jobs/:jobId
export const updateJobSchema = z
  .object({
    name: jobFields.name,
    payload: jobFields.payload,
  })
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  })

export const listJobsQuerySchema = z.object({
  status: jobStatusSchema.optional(),
  queue: jobFields.queue.optional(),
  priority: jobPrioritySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "runAt", "priority"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// POST /jobs/:jobId/retry
export const retryJobSchema = z
  .object({
    resetAttempts: z.boolean().default(false),
  })
  .default({ resetAttempts: false });

export type JobStatus = z.infer<typeof jobStatusSchema>;
export type JobPriority = z.infer<typeof jobPrioritySchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
export type JobIdParams = z.infer<typeof jobIdParamsSchema>;
export type GetJobByIdQuery = z.infer<typeof getJobByIdQuerySchema>;
export type RetryJobInput = z.infer<typeof retryJobSchema>;
