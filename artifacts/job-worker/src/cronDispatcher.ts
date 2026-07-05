/**
 * Cron Dispatcher
 *
 * Polls scheduled_jobs every 30 seconds. For each active row whose
 * next_run_at is in the past, it inserts a new job from the job_template,
 * computes the next run time via cron-parser, and updates the row.
 */
import { lte, eq, and } from "drizzle-orm";
import { db, scheduledJobsTable, jobsTable } from "@workspace/db";
import { CronExpressionParser } from "cron-parser";

const DISPATCH_INTERVAL_MS = 30_000; // 30 seconds

function computeNextRunAt(cronExpression: string): Date {
  const interval = CronExpressionParser.parse(cronExpression, { tz: "UTC" });
  return interval.next().toDate();
}

export function startCronDispatcher(): NodeJS.Timeout {
  const dispatch = async (): Promise<void> => {
    try {
      const now = new Date();

      // Find all active scheduled jobs due to run
      const due = await db
        .select()
        .from(scheduledJobsTable)
        .where(
          and(
            eq(scheduledJobsTable.isActive, true),
            lte(scheduledJobsTable.nextRunAt, now),
          ),
        );

      for (const scheduled of due) {
        const template = scheduled.jobTemplate as Record<string, unknown>;

        // Insert a new job from the template
        await db.insert(jobsTable).values({
          queueId: scheduled.queueId,
          type: (template.type as string) ?? "scheduled",
          payload: (template.payload as Record<string, unknown>) ?? template,
          priority: typeof template.priority === "number" ? template.priority : 0,
          runAt: now,
          maxAttempts: typeof template.maxAttempts === "number" ? template.maxAttempts : 3,
          retryPolicyId: template.retryPolicyId as string | undefined,
        });

        // Compute next run time
        let nextRunAt: Date;
        try {
          nextRunAt = computeNextRunAt(scheduled.cronExpression);
        } catch (err) {
          console.error(`[cron] Invalid cron expression for scheduled_job ${scheduled.id}: ${scheduled.cronExpression}`, err);
          // Disable the broken scheduled job so it doesn't loop
          await db
            .update(scheduledJobsTable)
            .set({ isActive: false, lastRunAt: now })
            .where(eq(scheduledJobsTable.id, scheduled.id));
          continue;
        }

        await db
          .update(scheduledJobsTable)
          .set({ lastRunAt: now, nextRunAt })
          .where(eq(scheduledJobsTable.id, scheduled.id));

        console.log(`[cron] Dispatched job for scheduled_job ${scheduled.id}, next run at ${nextRunAt.toISOString()}`);
      }
    } catch (err) {
      console.error("[cron] Dispatcher error:", err);
    }
  };

  // Run immediately on start, then on interval
  dispatch();
  return setInterval(dispatch, DISPATCH_INTERVAL_MS);
}
