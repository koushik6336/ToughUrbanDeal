import { pgTable, uuid, varchar, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { queuesTable } from "./queues";

export const scheduledJobsTable = pgTable("scheduled_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  queueId: uuid("queue_id").notNull().references(() => queuesTable.id, { onDelete: "cascade" }),
  jobTemplate: jsonb("job_template").notNull(),
  cronExpression: varchar("cron_expression", { length: 100 }).notNull(),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const insertScheduledJobSchema = createInsertSchema(scheduledJobsTable).omit({ id: true, createdAt: true });
export type InsertScheduledJob = z.infer<typeof insertScheduledJobSchema>;
export type ScheduledJob = typeof scheduledJobsTable.$inferSelect;
