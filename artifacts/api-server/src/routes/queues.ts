import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, queuesTable, jobsTable, projectsTable } from "@workspace/db";
import { requireAuth, checkOrgRole } from "../middleware/auth";

const router: IRouter = Router();

// GET /queues?projectId=
router.get("/queues", requireAuth, async (req, res): Promise<void> => {
  const projectId = req.query.projectId as string | undefined;
  if (!projectId) {
    res.status(400).json({ error: "projectId query param is required" });
    return;
  }
  const queues = await db.select().from(queuesTable).where(eq(queuesTable.projectId, projectId));
  res.json(queues);
});

// POST /queues
router.post("/queues", requireAuth, async (req, res): Promise<void> => {
  const { projectId, name, priority, concurrencyLimit, defaultRetryPolicyId } = req.body as {
    projectId?: string;
    name?: string;
    priority?: number;
    concurrencyLimit?: number;
    defaultRetryPolicyId?: string;
  };
  if (!projectId || !name) {
    res.status(400).json({ error: "projectId and name are required" });
    return;
  }
  const [queue] = await db
    .insert(queuesTable)
    .values({ projectId, name, priority: priority ?? 0, concurrencyLimit: concurrencyLimit ?? 5, defaultRetryPolicyId })
    .returning();
  res.status(201).json(queue);
});

// GET /queues/:queueId
router.get("/queues/:queueId", requireAuth, async (req, res): Promise<void> => {
  const queueId = Array.isArray(req.params.queueId) ? req.params.queueId[0] : req.params.queueId;
  const [queue] = await db.select().from(queuesTable).where(eq(queuesTable.id, queueId)).limit(1);
  if (!queue) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }
  res.json(queue);
});

// PATCH /queues/:queueId — requires admin role in the queue's org
router.patch("/queues/:queueId", requireAuth, async (req, res): Promise<void> => {
  const queueId = Array.isArray(req.params.queueId) ? req.params.queueId[0] : req.params.queueId;

  // Load queue + its project to find orgId
  const [queue] = await db.select().from(queuesTable).where(eq(queuesTable.id, queueId)).limit(1);
  if (!queue) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, queue.projectId)).limit(1);
  if (!project) {
    res.status(404).json({ error: "Parent project not found" });
    return;
  }
  const allowed = await checkOrgRole(res, req.userId!, project.orgId, "admin");
  if (!allowed) return;

  const { priority, concurrencyLimit, defaultRetryPolicyId } = req.body as {
    priority?: number;
    concurrencyLimit?: number;
    defaultRetryPolicyId?: string | null;
  };
  const updates: Record<string, unknown> = {};
  if (priority !== undefined) updates.priority = priority;
  if (concurrencyLimit !== undefined) updates.concurrencyLimit = concurrencyLimit;
  if (defaultRetryPolicyId !== undefined) updates.defaultRetryPolicyId = defaultRetryPolicyId;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [updated] = await db
    .update(queuesTable)
    .set(updates)
    .where(eq(queuesTable.id, queueId))
    .returning();
  res.json(updated);
});

// POST /queues/:queueId/pause
router.post("/queues/:queueId/pause", requireAuth, async (req, res): Promise<void> => {
  const queueId = Array.isArray(req.params.queueId) ? req.params.queueId[0] : req.params.queueId;
  const [queue] = await db
    .update(queuesTable)
    .set({ isPaused: true })
    .where(eq(queuesTable.id, queueId))
    .returning();
  if (!queue) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }
  res.json(queue);
});

// POST /queues/:queueId/resume
router.post("/queues/:queueId/resume", requireAuth, async (req, res): Promise<void> => {
  const queueId = Array.isArray(req.params.queueId) ? req.params.queueId[0] : req.params.queueId;
  const [queue] = await db
    .update(queuesTable)
    .set({ isPaused: false })
    .where(eq(queuesTable.id, queueId))
    .returning();
  if (!queue) {
    res.status(404).json({ error: "Queue not found" });
    return;
  }
  res.json(queue);
});

// GET /queues/:queueId/stats
router.get("/queues/:queueId/stats", requireAuth, async (req, res): Promise<void> => {
  const queueId = Array.isArray(req.params.queueId) ? req.params.queueId[0] : req.params.queueId;
  const rows = await db
    .select({
      status: jobsTable.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(jobsTable)
    .where(eq(jobsTable.queueId, queueId))
    .groupBy(jobsTable.status);

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = row.count;

  res.json({
    queueId,
    queued: counts["queued"] ?? 0,
    running: counts["running"] ?? 0,
    completed: counts["completed"] ?? 0,
    failed: counts["failed"] ?? 0,
    deadLetter: counts["dead_letter"] ?? 0,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  });
});

export default router;
