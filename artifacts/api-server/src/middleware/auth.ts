import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { eq, and } from "drizzle-orm";
import { db, orgMembersTable } from "@workspace/db";

const JWT_SECRET = process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error("SESSION_SECRET environment variable must be set — refusing to start with an insecure JWT secret");
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const token = auth.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function createToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

const ROLE_RANK: Record<string, number> = { admin: 2, member: 1 };

/**
 * Check whether userId has at least the requiredRole in the given org.
 * Returns true if the check passes, false otherwise.
 * Sends a 403 response and returns false when the check fails.
 */
export async function checkOrgRole(
  res: Response,
  userId: string,
  orgId: string,
  requiredRole: "admin" | "member",
): Promise<boolean> {
  const [membership] = await db
    .select({ role: orgMembersTable.role })
    .from(orgMembersTable)
    .where(and(eq(orgMembersTable.orgId, orgId), eq(orgMembersTable.userId, userId)))
    .limit(1);

  if (!membership) {
    res.status(403).json({ error: "Forbidden: not a member of this organization" });
    return false;
  }

  const userRank = ROLE_RANK[membership.role] ?? 0;
  const requiredRank = ROLE_RANK[requiredRole] ?? 0;

  if (userRank < requiredRank) {
    res.status(403).json({ error: `Forbidden: requires role '${requiredRole}'` });
    return false;
  }

  return true;
}
