import { pgTable, uuid, varchar, integer, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { retryPoliciesTable } from "./retryPolicies";

export const queuesTable = pgTable("queues", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  priority: integer("priority").notNull().default(0),
  concurrencyLimit: integer("concurrency_limit").notNull().default(5),
  isPaused: boolean("is_paused").notNull().default(false),
  defaultRetryPolicyId: uuid("default_retry_policy_id").references(() => retryPoliciesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => [unique().on(t.projectId, t.name)]);

export const insertQueueSchema = createInsertSchema(queuesTable).omit({ id: true, createdAt: true });
export type InsertQueue = z.infer<typeof insertQueueSchema>;
export type Queue = typeof queuesTable.$inferSelect;
