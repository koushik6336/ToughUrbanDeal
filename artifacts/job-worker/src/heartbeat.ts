import { eq } from "drizzle-orm";
import { db, workersTable, workerHeartbeatsTable } from "@workspace/db";

const HEARTBEAT_INTERVAL_MS = 10_000; // 10 seconds

export function startHeartbeat(workerId: string, activeJobs: Map<string, boolean>): NodeJS.Timeout {
  return setInterval(async () => {
    const activeJobCount = activeJobs.size;
    const memUsage = process.memoryUsage();
    const memoryUsage = memUsage.heapUsed / memUsage.heapTotal;

    try {
      await db
        .update(workersTable)
        .set({ lastHeartbeatAt: new Date() })
        .where(eq(workersTable.id, workerId));

      await db.insert(workerHeartbeatsTable).values({
        workerId,
        timestamp: new Date(),
        cpuUsage: null, // Would need os.cpus() averaging in real impl
        memoryUsage: String(Math.round(memoryUsage * 100) / 100),
        activeJobCount,
      });
    } catch (err) {
      // Non-fatal — heartbeat failure shouldn't crash the worker
      console.error("Heartbeat error:", err);
    }
  }, HEARTBEAT_INTERVAL_MS);
}
