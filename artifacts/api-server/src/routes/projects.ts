import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, projectsTable } from "@workspace/db";
import { requireAuth, checkOrgRole } from "../middleware/auth";

const router: IRouter = Router();

// GET /projects?orgId=
router.get("/projects", requireAuth, async (req, res): Promise<void> => {
  const orgId = req.query.orgId as string | undefined;
  if (!orgId) {
    res.status(400).json({ error: "orgId query param is required" });
    return;
  }
  const projects = await db.select().from(projectsTable).where(eq(projectsTable.orgId, orgId));
  res.json(projects);
});

// POST /projects
router.post("/projects", requireAuth, async (req, res): Promise<void> => {
  const { orgId, name } = req.body as { orgId?: string; name?: string };
  if (!orgId || !name) {
    res.status(400).json({ error: "orgId and name are required" });
    return;
  }
  const [project] = await db.insert(projectsTable).values({ orgId, name }).returning();
  res.status(201).json(project);
});

// GET /projects/:projectId
router.get("/projects/:projectId", requireAuth, async (req, res): Promise<void> => {
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(project);
});

// DELETE /projects/:projectId
router.delete("/projects/:projectId", requireAuth, async (req, res): Promise<void> => {
  const projectId = Array.isArray(req.params.projectId) ? req.params.projectId[0] : req.params.projectId;

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Require admin role in the owning org
  const allowed = await checkOrgRole(res, req.userId!, project.orgId, "admin");
  if (!allowed) return;

  await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
  res.status(204).end();
});

export default router;
