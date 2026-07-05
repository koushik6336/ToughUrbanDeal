import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, workersTable, workerHeartbeatsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// GET /workers
router.get("/workers", requireAuth, async (req, res): Promise<void> => {
  const workers = await db.select().from(workersTable).orderBy(desc(workersTable.registeredAt));
  res.json(workers);
});

// GET /workers/:workerId/heartbeats
router.get("/workers/:workerId/heartbeats", requireAuth, async (req, res): Promise<void> => {
  const workerId = Array.isArray(req.params.workerId) ? req.params.workerId[0] : req.params.workerId;
  const heartbeats = await db
    .select()
    .from(workerHeartbeatsTable)
    .where(eq(workerHeartbeatsTable.workerId, workerId))
    .orderBy(desc(workerHeartbeatsTable.timestamp))
    .limit(100);
  res.json(heartbeats);
});

export default router;
