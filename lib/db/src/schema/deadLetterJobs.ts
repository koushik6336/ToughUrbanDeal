import { pgTable, uuid, jsonb, timestamp, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { queuesTable } from "./queues";

export const deadLetterJobsTable = pgTable("dead_letter_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  originalJobId: uuid("original_job_id"), // No FK cascade — intentionally orphan-safe
  queueId: uuid("queue_id").notNull().references(() => queuesTable.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull(),
  failureReason: text("failure_reason"),
  movedAt: timestamp("moved_at", { withTimezone: true }).defaultNow(),
});

export const insertDeadLetterJobSchema = createInsertSchema(deadLetterJobsTable).omit({ id: true });
export type InsertDeadLetterJob = z.infer<typeof insertDeadLetterJobSchema>;
export type DeadLetterJob = typeof deadLetterJobsTable.$inferSelect;
