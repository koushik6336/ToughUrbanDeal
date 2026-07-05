import { Router, type IRouter } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, deadLetterJobsTable, jobsTable, queuesTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// GET /dlq?queueId=&page=&limit=
router.get("/dlq", requireAuth, async (req, res): Promise<void> => {
  const queueId = req.query.queueId as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const offset = (page - 1) * limit;

  const whereClause = queueId ? eq(deadLetterJobsTable.queueId, queueId) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(deadLetterJobsTable)
    .where(whereClause);

  const data = await db
    .select()
    .from(deadLetterJobsTable)
    .where(whereClause)
    .orderBy(desc(deadLetterJobsTable.movedAt))
    .limit(limit)
    .offset(offset);

  res.json({ data, total, page, limit });
});

// POST /dlq/:dlqId/requeue
router.post("/dlq/:dlqId/requeue", requireAuth, async (req, res): Promise<void> => {
  const dlqId = Array.isArray(req.params.dlqId) ? req.params.dlqId[0] : req.params.dlqId;
  const [dlqJob] = await db
    .select()
    .from(deadLetterJobsTable)
    .where(eq(deadLetterJobsTable.id, dlqId))
    .limit(1);

  if (!dlqJob) {
    res.status(404).json({ error: "Dead letter job not found" });
    return;
  }

  // Verify queue exists
  const [queue] = await db
    .select()
    .from(queuesTable)
    .where(eq(queuesTable.id, dlqJob.queueId))
    .limit(1);

  if (!queue) {
    res.status(404).json({ error: "Queue no longer exists" });
    return;
  }

  const payload = dlqJob.payload as Record<string, unknown>;

  // Re-insert as a fresh job
  const [newJob] = await db
    .insert(jobsTable)
    .values({
      queueId: dlqJob.queueId,
      type: (payload.type as string) ?? "requeued",
      payload: payload.payload as Record<string, unknown> ?? payload,
      status: "queued",
      priority: 0,
      runAt: new Date(),
      attemptCount: 0,
      maxAttempts: 3,
    })
    .returning();

  // Remove from DLQ
  await db.delete(deadLetterJobsTable).where(eq(deadLetterJobsTable.id, dlqId));

  res.json(newJob);
});

export default router;
