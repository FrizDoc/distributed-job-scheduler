# Distributed Task Scheduler

A small job scheduling system built with Node.js, BullMQ, Redis and Postgres.

You send a job to the API (say, "send this email"), it gets saved to Postgres and pushed onto a Redis queue, and a separate worker process picks it up and runs it. The API and the workers are separate services, so you can run as many workers as you need without touching the API.

Right now there are two kinds of jobs: **email** and **push notification**. The actual sending is stubbed out (the workers just log the payload), so plugging in a real provider is the next step.

## How it works

```text
 client ──► API (Express) ──► Postgres (jobs table)
                │
                └──► Redis (BullMQ queues: emails, pushNotifications)
                                   │
                                   ▼
                     Scheduler (BullMQ workers) ──► updates job status in Postgres
```

1. You log in and `POST /api/jobs` with a job type and payload.
2. The API saves a row in the `jobs` table with status `waiting`, then adds the job to the right queue using `job-<row id>` as the queue job id.
3. The scheduler has one worker per queue. When a worker picks a job up, the row goes to `active`, and then to `completed` or `failed`.
4. If a job fails it's retried with backoff (3 attempts by default). The row only goes to `failed` once all attempts are used up.
5. Finished jobs are removed from Redis after a while (1 hour for completed, 7 days for failed). Postgres keeps the full history.

While a job is still waiting you can change its payload. Once a worker has started on it, the payload is locked.

## Project structure

This is an npm workspaces monorepo.

```text
apps/
  api/            Express API: auth, creating and managing jobs
  scheduler/      BullMQ workers that process the jobs
packages/
  db/             Drizzle schema and database client (shared)
  redis/          Redis connection helper, queue names and queues (shared)
  validations/    Zod schemas for request validation (shared)
curl/             Ready-made curl scripts for every endpoint
Dockerfile        One image with separate targets for api, scheduler and migrate
docker-compose.yml
```

## Running with Docker (easiest)

You only need Docker and Docker Compose.

1. Copy the example env file and fill in the blanks:

   ```bash
   cp .env.example .env
   ```

   At minimum set `POSTGRES_PASSWORD`, `JWT_ACCESS_TOKEN_SECRET` and `JWT_REFRESH_TOKEN_SECRET`. Any long random string works for the secrets, e.g. `openssl rand -hex 32`.

2. Start everything:

   ```bash
   docker compose up -d --build
   ```

   This starts Postgres, Redis, runs the database migration once, then starts the API and the scheduler.

3. Check it's up:

   ```bash
   docker compose ps
   curl http://localhost:3000/
   ```

Only the API is exposed on your machine (port 3000, change it with `API_PORT`). Postgres and Redis sit on a private Docker network and can't be reached from outside, which is on purpose.

To watch the workers do their thing:

```bash
docker compose logs -f scheduler
```

To stop everything:

```bash
docker compose down        # keeps your data
docker compose down -v     # also wipes the database and redis volumes
```

## Running locally without Docker

You'll need Node 24, npm 12, a Postgres database and Redis.

1. Install dependencies from the repo root:

   ```bash
   npm install
   ```

2. Start Redis. The apps expect it on port 7000 by default:

   ```bash
   docker run -d --name redis -p 7000:6379 redis:7-alpine
   ```

3. Create `apps/api/.env`:

   ```text
   DATABASE_URL=postgres://user:password@localhost:5432/scheduler
   JWT_ACCESS_TOKEN_SECRET=some-long-random-string
   JWT_REFRESH_TOKEN_SECRET=another-long-random-string
   ```

   And `apps/scheduler/.env` (see `apps/scheduler/.env.example`), which needs at least the same `DATABASE_URL`.

4. Create the tables:

   ```bash
   npm run db:push -w api
   ```

5. Start the API and the scheduler in two terminals:

   ```bash
   npm run dev -w api
   npm run dev -w scheduler
   ```

The API runs on <http://localhost:3000>.

## Environment variables

| Variable                          | Used by        | Default     | What it does                            |
| --------------------------------- | -------------- | ----------- | --------------------------------------- |
| `DATABASE_URL`                    | api, scheduler |             | Postgres connection string              |
| `JWT_ACCESS_TOKEN_SECRET`         | api            |             | Signs access tokens (valid 1 hour)      |
| `JWT_REFRESH_TOKEN_SECRET`        | api            |             | Signs refresh tokens (valid 7 days)     |
| `PORT`                            | api            | `3000`      | API port                                |
| `REDIS_HOST`                      | api, scheduler | `localhost` | Redis host                              |
| `REDIS_PORT`                      | api, scheduler | `7000`      | Redis port                              |
| `EMAIL_WORKER_CONCURRENCY`        | scheduler      | `5`         | Email jobs processed in parallel        |
| `NOTIFICATION_WORKER_CONCURRENCY` | scheduler      | `10`        | Notification jobs processed in parallel |
| `COMPLETED_JOB_RETENTION_SECONDS` | api            | `3600`      | How long completed jobs stay in Redis   |
| `FAILED_JOB_RETENTION_SECONDS`    | api            | `604800`    | How long failed jobs stay in Redis      |

