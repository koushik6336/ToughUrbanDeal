/**
 * Queue Depth Snapshotter
 *
 * Every 2 minutes, inserts one queue_depth_snapshots row per queue
 * recording the current number of queued jobs. These rows power the
 * "Queue Depth Over Time" chart on the metrics dashboard.
 */
import { eq, sql } from "drizzle-orm";
import { db, queuesTable, jobsTable, queueDepthSnapshotsTable } from "@workspace/db";

const SNAPSHOT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export function startDepthSnapshotter(): NodeJS.Timeout {
  const snapshot = async (): Promise<void> => {
    try {
      const queues = await db.select({ id: queuesTable.id }).from(queuesTable);

      for (const queue of queues) {
        const [{ count }] = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(jobsTable)
          .where(eq(jobsTable.queueId, queue.id));

        await db.insert(queueDepthSnapshotsTable).values({
          queueId: queue.id,
          queuedCount: count ?? 0,
        });
      }
    } catch (err) {
      console.error("[snapshotter] Error taking depth snapshot:", err);
    }
  };

  // Run immediately on start, then on interval
  snapshot();
  return setInterval(snapshot, SNAPSHOT_INTERVAL_MS);
}
