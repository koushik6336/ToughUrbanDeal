import { eq, sql } from "drizzle-orm";
import { db, jobsTable, jobExecutionsTable, jobLogsTable, retryPoliciesTable, deadLetterJobsTable } from "@workspace/db";
import type { Job, RetryPolicy } from "@workspace/db";
import { computeNextDelay } from "./retryEngine.js";

// Simulated job handlers keyed by job type
const JOB_HANDLERS: Record<string, (payload: unknown) => Promise<unknown>> = {
  "email-send": async (payload) => {
    await sleep(200 + Math.random() * 300);
    return { sent: true, to: (payload as Record<string, unknown>).to };
  },
  "data-export": async () => {
    await sleep(500 + Math.random() * 1000);
    return { rows: Math.floor(Math.random() * 10000), format: "csv" };
  },
  "report-generate": async () => {
    await sleep(300 + Math.random() * 700);
    return { reportId: `rpt-${Date.now()}`, pages: Math.floor(Math.random() * 20) + 1 };
  },
  "image-resize": async () => {
    await sleep(100 + Math.random() * 400);
    return { width: 800, height: 600 };
  },
  "webhook-deliver": async (payload) => {
    await sleep(100 + Math.random() * 200);
    // Simulate occasional webhook failure
    if (Math.random() < 0.2) throw new Error("Webhook endpoint returned 500");
    return { delivered: true, url: (payload as Record<string, unknown>).url };
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeJob(job: Job, workerId: string, activeJobs: Map<string, boolean>): Promise<void> {
  activeJobs.set(job.id, true);

  // Mark running + create execution record
  await db.update(jobsTable).set({ status: "running", updatedAt: new Date() }).where(eq(jobsTable.id, job.id));

  const [execution] = await db
    .insert(jobExecutionsTable)
    .values({
      jobId: job.id,
      workerId,
      attemptNumber: job.attemptCount + 1,
      status: "running",
      startedAt: new Date(),
    })
    .returning();

  await db.insert(jobLogsTable).values({
    jobExecutionId: execution.id,
    logLevel: "info",
    message: `Starting job type=${job.type} attempt=${job.attemptCount + 1}/${job.maxAttempts}`,
  });

  try {
    const handler = JOB_HANDLERS[job.type] ?? JOB_HANDLERS["email-send"];
    const result = await handler(job.payload);

    // Success
    await db
      .update(jobExecutionsTable)
      .set({ status: "completed", finishedAt: new Date(), result: result as Record<string, unknown> })
      .where(eq(jobExecutionsTable.id, execution.id));

    await db
      .update(jobsTable)
      .set({ status: "completed", attemptCount: job.attemptCount + 1, updatedAt: new Date() })
      .where(eq(jobsTable.id, job.id));

    await db.insert(jobLogsTable).values({
      jobExecutionId: execution.id,
      logLevel: "info",
      message: `Job completed successfully`,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await db
      .update(jobExecutionsTable)
      .set({ status: "failed", finishedAt: new Date(), errorMessage })
      .where(eq(jobExecutionsTable.id, execution.id));

    await db.insert(jobLogsTable).values({
      jobExecutionId: execution.id,
      logLevel: "error",
      message: `Job failed: ${errorMessage}`,
    });

    const newAttemptCount = job.attemptCount + 1;
    if (newAttemptCount >= job.maxAttempts) {
      // Move to dead letter
      await db.insert(deadLetterJobsTable).values({
        originalJobId: job.id,
        queueId: job.queueId,
        payload: job.payload as Record<string, unknown>,
        failureReason: errorMessage,
        movedAt: new Date(),
      });
      await db
        .update(jobsTable)
        .set({ status: "dead_letter", attemptCount: newAttemptCount, updatedAt: new Date() })
        .where(eq(jobsTable.id, job.id));

      await db.insert(jobLogsTable).values({
        jobExecutionId: execution.id,
        logLevel: "error",
        message: `Max attempts reached (${job.maxAttempts}). Moving to dead letter queue.`,
      });
    } else {
      // Schedule retry
      let retryPolicy: RetryPolicy | undefined;
      if (job.retryPolicyId) {
        const rows = await db.select().from(retryPoliciesTable).where(eq(retryPoliciesTable.id, job.retryPolicyId)).limit(1);
        retryPolicy = rows[0];
      }
      const defaultPolicy: RetryPolicy = {
        id: "default",
        type: "exponential",
        baseDelayMs: 1000,
        maxRetries: job.maxAttempts,
        multiplier: "2.0",
        createdAt: new Date(),
      };
      const delay = computeNextDelay(retryPolicy ?? defaultPolicy, newAttemptCount);
      const runAt = new Date(Date.now() + delay);

      await db
        .update(jobsTable)
        .set({ status: "queued", attemptCount: newAttemptCount, runAt, updatedAt: new Date(), workerId: null, claimedAt: null })
        .where(eq(jobsTable.id, job.id));

      await db.insert(jobLogsTable).values({
        jobExecutionId: execution.id,
        logLevel: "warn",
        message: `Retry scheduled in ${delay}ms (attempt ${newAttemptCount}/${job.maxAttempts})`,
      });
    }
  } finally {
    activeJobs.delete(job.id);
  }
}
