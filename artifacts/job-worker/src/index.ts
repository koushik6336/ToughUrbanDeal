/**
 * Distributed Job Worker
 *
 * A truly independent process that polls the database for queued jobs,
 * claims them atomically, executes them, and handles retries + DLQ transitions.
 * Also runs the cron dispatcher and queue depth snapshotter as background loops.
 */
import { eq } from "drizzle-orm";
import { db, workersTable, queuesTable } from "@workspace/db";
import { claimJob } from "./claimJob.js";
import { executeJob } from "./executeJob.js";
import { startHeartbeat } from "./heartbeat.js";
import { setupGracefulShutdown } from "./gracefulShutdown.js";
import { startCronDispatcher } from "./cronDispatcher.js";
import { startDepthSnapshotter } from "./depthSnapshotter.js";
import { randomUUID } from "crypto";
import os from "os";

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS ?? "2000", 10);
const WORKER_NAME = process.env.WORKER_NAME ?? `worker-${os.hostname()}-${process.pid}`;

// Track active jobs per worker instance
const activeJobs = new Map<string, boolean>();

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }

  // Register worker in DB
  const [worker] = await db
    .insert(workersTable)
    .values({ name: WORKER_NAME, status: "active", lastHeartbeatAt: new Date() })
    .returning();

  const workerId = worker.id;
  console.log(`[worker] Started — id=${workerId} name=${WORKER_NAME}`);

  // Start background loops
  const heartbeatTimer = startHeartbeat(workerId, activeJobs);
  const cronTimer = startCronDispatcher();
  const snapshotTimer = startDepthSnapshotter();

  let polling = true;
  const stopPolling = (): void => {
    polling = false;
    clearInterval(cronTimer);
    clearInterval(snapshotTimer);
  };

  setupGracefulShutdown(workerId, activeJobs, stopPolling, heartbeatTimer);

  // Main polling loop
  const poll = async (): Promise<void> => {
    if (!polling) return;
    try {
      // Get all active (non-paused) queues
      const queues = await db
        .select()
        .from(queuesTable)
        .where(eq(queuesTable.isPaused, false));

      for (const queue of queues) {
        // Check concurrency limit
        const runningForQueue = [...activeJobs.keys()].filter((id) =>
          activeJobs.get(id),
        ).length;

        if (runningForQueue >= queue.concurrencyLimit) continue;

        const job = await claimJob(queue.id, workerId);
        if (job) {
          console.log(`[worker] Claimed job id=${job.id} type=${job.type} queue=${queue.name}`);
          // Execute async — does not block the polling loop
          executeJob(job, workerId, activeJobs).catch((err) => {
            console.error(`[worker] Unhandled error executing job ${job.id}:`, err);
          });
        }
      }
    } catch (err) {
      console.error("[worker] Poll error:", err);
    }
  };

  // Kick off polling loop
  const runLoop = async (): Promise<void> => {
    while (polling) {
      await poll();
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  };

  await runLoop();
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
