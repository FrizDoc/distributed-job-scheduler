import "dotenv/config";
import db from "@scheduler/db";
import { createEmailWorker } from "./workers/email.worker";
import { createNotificationWorker } from "./workers/notification.worker";
import { flushStatusWrites } from "./workers/createWorker";

const SHUTDOWN_TIMEOUT_MS = 8000;

const workers = [createEmailWorker(), createNotificationWorker()];

console.log(`Scheduler started with ${workers.length} workers`);

let shuttingDown = false;

const shutdown = async (reason: string, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`Shutting down scheduler (${reason})...`);

  // worker.close() hangs if redis is down
  setTimeout(() => {
    console.error(`Shutdown took longer than ${SHUTDOWN_TIMEOUT_MS}ms, forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  try {
    await Promise.all(workers.map((worker) => worker.close()));
    await flushStatusWrites();
    await db.$client.end();
    console.log("Scheduler stopped");
  } catch (error) {
    console.error("Error during shutdown:", error);
    exitCode = 1;
  }

  process.exit(exitCode);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
  shutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  shutdown("uncaughtException", 1);
});
