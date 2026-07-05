import { Router, type IRouter } from "express";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import { db, jobsTable, jobExecutionsTable, jobLogsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// GET /jobs?queueId=&status=&startDate=&endDate=&page=&limit=
router.get("/jobs", requireAuth, async (req, res): Promise<void> => {
  const queueId = req.query.queueId as string | undefined;
  const status = req.query.status as string | undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
  const offset = (page - 1) * limit;

  const conditions = [];
  if (queueId) conditions.push(eq(jobsTable.queueId, queueId));
  if (status) conditions.push(eq(jobsTable.status, status));
  if (startDate) conditions.push(gte(jobsTable.createdAt, new Date(startDate)));
  if (endDate) conditions.push(lte(jobsTable.createdAt, new Date(endDate)));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(jobsTable)
    .where(whereClause);

  const data = await db
    .select()
    .from(jobsTable)
    .where(whereClause)
    .orderBy(desc(jobsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ data, total, page, limit });
});

// POST /jobs/batch — must come BEFORE /jobs/:jobId routes
router.post("/jobs/batch", requireAuth, async (req, res): Promise<void> => {
  const { jobs } = req.body as { jobs?: unknown[] };
  if (!Array.isArray(jobs) || jobs.length === 0) {
    res.status(400).json({ error: "jobs must be a non-empty array" });
    return;
  }
  if (jobs.length > 500) {
    res.status(400).json({ error: "Batch size cannot exceed 500 jobs" });
    return;
  }

  // Validate each job item
  const values: Array<{
    queueId: string;
    type: string;
    payload: Record<string, unknown>;
    priority: number;
    runAt: Date;
    cronExpression?: string;
    retryPolicyId?: string;
    maxAttempts: number;
    idempotencyKey?: string;
  }> = [];

  for (let i = 0; i < jobs.length; i++) {
    const item = jobs[i] as Record<string, unknown>;
    if (!item.queueId || typeof item.queueId !== "string") {
      res.status(400).json({ error: `jobs[${i}]: queueId is required` });
      return;
    }
    if (!item.type || typeof item.type !== "string") {
      res.status(400).json({ error: `jobs[${i}]: type is required` });
      return;
    }
    values.push({
      queueId: item.queueId,
      type: item.type,
      payload: (item.payload as Record<string, unknown>) ?? {},
      priority: typeof item.priority === "number" ? item.priority : 0,
      runAt: item.runAt ? new Date(item.runAt as string) : new Date(),
      cronExpression: item.cronExpression as string | undefined,
      retryPolicyId: item.retryPolicyId as string | undefined,
      maxAttempts: typeof item.maxAttempts === "number" ? item.maxAttempts : 3,
      idempotencyKey: item.idempotencyKey as string | undefined,
    });
  }

  const created = await db.transaction(async (tx) => {
    return tx.insert(jobsTable).values(values).returning({ id: jobsTable.id });
  });

  res.status(201).json({ created: created.map((r) => r.id), count: created.length });
});

// POST /jobs
router.post("/jobs", requireAuth, async (req, res): Promise<void> => {
  const { queueId, type, payload, priority, runAt, cronExpression, retryPolicyId, maxAttempts, idempotencyKey } = req.body as {
    queueId?: string;
    type?: string;
    payload?: Record<string, unknown>;
    priority?: number;
    runAt?: string;
    cronExpression?: string;
    retryPolicyId?: string;
    maxAttempts?: number;
    idempotencyKey?: string;
  };
  if (!queueId || !type) {
    res.status(400).json({ error: "queueId and type are required" });
    return;
  }
  const [job] = await db
    .insert(jobsTable)
    .values({
      queueId,
      type,
      payload: payload ?? {},
      priority: priority ?? 0,
      runAt: runAt ? new Date(runAt) : new Date(),
      cronExpression,
      retryPolicyId,
      maxAttempts: maxAttempts ?? 3,
      idempotencyKey,
    })
    .returning();
  res.status(201).json(job);
});

// GET /jobs/:jobId
router.get("/jobs/:jobId", requireAuth, async (req, res): Promise<void> => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId)).limit(1);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

// GET /jobs/:jobId/executions
router.get("/jobs/:jobId/executions", requireAuth, async (req, res): Promise<void> => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const executions = await db
    .select()
    .from(jobExecutionsTable)
    .where(eq(jobExecutionsTable.jobId, jobId))
    .orderBy(desc(jobExecutionsTable.startedAt));
  res.json(executions);
});

// GET /jobs/:jobId/logs
router.get("/jobs/:jobId/logs", requireAuth, async (req, res): Promise<void> => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const executions = await db
    .select({ id: jobExecutionsTable.id })
    .from(jobExecutionsTable)
    .where(eq(jobExecutionsTable.jobId, jobId));
  const executionIds = executions.map((e) => e.id);
  if (executionIds.length === 0) {
    res.json([]);
    return;
  }
  const logs = await db
    .select()
    .from(jobLogsTable)
    .where(sql`${jobLogsTable.jobExecutionId} = ANY(${sql.raw(`ARRAY['${executionIds.join("','")}']::uuid[]`)})`)
    .orderBy(jobLogsTable.timestamp);
  res.json(logs);
});

// POST /jobs/:jobId/retry
router.post("/jobs/:jobId/retry", requireAuth, async (req, res): Promise<void> => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId)).limit(1);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.status !== "failed" && job.status !== "dead_letter") {
    res.status(400).json({ error: "Only failed or dead_letter jobs can be retried" });
    return;
  }
  const [updated] = await db
    .update(jobsTable)
    .set({
      status: "queued",
      runAt: new Date(),
      attemptCount: 0,
      workerId: null,
      claimedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(jobsTable.id, jobId))
    .returning();
  res.json(updated);
});

export default router;
