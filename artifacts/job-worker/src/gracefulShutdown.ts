import { eq } from "drizzle-orm";
import { db, workersTable } from "@workspace/db";

const SHUTDOWN_TIMEOUT_MS = 30_000; // 30 seconds

export function setupGracefulShutdown(
  workerId: string,
  activeJobs: Map<string, boolean>,
  stopPolling: () => void,
  heartbeatTimer: NodeJS.Timeout,
): void {
  async function shutdown(signal: string): Promise<void> {
    console.log(`[worker] Received ${signal}, starting graceful shutdown...`);
    stopPolling();
    clearInterval(heartbeatTimer);

    // Mark worker as draining
    await db.update(workersTable).set({ status: "draining" }).where(eq(workersTable.id, workerId));

    // Wait for in-flight jobs to complete
    const deadline = Date.now() + SHUTDOWN_TIMEOUT_MS;
    while (activeJobs.size > 0 && Date.now() < deadline) {
      console.log(`[worker] Waiting for ${activeJobs.size} in-flight jobs...`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (activeJobs.size > 0) {
      console.log(`[worker] Shutdown timeout — ${activeJobs.size} jobs still running`);
    }

    // Mark worker as dead
    await db.update(workersTable).set({ status: "dead" }).where(eq(workersTable.id, workerId));
    console.log("[worker] Shutdown complete");
    process.exit(0);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
