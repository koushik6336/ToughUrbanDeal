import { Router, type IRouter } from "express";
import { sql, eq, and, gte } from "drizzle-orm";
import { db, jobsTable, workersTable, queueDepthSnapshotsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

const RANGE_TO_INTERVAL: Record<string, { interval: string; bucket: string }> = {
  "1h": { interval: "1 hour", bucket: "5 minutes" },
  "6h": { interval: "6 hours", bucket: "30 minutes" },
  "24h": { interval: "24 hours", bucket: "1 hour" },
  "7d": { interval: "7 days", bucket: "6 hours" },
};

// GET /metrics/throughput?queueId=&range=
router.get("/metrics/throughput", requireAuth, async (req, res): Promise<void> => {
  const queueId = req.query.queueId as string | undefined;
  const range = (req.query.range as string) ?? "24h";
  const config = RANGE_TO_INTERVAL[range] ?? RANGE_TO_INTERVAL["24h"];

  const queueFilter = queueId ? sql`AND queue_id = ${queueId}::uuid` : sql``;

  const rows = await db.execute(sql`
    SELECT
      date_trunc(${config.bucket}, updated_at) AS time,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
    FROM jobs
    WHERE updated_at >= now() - INTERVAL ${config.interval}
    ${queueFilter}
    GROUP BY 1
    ORDER BY 1
  `);

  res.json({
    range,
    data: (rows.rows as Array<{ time: Date; completed: number; failed: number }>).map((r) => ({
      time: r.time.toISOString(),
      completed: Number(r.completed),
      failed: Number(r.failed),
    })),
  });
});

// GET /metrics/summary
router.get("/metrics/summary", requireAuth, async (req, res): Promise<void> => {
  const statusRows = await db
    .select({
      status: jobsTable.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(jobsTable)
    .groupBy(jobsTable.status);

  const counts: Record<string, number> = {};
  for (const row of statusRows) counts[row.status] = row.count;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const completed = counts["completed"] ?? 0;
  const failed = counts["failed"] ?? 0;

  const [{ activeWorkers }] = await db
    .select({ activeWorkers: sql<number>`COUNT(*)::int` })
    .from(workersTable)
    .where(eq(workersTable.status, "active"));

  res.json({
    totalJobs: total,
    activeWorkers,
    queued: counts["queued"] ?? 0,
    running: counts["running"] ?? 0,
    completed,
    failed,
    deadLetter: counts["dead_letter"] ?? 0,
    successRate: completed + failed > 0 ? Math.round((completed / (completed + failed)) * 100) / 100 : 0,
  });
});

// GET /metrics/queue-depth?queueId=&range=
router.get("/metrics/queue-depth", requireAuth, async (req, res): Promise<void> => {
  const queueId = req.query.queueId as string | undefined;
  if (!queueId) {
    res.status(400).json({ error: "queueId query param is required" });
    return;
  }

  const range = (req.query.range as string) ?? "24h";
  const config = RANGE_TO_INTERVAL[range] ?? RANGE_TO_INTERVAL["24h"];

  const rows = await db.execute(sql`
    SELECT
      date_trunc(${config.bucket}, timestamp) AS time,
      AVG(queued_count)::int AS depth
    FROM queue_depth_snapshots
    WHERE queue_id = ${queueId}::uuid
      AND timestamp >= now() - INTERVAL ${config.interval}
    GROUP BY 1
    ORDER BY 1
  `);

  res.json({
    queueId,
    range,
    data: (rows.rows as Array<{ time: Date; depth: number }>).map((r) => ({
      time: r.time.toISOString(),
      depth: Number(r.depth),
    })),
  });
});

export default router;
