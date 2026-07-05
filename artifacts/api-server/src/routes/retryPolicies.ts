import { Router, type IRouter } from "express";
import { db, retryPoliciesTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

// GET /retry-policies — list all available retry policies
router.get("/retry-policies", requireAuth, async (_req, res): Promise<void> => {
  const policies = await db.select().from(retryPoliciesTable).orderBy(retryPoliciesTable.createdAt);
  res.json(policies);
});

export default router;
