import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, scheduledJobsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// GET /scheduled-jobs?queueId=
router.get("/scheduled-jobs", requireAuth, async (req, res): Promise<void> => {
  const queueId = req.query.queueId as string | undefined;
  const rows = queueId
    ? await db.select().from(scheduledJobsTable).where(eq(scheduledJobsTable.queueId, queueId))
    : await db.select().from(scheduledJobsTable);
  res.json(rows);
});

// POST /scheduled-jobs
router.post("/scheduled-jobs", requireAuth, async (req, res): Promise<void> => {
  const { queueId, jobTemplate, cronExpression } = req.body as {
    queueId?: string;
    jobTemplate?: Record<string, unknown>;
    cronExpression?: string;
  };
  if (!queueId || !jobTemplate || !cronExpression) {
    res.status(400).json({ error: "queueId, jobTemplate, and cronExpression are required" });
    return;
  }
  const [scheduled] = await db
    .insert(scheduledJobsTable)
    .values({ queueId, jobTemplate, cronExpression })
    .returning();
  res.status(201).json(scheduled);
});

export default router;