With Docker Compose, the database and Redis settings are filled in for you. You only set the ones in `.env.example`.

## Using the API

The `curl/` folder has a script for every endpoint, so you don't have to type out requests by hand. `login.sh` saves your token to `curl/.token` and the other scripts pick it up from there.

```bash
./curl/register.sh me@example.com secret123
./curl/login.sh me@example.com secret123

./curl/create-email-job.sh friend@example.com
./curl/create-notification-job.sh "Hello there"

./curl/list-jobs.sh                 # all your jobs
./curl/list-jobs.sh completed       # filter by status
./curl/get-job.sh 1 emails          # one job, with its queue details
./curl/update-job.sh 1 '{"name": "renamed job"}'
```

Point the scripts at a different server with `BASE_URL=http://somewhere:3000 ./curl/list-jobs.sh`.

### Endpoints

| Method  | Path                                | Auth | Description                                                |
| ------- | ----------------------------------- | ---- | ---------------------------------------------------------- |
| `POST`  | `/api/auth/register`                | no   | Create an account (`username`, `email`, `age`, `password`) |
| `POST`  | `/api/auth/login`                   | no   | Returns an access token and a refresh token                |
| `POST`  | `/api/jobs`                         | yes  | Create a job                                               |
| `GET`   | `/api/jobs`                         | yes  | List your jobs (`status`, `page`, `limit`, `order`)        |
| `GET`   | `/api/jobs/:jobId?queueName=emails` | yes  | Get one job. `queueName` is `emails` or `notifications`    |
| `PATCH` | `/api/jobs/:jobId`                  | yes  | Change a job's `name` and/or `payload`                     |

Authenticated routes need an `Authorization: Bearer <token>` header.

Creating a job looks like this:

```json
{
  "name": "welcome email",
  "queue": "emails",
  "type": "email",
  "payload": { "to": "friend@example.com", "subject": "Welcome" },
  "attempts": 3,
  "backoff": { "type": "exponential", "delay": 1000 }
}
```

`type` is either `email` or `notification`. `attempts` and `backoff` are optional.

A few things to know:

- The API is rate limited to 10 requests per minute per IP. If you get a `429`, wait a minute.
- `PATCH` with a `payload` only works while the job is still waiting. After that you get a `409`. Renaming always works.
- `GET /api/jobs/:jobId` still works after Redis has cleared a finished job. You'll get the database record with `job: null`.

## Job statuses

| Status      | Meaning                                                                      |
| ----------- | ---------------------------------------------------------------------------- |
| `waiting`   | Saved and queued, no worker has picked it up yet (also used between retries) |
| `active`    | A worker is running it right now                                             |
| `completed` | Done                                                                         |
| `failed`    | Failed and all retry attempts are used up                                    |

## Performance

![Benchmark results](docs/benchmarks.svg)

Load-tested with [k6](https://k6.io) against the Docker Compose stack on a single laptop (Intel i7-1185G7, 4 cores / 8 threads), with the load generator on the same machine.

- **Throughput:** 536 requests/s at the API with 0% errors, and the workers kept pace at 537 jobs/s.
- **Indexing experiment:** workers update a job's status by `job_id` three times per job. Against a baseline schema without an index on that column, every update scans the whole table. Indexing it took end-to-end p50 latency from 26.4 s to 22.7 ms at 250 jobs/s, and Postgres CPU from about 350% to 67%.
- **Scaling:** with a 100 ms simulated send per email, worker throughput went from 49 to 98 to 195 jobs/s with 1, 2 and 4 scheduler replicas (3.96×).
- **Reliability:** all 82,400 jobs across the runs completed; none were lost or left unfinished.

End-to-end latency comes from the `created_at`, `started_at` and `completed_at` columns on the `jobs` table. Each test ran once, and the email processor is still a stub, so outside the scaling test these numbers measure the system's own overhead.

## Not done yet

- The email and push processors only log the payload. Hook up a real provider in `apps/scheduler/src/processors/`.
- `runAt`, `priority` and `repeat` are accepted by the API but not applied to the queue yet, so jobs always run straight away and only once.
- There's no endpoint for refresh tokens, retrying failed jobs or cancelling jobs yet.
