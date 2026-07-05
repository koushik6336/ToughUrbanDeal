import { pgTable, uuid, varchar, jsonb, integer, timestamp, index, uniqueIndex, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { queuesTable } from "./queues";
import { retryPoliciesTable } from "./retryPolicies";

export const jobsTable = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  queueId: uuid("queue_id").notNull().references(() => queuesTable.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 255 }).notNull(),
  payload: jsonb("payload").notNull().default({}),
  status: varchar("status", { length: 20 }).notNull().default("queued"),
  // 'queued' | 'scheduled' | 'claimed' | 'running' | 'completed' | 'failed' | 'dead_letter'
  priority: integer("priority").notNull().default(0),
  runAt: timestamp("run_at", { withTimezone: true }).notNull().default(sql`now()`),
  cronExpression: varchar("cron_expression", { length: 100 }),
  retryPolicyId: uuid("retry_policy_id").references(() => retryPoliciesTable.id),
  attemptCount: integer("attempt_count").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  idempotencyKey: varchar("idempotency_key", { length: 255 }),
  workerId: uuid("worker_id"), // No FK cascade — preserve history if worker deleted
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (t) => [
  // Partial unique index — only enforced when idempotency_key is not null
  uniqueIndex("idx_jobs_idempotency").on(t.idempotencyKey).where(sql`${t.idempotencyKey} IS NOT NULL`),
  index("idx_jobs_claim_lookup").on(t.queueId, t.status, t.runAt),
  index("idx_jobs_status").on(t.status),
]);

export const jobExecutionsTable = pgTable("job_executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").references(() => jobsTable.id, { onDelete: "set null" }),
  workerId: uuid("worker_id"),
  attemptNumber: integer("attempt_number").notNull(),
  status: varchar("status", { length: 20 }).notNull(), // 'running' | 'completed' | 'failed'
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  errorMessage: text("error_message"),
  result: jsonb("result"),
}, (t) => [
  index("idx_executions_job").on(t.jobId),
]);

export const jobLogsTable = pgTable("job_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobExecutionId: uuid("job_execution_id").references(() => jobExecutionsTable.id, { onDelete: "set null" }),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
  logLevel: varchar("log_level", { length: 10 }).notNull().default("info"), // 'info' | 'warn' | 'error'
  message: text("message").notNull(),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;

export const insertJobExecutionSchema = createInsertSchema(jobExecutionsTable).omit({ id: true });
export type InsertJobExecution = z.infer<typeof insertJobExecutionSchema>;
export type JobExecution = typeof jobExecutionsTable.$inferSelect;

export const insertJobLogSchema = createInsertSchema(jobLogsTable).omit({ id: true });
export type InsertJobLog = z.infer<typeof insertJobLogSchema>;
export type JobLog = typeof jobLogsTable.$inferSelect;
