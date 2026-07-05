import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, organizationsTable, orgMembersTable, usersTable } from "@workspace/db";
import { requireAuth, checkOrgRole } from "../middleware/auth";

const router: IRouter = Router();

// GET /orgs — list orgs for current user
router.get("/orgs", requireAuth, async (req, res): Promise<void> => {
  const memberships = await db
    .select({ org: organizationsTable })
    .from(orgMembersTable)
    .innerJoin(organizationsTable, eq(orgMembersTable.orgId, organizationsTable.id))
    .where(eq(orgMembersTable.userId, req.userId!));
  res.json(memberships.map((m) => m.org));
});

// POST /orgs — create org
router.post("/orgs", requireAuth, async (req, res): Promise<void> => {
  const { name } = req.body as { name?: string };
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [org] = await db
    .insert(organizationsTable)
    .values({ name, ownerUserId: req.userId })
    .returning();
  // Auto-add creator as admin
  await db.insert(orgMembersTable).values({ orgId: org.id, userId: req.userId!, role: "admin" });
  res.status(201).json(org);
});

// POST /orgs/:orgId/members — requires admin role
router.post("/orgs/:orgId/members", requireAuth, async (req, res): Promise<void> => {
  const orgId = Array.isArray(req.params.orgId) ? req.params.orgId[0] : req.params.orgId;

  // Verify org exists
  const [org] = await db.select().from(organizationsTable).where(eq(organizationsTable.id, orgId)).limit(1);
  if (!org) {
    res.status(404).json({ error: "Organization not found" });
    return;
  }

  // Require admin role to add members
  const allowed = await checkOrgRole(res, req.userId!, orgId, "admin");
  if (!allowed) return;

  const { userId, role } = req.body as { userId?: string; role?: string };
  if (!userId || !role) {
    res.status(400).json({ error: "userId and role are required" });
    return;
  }

  // Verify target user exists
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!targetUser) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [member] = await db
    .insert(orgMembersTable)
    .values({ orgId, userId, role })
    .onConflictDoUpdate({ target: [orgMembersTable.orgId, orgMembersTable.userId], set: { role } })
    .returning();
  res.status(201).json(member);
});

export default router;
